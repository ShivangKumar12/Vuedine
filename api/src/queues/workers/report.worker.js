import { Worker } from 'bullmq';

import { env } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../db/prisma.js';
import { emailService } from '../../modules/email/email.service.js';
import { reportsService } from '../../modules/reports/reports.service.js';
import { putObject } from '../../utils/uploader.js';
import { buildBullConnection, bullPrefix } from '../connection.js';
import { sendToDlq } from '../dlq.js';

/**
 * Report worker — builds CSV/PDF sales exports off the request path, uploads
 * to S3 (when configured), and emails the owner a link. Falls back to a logged
 * artifact when S3 is unconfigured (dev) so the pipeline still completes.
 */
async function buildExport({ tenantId, branchId, range, type }) {
  const query = {
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
    from: range?.from,
    to: range?.to,
  };
  const csv = await reportsService.buildSalesCsv({ tenantId, query });
  const key = `exports/${tenantId}/sales-${Date.now()}.csv`;
  let url = null;
  if (env.S3_BUCKET) {
    try {
      url = await putObject({ key, body: Buffer.from(csv, 'utf8'), contentType: 'text/csv' });
    } catch (err) {
      logger.warn('report.export.upload_failed', { message: err.message });
    }
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['OWNER', 'SUPER_ADMIN'] }, deletedAt: null },
    select: { email: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (owner?.email) {
    try {
      await emailService.send({
        to: owner.email,
        subject: 'Your Vuedine sales export is ready',
        template: 'data-export',
        data: { name: owner.name ?? 'there', downloadUrl: url ?? '(stored on the server)', counts: type },
      });
    } catch (err) {
      logger.warn('report.export.email_failed', { message: err.message });
    }
  }
  return { key, url, bytes: csv.length };
}

export function startReportWorker() {
  const worker = new Worker(
    'report',
    async (job) => {
      logger.info('report.generate.start', { jobId: job.id, type: job.data.type, tenantId: job.data.tenantId });
      await job.updateProgress(10);
      const result = await buildExport(job.data);
      await job.updateProgress(100);
      logger.info('report.generate.ok', { jobId: job.id, ...result });
      return result;
    },
    {
      connection: buildBullConnection(),
      prefix: bullPrefix,
      concurrency: 2,
      lockDuration: 120_000,
    },
  );

  worker.on('failed', async (job, err) => {
    const finalAttempt = job.attemptsMade >= job.opts.attempts;
    logger.error('report.generate.failed', { jobId: job.id, message: err.message, attempt: job.attemptsMade, final: finalAttempt });
    if (finalAttempt) await sendToDlq({ queueName: 'report', job, err });
  });

  worker.on('error', (err) => {
    logger.error('report.worker.error', { message: err.message });
  });

  return worker;
}
