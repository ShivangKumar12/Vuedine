import { io, Socket } from 'socket.io-client';
import { authStore } from '../stores/auth';
import { API_BASE } from './api';

/**
 * Socket.io connection — JWT-authenticated, auto-reconnects, joins
 * tenant + branch + user rooms automatically (the server does the joins).
 *
 * Lifecycle:
 *   - First subscriber → connect
 *   - Last unsubscriber → leave open (cheap, plus reconnect cost)
 *   - Auth token rotates → reconnect with new token (handled by listener
 *     on the auth store)
 *
 * Usage:
 *   const off = socketClient.on('liveOrder:created', (order) => ...);
 *   off();
 */

let socket: Socket | null = null;
let listenerCount = 0;

function build(): Socket {
  const token = authStore.getAccessToken();
  const s = io(API_BASE, {
    path: '/ws',
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    auth: token ? { token } : undefined,
    withCredentials: true,
  });
  s.on('connect', () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vuedine:socket:connect'));
    }
  });
  s.on('disconnect', () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vuedine:socket:disconnect'));
    }
  });
  s.on('connect_error', (err) => {
    // Silently — the dashboard polls + the bus is best-effort.
    if (typeof console !== 'undefined') {
      console.warn('[socket] connect_error', err.message);
    }
  });
  return s;
}

function ensure(): Socket {
  if (!socket) socket = build();
  // If token has rotated since the socket was built, reconnect with the new one.
  const tok = authStore.getAccessToken();
  if (tok && socket.auth && (socket.auth as { token?: string }).token !== tok) {
    socket.auth = { token: tok };
    socket.disconnect();
    socket.connect();
  }
  return socket;
}

export const socketClient = {
  on<T = unknown>(event: string, handler: (payload: T) => void): () => void {
    const s = ensure();
    listenerCount += 1;
    s.on(event, handler as (...args: unknown[]) => void);
    return () => {
      s.off(event, handler as (...args: unknown[]) => void);
      listenerCount -= 1;
    };
  },

  emit(event: string, payload?: unknown) {
    ensure().emit(event, payload);
  },

  /** Force a disconnect — used on signOut. */
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
      listenerCount = 0;
    }
  },

  isConnected() {
    return Boolean(socket?.connected);
  },

  listenerCount() {
    return listenerCount;
  },
};

// Re-connect when access token changes (login / refresh).
// authStore subscribe is wired through the createStore primitive — when the
// dashboard refreshes the access token via /v1/auth/refresh, the socket
// handshake auth needs to reconnect with the new token. The ensure() call
// already handles the token check on every emit/listen — that's enough for
// the small set of reconnections we encounter in practice.
