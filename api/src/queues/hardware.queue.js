import { getQueue } from './index.js';

/**
 * Hardware async jobs:
 *   - heartbeat-check : flags devices offline when lastSeenAt > 5 min.
 *
 * Scheduled as a repeatable job (every minute) so the dashboard's online/
 * offline dots stay accurate without each request hitting the DB clock.
 */
export function scheduleHardwareHeartbeatCheck() {
  return getQueue('hardware').add(
    'heartbeat-check',
    {},
    { repeat: { every: 60_000 }, jobId: 'hardware-heartbeat-check' },
  );
}
