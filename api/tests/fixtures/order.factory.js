import { faker } from '@faker-js/faker';

import { getPrisma } from '../helpers/test-db.js';

/**
 * Order factory.
 *
 *   const order = await makeOrder({ tenantId, branchId, status: 'PENDING' });
 *
 * Mints a minimal order + 2 line items so tests don't need to repeat the
 * boilerplate. State machine + pricing maths are exercised through the
 * service tests, so this factory bypasses the service layer.
 */
export async function makeOrder(overrides = {}) {
  const prisma = getPrisma();
  if (!overrides.tenantId) throw new Error('makeOrder: tenantId required');
  if (!overrides.branchId) throw new Error('makeOrder: branchId required');

  const serial = overrides.serial ?? `TST-${faker.string.numeric(4)}`;
  const token = overrides.token ?? `TKN-${faker.string.numeric(3)}`;

  return prisma.order.create({
    data: {
      tenantId: overrides.tenantId,
      branchId: overrides.branchId,
      serial,
      token,
      type: overrides.type ?? 'DINE_IN',
      channel: overrides.channel ?? 'POS',
      source: overrides.source ?? 'POS',
      station: overrides.station ?? 'HOT',
      status: overrides.status ?? 'PENDING',
      tableLabel: overrides.tableLabel ?? 'Table 1',
      tableId: overrides.tableId ?? null,
      sessionId: overrides.sessionId ?? null,
      subtotal: overrides.subtotal ?? 10,
      taxTotal: overrides.taxTotal ?? 0.5,
      grandTotal: overrides.grandTotal ?? 10.5,
      paymentMode: overrides.paymentMode ?? 'PAY_LATER',
      items: {
        create: overrides.items ?? [
          {
            itemName: 'Test Pizza',
            qty: 1,
            unitPrice: 5,
            lineTotal: 5,
            station: 'HOT',
          },
          {
            itemName: 'Test Drink',
            qty: 1,
            unitPrice: 5,
            lineTotal: 5,
            station: 'BAR',
          },
        ],
      },
    },
    include: { items: true, events: true },
  });
}
