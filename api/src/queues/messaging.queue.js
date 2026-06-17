import { getQueue } from './index.js';

/**
 * Messaging async jobs:
 *   - campaign-dispatch : fan-out a campaign to its audience (used for
 *                         scheduled sends; immediate sends dispatch inline).
 *   - send-message      : outbound WhatsApp / SMS / Instagram reply to a
 *                         provider (stubbed until provider creds are wired).
 */
export function enqueueCampaignDispatch({ campaignId, tenantId }, { delayMs } = {}) {
  return getQueue('messaging').add(
    'campaign-dispatch',
    { campaignId, tenantId },
    { jobId: `campaign_${campaignId}`, ...(delayMs ? { delay: delayMs } : {}) },
  );
}

export function cancelCampaignDispatch({ campaignId }) {
  return getQueue('messaging')
    .removeJobScheduler?.(`campaign_${campaignId}`)
    .catch(() => {});
}

export function enqueueOutboundMessage({ conversationId, messageId, channel, tenantId }) {
  return getQueue('messaging').add('send-message', { conversationId, messageId, channel, tenantId });
}
