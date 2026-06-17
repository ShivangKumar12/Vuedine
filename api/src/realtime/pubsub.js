import IORedis from 'ioredis';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Redis pub/sub primitives.
 *
 * Why separate connections from the cache/RL client:
 *   A connection in subscribe mode can only run SUBSCRIBE / UNSUBSCRIBE / PING.
 *   So we keep two dedicated clients — one for publishing, one for subscribing.
 *
 * Why we don't reuse the BullMQ connection either:
 *   BullMQ owns its own subscriber for queue events. Sharing risks command
 *   collisions during reconnect.
 *
 * Used by:
 *   - the WebSocket gateway in Phase 8 (live order broadcast)
 *   - any future service-to-service coordination ("user logged in", "branch went offline")
 */

function buildClient() {
  return new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    keyPrefix: env.REDIS_KEY_PREFIX,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

const publisher = buildClient();
const subscriber = buildClient();

publisher.on('error', (e) =>
  logger.error('redis.pub.error', { message: e?.message ?? e?.code ?? String(e) }),
);
subscriber.on('error', (e) =>
  logger.error('redis.sub.error', { message: e?.message ?? e?.code ?? String(e) }),
);

/** channel -> Set<handler> */
const handlers = new Map();

subscriber.on('message', (channel, message) => {
  const set = handlers.get(channel);
  if (!set) return;
  let payload;
  try {
    payload = JSON.parse(message);
  } catch {
    payload = message;
  }
  for (const fn of set) {
    Promise.resolve(fn(payload)).catch((e) =>
      logger.error('pubsub.handler_error', { channel, message: e.message }),
    );
  }
});

export const pubsub = {
  /** Publish a JSON payload to a channel. Returns the number of subscribers that received it. */
  async publish(channel, payload) {
    return publisher.publish(channel, JSON.stringify(payload));
  },

  /** Subscribe to a channel. Multiple handlers per channel are supported. */
  async subscribe(channel, handler) {
    let set = handlers.get(channel);
    if (!set) {
      set = new Set();
      handlers.set(channel, set);
      await subscriber.subscribe(channel);
    }
    set.add(handler);
    return () => this.unsubscribe(channel, handler); // disposer
  },

  async unsubscribe(channel, handler) {
    const set = handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      handlers.delete(channel);
      await subscriber.unsubscribe(channel);
    }
  },

  /** Graceful shutdown — called from server.js on SIGTERM. */
  async disconnect() {
    try {
      await publisher.quit();
    } catch {
      publisher.disconnect();
    }
    try {
      await subscriber.quit();
    } catch {
      subscriber.disconnect();
    }
  },
};
