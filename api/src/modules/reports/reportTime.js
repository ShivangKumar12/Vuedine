/**
 * Tenant-timezone aware date helpers for reporting.
 *
 * Pitfall #1: always project timestamps into the tenant's timezone before
 * truncating to day/hour — UTC math breaks daily reports for IST tenants.
 * We use Intl.DateTimeFormat with the tenant tz to derive day keys + hour
 * buckets deterministically (no external tz library needed).
 */

function partsInTz(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return parts; // { year, month, day, hour }
}

/** 'YYYY-MM-DD' in the tenant timezone. */
export function dayKey(date, timeZone) {
  const p = partsInTz(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hour 0-23 in the tenant timezone. */
export function hourInTz(date, timeZone) {
  const p = partsInTz(date, timeZone);
  const h = parseInt(p.hour, 10);
  return h === 24 ? 0 : h;
}

/** Inclusive list of the last N day keys (oldest → newest) in tz. */
export function lastNDayKeys(n, timeZone, now = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    keys.push(dayKey(new Date(now.getTime() - i * 86400_000), timeZone));
  }
  return keys;
}

/** Resolve a from/to range. Defaults to the last `defaultDays` days. */
export function resolveRange({ from, to, defaultDays = 30 }) {
  const toDate = to ? new Date(to) : new Date();
  // make `to` inclusive of the whole day
  if (to && to.length <= 10) toDate.setHours(23, 59, 59, 999);
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - defaultDays * 86400_000);
  if (from && from.length <= 10) fromDate.setHours(0, 0, 0, 0);
  return { fromDate, toDate };
}
