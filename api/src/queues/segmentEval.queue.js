import { getQueue } from './index.js';

/**
 * Segment-eval async jobs:
 *   - recompute : recompute audienceSize for SCHEDULED campaigns so the
 *                 dashboard reach numbers stay fresh. Runs every 5 minutes.
 */
export function scheduleSegmentEval() {
  return getQueue('segment-eval').add(
    'recompute',
    {},
    { jobId: 'segment-eval-recompute', repeat: { every: 5 * 60_000 }, removeOnComplete: true, removeOnFail: true },
  );
}
