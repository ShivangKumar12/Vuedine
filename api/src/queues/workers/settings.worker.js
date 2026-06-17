import { Worker } from 'bullmq';

import { env } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { emailService } from '../../modules/email/email.service.js';
import { putObject } from '../../utils/uploader.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';
import { getQueue } from '../index.js';

/**
 * Settings worker — Phase F async work.
 *
 *   export-tenant-data : build a JSON snapshot of the tenant's data, upload
 *                        to S3 (if configured), email the owner a link.
 *   demo-reset / sweep : when tenant.demoMode = true, wipe transactional data
 *                        hourly so public demos stay clean.
 */

async function buildTenantSnapshot(tenantId) {
  const [tenant, branches, users, items, orders, payments, promotions, taxSlabs] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.branch.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.user.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } }),
    prisma.item.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.order.findMany({ where: { tenantId, deletedAt: null }, take: 5000, orderBy: { createdAt: 'desc' } }),
    prisma.payment.findMany({ where: { tenantId, deletedAt: null }, take: 5000, orderBy: { createdAt: 'desc' } }),
    prisma.promotion.findMany({ where: { tenantId, deletedAt: null } }),
    prisma.taxSlab.findMany({ where: { tenantId, deletedAt: null } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    counts: {
      branches: branches.length,
      users: users.length,
      items: items.length,
      orders: orders.length,
      payments: payments.length,
      promotions: promotions.length,
      taxSlabs: taxSlabs.length,
    },
    branches,
    users,
    items,
    orders,
    payments,
    promotions,
    taxSlabs,
  };
}

async function runExport(tenantId) {
  const snapshot = await buildTenantSnapshot(tenantId);
  const body = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8');
  const key = `exports/${tenantId}/vuedine-export-${Date.now()}.json`;

  let url = null;
  if (env.S3_BUCKET) {
    try {
      url = await putObject({ key, body, contentType: 'application/json' });
    } catch (err) {
      logger.warn('settings.export.upload_failed', { message: err.message });
    }
  } else {
    logger.warn('settings.export.no_s3', { reason: 'S3 not configured; snapshot built but not uploaded' });
  }

  // Email the owner the link (best-effort; noop in dev without SMTP).
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['OWNER', 'SUPER_ADMIN'] }, deletedAt: null },
    select: { email: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (owner?.email) {
    try {
      await emailService.send({
        to: owner.email,
        subject: 'Your Vuedine data export is ready',
        template: 'data-export',
        data: {
          name: owner.name ?? 'there',
          downloadUrl: url ?? '(stored on the server — contact support to retrieve)',
          counts: JSON.stringify(snapshot.counts),
        },
      });
    } catch (err) {
      logger.warn('settings.export.email_failed', { message: err.message });
    }
  }

  return { key, url, counts: snapshot.counts };
}

async function resetDemoTenant(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { demoMode: true } });
  if (!t?.demoMode) return { skipped: true };

  // Wipe transactional rows only; keep catalog + staff so the demo is usable.
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { order: { tenantId } } }),
    prisma.orderEvent.deleteMany({ where: { order: { tenantId } } }),
    prisma.payment.deleteMany({ where: { tenantId } }),
    prisma.order.deleteMany({ where: { tenantId } }),
  ]);
  logger.info('settings.demo_reset.done', { tenantId });
  return { reset: true };
}

async function sweepDemoTenants() {
  const demos = await prisma.tenant.findMany({ where: { demoMode: true, deletedAt: null }, select: { id: true } });
  let reset = 0;
  for (const d of demos) {
    await resetDemoTenant(d.id);
    reset += 1;
  }
  return { reset };
}

export function startSettingsWorker() {
  const worker = new Worker(
    'settings',
    async (job) => {
      if (job.name === 'export-tenant-data') {
        logger.info('settings.export.start', { tenantId: job.data.tenantId });
        const result = await runExport(job.data.tenantId);
        logger.info('settings.export.ok', { tenantId: job.data.tenantId, ...result });
        return result;
      }
      if (job.name === 'demo-reset') {
        return resetDemoTenant(job.data.tenantId);
      }
      if (job.name === 'demo-reset-sweep') {
        return sweepDemoTenants();
      }
      return null;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 1,
      lockDuration: 120_000,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('settings.worker.failed', { jobId: job.id, name: job.name, message: err.message, final: finalAttempt });
    if (finalAttempt) await sendToDlq({ queueName: 'settings', job, err });
  });
  worker.on('error', (err) => logger.error('settings.worker.error', { message: err.message }));

  (async () => {
    try {
      await getQueue('settings').add(
        'demo-reset-sweep',
        {},
        { jobId: 'demo-reset-sweep', repeat: { every: 60 * 60_000 }, removeOnComplete: true, removeOnFail: true },
      );
      logger.info('settings.demo-reset-sweep scheduled (hourly)');
    } catch (err) {
      logger.error('settings.demo_reset.schedule_failed', { message: err.message });
    }
  })();

  return worker;
}
