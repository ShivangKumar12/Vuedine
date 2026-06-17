import { prisma } from '../../db/prisma.js';

/**
 * Per-branch human-readable order serial.
 *
 *   serial = `${branchCode}-${nextNumber}`     // 'BAN-1027'
 *
 * A single monotonic counter per branch (bucket = 'seq') so serials never
 * reset and therefore never collide with the `[branchId, serial]` unique
 * index. (An earlier per-day bucket reset the counter every UTC day, which
 * re-issued `BAN-1001` on the next day and violated the unique index.)
 *
 * Atomic via Postgres `INSERT … ON CONFLICT DO UPDATE` upsert, ensuring no
 * two concurrent transactions ever return the same number. A defensive
 * existence check walks past any legacy serials left over from the old
 * per-day scheme during the one-time transition.
 *
 *   const serial = await mintSerial({ branchId, branchCode });
 */

const SEQ_BUCKET = 'seq';

async function nextCounter(branchId) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "order_serials" ("id", "branchId", "bucket", "next")
    VALUES (gen_random_uuid()::text, ${branchId}, ${SEQ_BUCKET}, 2)
    ON CONFLICT ("branchId", "bucket")
    DO UPDATE SET "next" = "order_serials"."next" + 1
    RETURNING "next" - 1 AS issued
  `;
  return Number(rows?.[0]?.issued ?? 1);
}

export async function mintSerial({ branchId, branchCode }) {
  const tag = (branchCode ?? 'BR').toUpperCase();
  // The atomic counter guarantees uniqueness going forward. The loop only
  // ever iterates more than once during the one-time migration off the old
  // per-day buckets, when legacy `BAN-1001`-style serials may already exist.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const issued = await nextCounter(branchId);
    const serial = `${tag}-${1000 + issued}`;
    const exists = await prisma.order.findFirst({
      where: { branchId, serial },
      select: { id: true },
    });
    if (!exists) return serial;
  }
  // Last-resort fallback — guaranteed unique.
  return `${tag}-${Date.now()}`;
}

/**
 * Public-facing 3-digit token (TKN-128). Distinct from `serial` so OSS can
 * show a friendly short id even when serials grow long. Random + uniqueness
 * is per-branch + best-effort; no atomic guarantee — collisions possible
 * but extremely rare given a 900-number space.
 */
export function mintToken() {
  const n = 100 + Math.floor(Math.random() * 900);
  return `TKN-${n}`;
}
