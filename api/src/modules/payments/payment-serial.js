import { prisma } from '../../db/prisma.js';

/**
 * Per-branch + per-day payment serial. Mirrors order-serial.js but for the
 * `payments` table — TXN-1001, TXN-1002, ...
 */

function todayBucket() {
  const d = new Date();
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('');
}

export async function mintPaymentSerial({ branchId, branchCode }) {
  const bucket = todayBucket();
  const rows = await prisma.$queryRaw`
    INSERT INTO "payment_serials" ("id", "branchId", "bucket", "next")
    VALUES (gen_random_uuid()::text, ${branchId}, ${bucket}, 2)
    ON CONFLICT ("branchId", "bucket")
    DO UPDATE SET "next" = "payment_serials"."next" + 1
    RETURNING "next" - 1 AS issued
  `;
  const issued = Number(rows?.[0]?.issued ?? 1);
  // Use a TXN- prefix so they're distinguishable from order serials.
  const tag = (branchCode ?? 'BR').toUpperCase();
  return `TXN-${tag}-${1000 + issued}`;
}
