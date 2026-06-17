import { getQueue } from './index.js';

/**
 * Enqueue a provider sync (menu / availability push). Job id is scoped per
 * tenant+provider so rapid double-clicks coalesce into one in-flight job.
 *
 * @param {{ tenantId: string, provider: string, integrationId: string }} job
 */
export function enqueueIntegrationSync(job) {
  return getQueue('integration').add('sync', job, {
    jobId: `intsync_${job.tenantId}_${job.provider}`,
  });
}
