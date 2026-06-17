import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import { Server } from 'socket.io';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';
import { tokens } from '../modules/auth/tokens.js';

/**
 * Socket.io gateway.
 *
 * Two responsibilities:
 *   1. Authenticate WebSocket handshakes via the same JWT we use for HTTP.
 *   2. Bridge cross-instance events through a Redis pub/sub adapter so any
 *      pod can publish and every connected client receives — without sticky
 *      sessions, which would defeat horizontal scaling.
 *
 * Rooms are auto-joined by the user's tenant + branches:
 *
 *   tenant:<tenantId>     // tenant-wide events (settings change, branch list)
 *   branch:<branchId>     // per-branch events (live orders, KDS tickets)
 *   user:<userId>         // direct messages, push targeting
 *
 * The orders module (Phase 5+) calls `emitLiveOrder(branchId, 'created', ...)`
 * to fan out to every dashboard watching that branch.
 */

let _io = null;

export function attachSocket(httpServer) {
  if (_io) return _io;

  _io = new Server(httpServer, {
    path: '/ws',
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    // websocket-only in prod (no long-poll fallback) keeps the protocol clean
    // through Nginx and avoids sticky-session requirements.
    transports: ['websocket'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    // 1MB cap — abuse protection. Real payloads are kilobytes.
    maxHttpBufferSize: 1_000_000,
  });

  /* ---- Redis pub/sub adapter so any pod's emit reaches all clients ---- */
  const pubClient = new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
  });
  const subClient = pubClient.duplicate();
  _io.adapter(createAdapter(pubClient, subClient));

  pubClient.on('error', (e) =>
    logger.error('socket.pub.error', { message: e?.message ?? String(e) }),
  );
  subClient.on('error', (e) =>
    logger.error('socket.sub.error', { message: e?.message ?? String(e) }),
  );

  /* ---- Handshake auth ---- */
  _io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) return next(new Error('NO_TOKEN'));

      const payload = tokens.verifyAccess(token);
      socket.data.user = {
        id: payload.sub,
        tenantId: payload.tid,
        role: payload.role,
        branchIds: payload.branchIds ?? [],
      };
      next();
    } catch (err) {
      next(new Error(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'BAD_TOKEN'));
    }
  });

  /* ---- Connection handling ---- */
  _io.on('connection', (socket) => {
    const { id: userId, tenantId, branchIds } = socket.data.user;

    // Auto-join tenant-scoped + branch-scoped + user-scoped rooms.
    if (tenantId) socket.join(`tenant:${tenantId}`);
    for (const branchId of branchIds) socket.join(`branch:${branchId}`);
    socket.join(`user:${userId}`);

    logger.info('ws.connect', {
      userId,
      tenantId,
      socketId: socket.id,
      rooms: [...socket.rooms],
    });

    socket.on('disconnect', (reason) => {
      logger.info('ws.disconnect', { userId, socketId: socket.id, reason });
    });

    // Optional: clients can manually scope to a branch (e.g. a manager who
    // logs in to a branch they aren't pre-assigned to). Validation is the
    // controller's responsibility — JWT branchIds are the source of truth
    // for permissions.
    socket.on('subscribe:branch', (branchId, ack) => {
      if (typeof branchId !== 'string') return ack?.({ ok: false });
      if (!socket.data.user.branchIds.includes(branchId) && socket.data.user.role !== 'OWNER') {
        return ack?.({ ok: false, code: 'BRANCH_FORBIDDEN' });
      }
      socket.join(`branch:${branchId}`);
      ack?.({ ok: true });
    });
  });

  return _io;
}

/**
 * Convenience helpers used by feature modules. Each one is a thin wrapper
 * that lives in this file so importers don't reach into io directly.
 *
 * Event names are passed through verbatim — the convention is for callers to
 * use the namespaced form, e.g. `liveOrder:created`, `kds:ticket:done`.
 * Keeping the prefixing in callers avoids a double-prefix bug class.
 */
export function emitToBranch(branchId, event, payload) {
  if (!_io) return;
  _io.to(`branch:${branchId}`).emit(event, payload);
}

export function emitToTenant(tenantId, event, payload) {
  if (!_io) return;
  _io.to(`tenant:${tenantId}`).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (!_io) return;
  _io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Order-specific helper — wraps `emitToBranch` with the `liveOrder:` prefix
 * convention. The orders module (Phase 9+) uses this; debug surface uses
 * the lower-level helpers directly.
 */
export function emitLiveOrder(branchId, event, payload) {
  emitToBranch(branchId, `liveOrder:${event}`, payload);
}

/** Used by the debug emit endpoint and tests. */
export function getIo() {
  return _io;
}

/** Graceful shutdown — close all sockets, then the server. */
export async function disconnectSockets() {
  if (!_io) return;
  await _io.close();
  _io = null;
}
