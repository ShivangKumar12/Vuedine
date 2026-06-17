import { describe, expect, test } from '@jest/globals';

import { calculateOrder } from '../../../../src/modules/orders/order-calculator.js';

describe('calculateOrder', () => {
  const branch = { taxInclusive: false, serviceCharge: 5 }; // 5% service
  const taxConfig = { slabs: [{ name: 'GST 5%', rate: 0.05 }] };

  test('returns zero envelope for empty cart', () => {
    const r = calculateOrder({ lines: [], branch, tenantTaxConfig: taxConfig });
    expect(r.subtotal).toBe(0);
    expect(r.grandTotal).toBe(0);
    expect(r.lines).toHaveLength(0);
  });

  test('basic subtotal + tax + service', () => {
    const r = calculateOrder({
      lines: [
        { qty: 2, unitPrice: 4.5, itemName: 'Margherita', category: 'Pizza' },
      ],
      branch,
      tenantTaxConfig: taxConfig,
    });
    expect(r.subtotal).toBe(9);
    expect(r.taxTotal).toBe(0.45); // 5%
    expect(r.serviceTotal).toBe(0.45); // 5%
    expect(r.grandTotal).toBe(9.9);
  });

  test('promo discount caps + applies before tax', () => {
    const r = calculateOrder({
      lines: [{ qty: 10, unitPrice: 5, itemName: 'X' }],
      branch,
      tenantTaxConfig: taxConfig,
      promoCode: 'WELCOME10',
    });
    expect(r.subtotal).toBe(50);
    // 10% off capped at $5 → $5 discount
    expect(r.discountTotal).toBe(5);
    expect(r.taxTotal).toBeCloseTo((50 - 5) * 0.05, 2);
  });

  test('manual discount % applies', () => {
    const r = calculateOrder({
      lines: [{ qty: 1, unitPrice: 100, itemName: 'X' }],
      branch,
      tenantTaxConfig: taxConfig,
      discountPct: 10,
    });
    expect(r.discountTotal).toBe(10);
    expect(r.subtotal).toBe(100);
  });

  test('tip percentage applies on taxable + tax + service', () => {
    const r = calculateOrder({
      lines: [{ qty: 1, unitPrice: 100, itemName: 'X' }],
      branch,
      tenantTaxConfig: taxConfig,
      tipPct: 10,
    });
    // taxable=100, tax=5, service=5, base=110, tip=11
    expect(r.tipTotal).toBe(11);
    expect(r.grandTotal).toBe(121);
  });

  test('public flow caps promo at $2', () => {
    const r = calculateOrder({
      lines: [{ qty: 10, unitPrice: 5, itemName: 'X' }],
      branch,
      tenantTaxConfig: taxConfig,
      promoCode: 'WELCOME10',
      isPublic: true,
    });
    expect(r.discountTotal).toBe(2);
  });

  test('tax-inclusive branch reverse-engineers tax', () => {
    const r = calculateOrder({
      lines: [{ qty: 1, unitPrice: 105, itemName: 'X' }],
      branch: { taxInclusive: true, serviceCharge: 0 },
      tenantTaxConfig: taxConfig,
    });
    expect(r.subtotal).toBe(105);
    expect(r.taxTotal).toBeCloseTo(5, 2); // 105 - (105/1.05)
    expect(r.grandTotal).toBe(105); // tax already inside
  });
});
