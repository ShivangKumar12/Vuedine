import 'dotenv/config';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import express from 'express';

import { config } from '../src/config/index.js';
import { logger } from '../src/config/logger.js';
import { authMiddleware } from '../src/middleware/auth.middleware.js';
import { requireRole } from '../src/middleware/rbac.middleware.js';
import { closeQueues, getQueue, listQueueNames } from '../src/queues/index.js';

/**
 * Bull Board UI for queue monitoring.
 *
 *   npm run queue:board → http://localhost:4001/admin/queues
 *
 * 🔒 SECURITY — Bull Board exposes job payloads. Always gate on auth + role.
 * In prod, mount on its own port behind VPN or restrict via Nginx allow/deny.
 *
 * Standalone process so it doesn't compete with API request handlers, and so
 * it can be deployed to a private subnet separately from the public API.
 */

const PORT = 4001;

const app = express();

const adapter = new ExpressAdapter();
adapter.setBasePath('/admin/queues');

createBullBoard({
  queues: listQueueNames().map((name) => new BullMQAdapter(getQueue(name))),
  serverAdapter: adapter,
});

// Owners and platform admins only.
app.use('/admin/queues', authMiddleware, requireRole('SUPER_ADMIN', 'OWNER'), adapter.getRouter());

// Tight error handler — Bull Board uses Express's default which leaks stacks.
// Even though the UI is role-gated, defense in depth.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.statusCode ?? 500;
  res.status(status).json({
    success: false,
    data: null,
    error: {
      code: err.code ?? (status >= 500 ? 'INTERNAL' : 'ERROR'),
      message: err.message ?? 'Error',
    },
  });
});

const server = app.listen(PORT, () => {
  logger.info('bull-board listening', { port: PORT, url: `http://localhost:${PORT}/admin/queues` });
});

async function shutdown(signal) {
  logger.info(`bull-board received ${signal}, draining`);
  server.close(async () => {
    await closeQueues();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (config.isDev) {
  // eslint-disable-next-line no-console
  console.log(`📊 Bull Board: http://localhost:${PORT}/admin/queues`);
}
