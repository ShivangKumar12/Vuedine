import { Queue, QueueEvents } from 'bullmq';

import { logger } from '../config/logger.js';
import { queueJobsTotal } from '../observability/metrics.js';

import { buildBullConnection, bullPrefix } from './connection.js';

/**
 * Queue registry — single place that owns Queue + QueueEvents instances.
 * Use `getQueue(name)` from any producer; the registry handles lazy creation.
 *
 *   import { getQueue } from '@/queues';
 *   await getQueue('email').add('send', { to, subject, template, data });
 *
 * Default job options codify our retry policy per queue. They're applied to
 * every job unless an individual `add()` call overrides them.
 */

/**
 * Per-queue configuration. `attempts` and `backoff` set the retry contract;
 * `removeOnComplete` / `removeOnFail` cap memory growth.
 */
const QUEUE_DEFINITIONS = {
  email: {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  },
  notification: {
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  },
  report: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 30 * 86_400 },
      removeOnFail: { age: 30 * 86_400 },
    },
  },
  webhook: {
    defaultJobOptions: {
      attempts: 6,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 5_000 },
      removeOnFail: { age: 14 * 86_400 },
    },
  },
  dlq: {
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 30 * 86_400 },
      removeOnFail: { age: 30 * 86_400 },
    },
  },
  users: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 3_600, count: 100 },
      removeOnFail: { age: 86_400 },
    },
  },
  promotions: {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 3_600, count: 100 },
      removeOnFail: { age: 86_400 },
    },
  },
  settings: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 7 * 86_400, count: 100 },
      removeOnFail: { age: 30 * 86_400 },
    },
  },
  hardware: {
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 3_600, count: 50 },
      removeOnFail: { age: 86_400 },
    },
  },
  qr: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  },
  messaging: {
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  },
  'segment-eval': {
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 3_600, count: 100 },
      removeOnFail: { age: 86_400 },
    },
  },
  integration: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  },
  billing: {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 30 * 86_400, count: 1_000 },
      removeOnFail: { age: 30 * 86_400 },
    },
  },
};

const queues = new Map();
const eventListeners = new Map();

export function getQueue(name) {
  if (queues.has(name)) return queues.get(name);
  const def = QUEUE_DEFINITIONS[name];
  if (!def) throw new Error(`Unknown queue: ${name}`);

  const q = new Queue(name, {
    connection: buildBullConnection(),
    prefix: bullPrefix,
    defaultJobOptions: def.defaultJobOptions,
  });

  /* ---- Lifecycle event subscription ----
   * QueueEvents lives on its own connection (BullMQ requirement). It emits
   * `failed`, `stalled`, `completed`, etc. without us having to instantiate
   * a Worker just to observe them — handy in the API process for metrics. */
  const events = new QueueEvents(name, {
    connection: buildBullConnection(),
    prefix: bullPrefix,
  });
  events.on('failed', ({ jobId, failedReason }) => {
    queueJobsTotal.labels(name, 'failed').inc();
    logger.error(`queue.${name}.failed`, { jobId, failedReason });
  });
  events.on('completed', ({ jobId }) => {
    queueJobsTotal.labels(name, 'completed').inc();
    logger.debug(`queue.${name}.completed`, { jobId });
  });
  events.on('stalled', ({ jobId }) => {
    queueJobsTotal.labels(name, 'stalled').inc();
    logger.warn(`queue.${name}.stalled`, { jobId });
  });
  events.on('error', (err) => {
    logger.error(`queue.${name}.events_error`, { message: err?.message ?? String(err) });
  });
  eventListeners.set(name, events);

  queues.set(name, q);
  logger.info(`queue.${name}.ready`);
  return q;
}

/** List configured queue names. Used by Bull Board + metrics. */
export function listQueueNames() {
  return Object.keys(QUEUE_DEFINITIONS);
}

/**
 * Graceful shutdown — close every queue + every events listener.
 * Wired into server.js (`SIGTERM` handler) and the worker entrypoint.
 */
export async function closeQueues() {
  for (const q of queues.values()) {
    try {
      await q.close();
    } catch (err) {
      logger.warn('queue.close_failed', { name: q.name, message: err.message });
    }
  }
  for (const e of eventListeners.values()) {
    try {
      await e.close();
    } catch (err) {
      logger.warn('queue.events_close_failed', { message: err.message });
    }
  }
  queues.clear();
  eventListeners.clear();
}
