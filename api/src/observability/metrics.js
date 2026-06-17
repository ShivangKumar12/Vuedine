import client from 'prom-client';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Prometheus metrics registry + custom metrics.
 *
 * RED method:
 *   R(ate)     → http_requests_total
 *   E(rrors)   → http_requests_total filtered by status_code=~5..
 *   D(uration) → http_request_duration_seconds (histogram)
 *
 * Plus operational counters that scale with our architecture:
 *   - DB query duration
 *   - Cache hit/miss ratio
 *   - Queue depth + job outcomes
 *   - Auth events (login / refresh / reuse / lockout)
 *
 * 🔴 PRODUCTION CRITICAL — keep label cardinality bounded. Labels like
 * `userId`, `orderId`, raw URL paths explode memory. Use the route pattern
 * (`/items/:id`), the role enum, the queue name — anything from a closed set.
 */

export const registry = new client.Registry();
registry.setDefaultLabels({ service: env.APP_NAME, env: env.NODE_ENV });

// Default Node.js metrics (event loop lag, GC, heap, file descriptors).
client.collectDefaultMetrics({ register: registry, prefix: 'node_' });

/* ============================================================
 *  HTTP RED metrics
 * ============================================================ */

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  // Buckets are seconds; chosen to span sub-ms cache hits up to 10s outliers.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/* ============================================================
 *  Database
 * ============================================================ */

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Prisma query duration in seconds',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

/* ============================================================
 *  Cache
 * ============================================================ */

export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Cache hits',
  labelNames: ['layer'], // 'service' | 'route'
  registers: [registry],
});

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Cache misses',
  labelNames: ['layer'],
  registers: [registry],
});

/* ============================================================
 *  Queues
 * ============================================================ */

export const queueDepth = new client.Gauge({
  name: 'queue_depth',
  help: 'Number of jobs waiting/active/delayed in queue',
  labelNames: ['queue'],
  registers: [registry],
});

export const queueJobsTotal = new client.Counter({
  name: 'queue_jobs_total',
  help: 'Queue job lifecycle outcomes',
  labelNames: ['queue', 'status'], // status: completed | failed | stalled
  registers: [registry],
});

/* ============================================================
 *  Auth
 * ============================================================ */

export const authEventsTotal = new client.Counter({
  name: 'auth_events_total',
  help: 'Auth events (login, refresh, reuse_detected, etc.)',
  labelNames: ['action', 'outcome'], // outcome: success | failure | reuse
  registers: [registry],
});

/* ============================================================
 *  Audit
 * ============================================================ */

export const auditFailuresTotal = new client.Counter({
  name: 'audit_failures_total',
  help: 'Audit log writes that silently failed (DB unreachable, etc.)',
  labelNames: ['action'],
  registers: [registry],
});

/* ============================================================
 *  Queue depth refresh
 *  ----
 *  Periodically polls each queue for waiting/active/delayed counts and
 *  updates the gauge. Called from app.js boot with `unref()` so the interval
 *  never keeps the process alive past graceful shutdown.
 * ============================================================ */

export async function refreshQueueDepth() {
  // Lazy-import to avoid pulling BullMQ at startup if metrics are disabled.
  const { getQueue, listQueueNames } = await import('../queues/index.js');
  for (const name of listQueueNames()) {
    try {
      const counts = await getQueue(name).getJobCounts('waiting', 'active', 'delayed');
      queueDepth.labels(name).set(counts.waiting + counts.active + counts.delayed);
    } catch (err) {
      logger.debug('queueDepth.refresh_failed', { queue: name, message: err.message });
    }
  }
}
