import { randomBytes } from 'node:crypto';

import { faker } from '@faker-js/faker';

import { getPrisma } from '../helpers/test-db.js';

export async function makeTable(overrides = {}) {
  const prisma = getPrisma();
  if (!overrides.tenantId) throw new Error('makeTable: tenantId required');
  if (!overrides.branchId) throw new Error('makeTable: branchId required');

  return prisma.table.create({
    data: {
      tenantId: overrides.tenantId,
      branchId: overrides.branchId,
      name: overrides.name ?? `Table ${faker.number.int({ min: 1, max: 9999 })}`,
      section: overrides.section ?? 'Indoor',
      capacity: overrides.capacity ?? 4,
      shape: overrides.shape ?? 'round',
      status: overrides.status ?? 'FREE',
      active: overrides.active ?? true,
      qrToken: overrides.qrToken ?? randomBytes(12).toString('base64url'),
      posLabel: overrides.posLabel ?? null,
    },
  });
}
