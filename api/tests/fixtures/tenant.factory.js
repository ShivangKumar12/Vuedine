import { faker } from '@faker-js/faker';

import { getPrisma } from '../helpers/test-db.js';

/**
 * Build a tenant + a default branch in one shot — most tests need both.
 *
 *   const { tenant, branch } = await makeTenant();
 *   await makeUser({ tenantId: tenant.id, branchIds: [branch.id] });
 *
 * Everything is randomized via faker; pass overrides when a test needs
 * deterministic values (e.g. exercising slug uniqueness).
 */
export async function makeTenant(overrides = {}) {
  const prisma = getPrisma();
  const slug =
    overrides.slug ?? `${faker.lorem.slug(2)}-${faker.string.alphanumeric(6).toLowerCase()}`;

  const tenant = await prisma.tenant.create({
    data: {
      name: overrides.name ?? faker.company.name(),
      slug,
      currency: overrides.currency ?? 'INR',
      timezone: overrides.timezone ?? 'Asia/Kolkata',
      type: overrides.type ?? 'restaurant',
      ...overrides,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'HQ',
      // Faker's alpha() collides easily on parallel tests; use a longer suffix.
      code: faker.string.alphanumeric({ length: 4, casing: 'upper' }),
      qrSlug: `${tenant.slug}-hq`,
      isLive: true,
      diningSections: ['Indoor', 'Outdoor'],
    },
  });

  return { tenant, branch };
}
