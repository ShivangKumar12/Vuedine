import { faker } from '@faker-js/faker';

import { getPrisma } from '../helpers/test-db.js';

/**
 * Branch factory.
 *
 *   const branch = await makeBranch({ tenantId: t.id, code: 'BAN' });
 */
export async function makeBranch(overrides = {}) {
  const prisma = getPrisma();
  if (!overrides.tenantId) throw new Error('makeBranch: tenantId required');

  const code = (overrides.code ?? faker.string.alpha({ length: 3, casing: 'upper' })).toUpperCase();

  return prisma.branch.create({
    data: {
      tenantId: overrides.tenantId,
      code,
      qrSlug:
        overrides.qrSlug ?? `${faker.lorem.slug(2)}-${faker.string.alphanumeric(4).toLowerCase()}`,
      name: overrides.name ?? `Branch ${code}`,
      address: overrides.address ?? faker.location.streetAddress(),
      phone: overrides.phone ?? faker.phone.number(),
      email: overrides.email ?? null,
      manager: overrides.manager ?? null,
      isLive: overrides.isLive ?? true,
      defaultPrep: overrides.defaultPrep ?? 15,
      serviceCharge: overrides.serviceCharge ?? 0,
      taxInclusive: overrides.taxInclusive ?? false,
      diningSections: overrides.diningSections ?? ['Indoor', 'Outdoor'],
    },
  });
}
