import { faker } from '@faker-js/faker';

import { getPrisma } from '../helpers/test-db.js';

/**
 * Menu item factory.
 *
 *   const item = await makeItem({ tenantId: t.id, name: 'Margherita' });
 */
export async function makeItem(overrides = {}) {
  const prisma = getPrisma();
  if (!overrides.tenantId) {
    throw new Error('makeItem(): tenantId is required');
  }
  return prisma.item.create({
    data: {
      tenantId: overrides.tenantId,
      name: overrides.name ?? faker.commerce.productName(),
      description: overrides.description ?? faker.commerce.productDescription(),
      category: overrides.category ?? faker.commerce.department(),
      price: overrides.price ?? faker.commerce.price({ min: 50, max: 800, dec: 2 }),
      status: overrides.status ?? 'ACTIVE',
      veg: overrides.veg ?? true,
      bestseller: overrides.bestseller ?? false,
      branchIds: overrides.branchIds ?? [],
    },
  });
}
