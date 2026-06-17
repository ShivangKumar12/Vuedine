// Tracing must be initialized BEFORE any other module imports so the
// auto-instrumentations can hook into them. No-op when OTEL_EXPORTER_OTLP_ENDPOINT
// isn't set.
// eslint-disable-next-line import/order -- intentionally first to enable instrumentation hooks
import { initTracing, shutdownTracing } from './observability/tracing.js';
await initTracing();

import http from 'node:http';

import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { disconnectDb } from './db/prisma.js';
import { disconnectReplica } from './db/prismaReplica.js';
import { disconnectRedis } from './db/redis.js';
import { initSentry } from './observability/sentry.js';
import { closeQueues } from './queues/index.js';
import { pubsub } from './realtime/pubsub.js';
import { attachSocket, disconnectSockets } from './realtime/socket.js';

await initSentry();

/**
 * HTTP listener + graceful shutdown.
 *
 * On SIGTERM / SIGINT we stop accepting new connections, drain in-flight
 * requests, then exit. The 25-second deadline must be LESS than the
 * orchestrator's terminationGracePeriodSeconds (Kubernetes default: 30s)
 * so we never get SIGKILL'd mid-request.
 */

const SHUTDOWN_TIMEOUT_MS = 25_000;

const app = createApp();
const server = http.createServer(app);

// Attach socket.io BEFORE listen so the upgrade handler is ready when
// connections start arriving.
if (config.features.realtimeOrders) {
  attachSocket(server);
  logger.info('socket.io.attached');
}

server.listen(config.port, () => {
  logger.info(`🚀 ${config.appName} listening`, {
    port: config.port,
    env: config.env,
    pid: process.pid,
  });
  // PM2 wait_ready: signals that the process is ready to receive traffic.
  if (process.send) process.send('ready');
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`🛑 received ${signal}, draining`);

  // Hard deadline so a stuck connection doesn't pin the process forever.
  const killTimer = setTimeout(() => {
    logger.error('shutdown timed out, forcing exit', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  killTimer.unref();

  // Stop accepting new connections; existing keep-alive connections drain.
  server.close(async (err) => {
    if (err) {
      logger.error('error during server.close', { err: err.message });
      process.exit(1);
    }
    try {
      await disconnectSockets();
      await disconnectDb();
      await disconnectReplica();
      await closeQueues();
      await disconnectRedis();
      await pubsub.disconnect();
      await shutdownTracing();
    } catch (e) {
      logger.error('error during downstream disconnect', { err: e.message });
    }
    logger.info('✅ shutdown complete');
    process.exit(0);
  });

  // Phase 2/3 wired above.
  // Phase 6 will plug in queue workers.
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * `unhandledRejection` is logged but does NOT exit. A stale promise rejection
 * after a request has already returned is benign — exiting causes restart loops.
 * Fix the leak in code; don't crash the production server over it.
 */
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', {
    reason: reason instanceof Error ? reason.stack : String(reason),
  });
});

/**
 * `uncaughtException` is a programmer bug — the process is in unknown state.
 * Drain best-effort and let the orchestrator restart us.
 */
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { stack: err.stack });
  shutdown('uncaughtException').catch(() => process.exit(1));
});
