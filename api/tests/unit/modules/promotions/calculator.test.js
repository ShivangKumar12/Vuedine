import { describe, expect, test } from '@jest/globals';

import {
  checkEligibility,
  computePromotionDiscount,
} from '../../../../src/modules/promotions/promotion-calculator.js';

const base = {
  status: 'ACTIVE',
  startsAt: new Date(Date.now() - 86400000),
  endsAt: new Date(Date.now() + 86400000),
  minOrder: 0,
  usageLimit: 0,
  used: 0,
  channels: [],
  days: [],
  scope: 'WHOLE_ORDER',
  targetItemIds: [],
  targetCategories: [],
  maxDiscount: null,
};

const pizza = { itemId: 'p1', category: 'Pizza', qty: 2, unitPrice: 10 };
const drink = { itemId: 'd1', category: 'Cocktails', qty: 1, unitPrice: 5 };

describe('computePromotionDiscount', () => {
  test('PERCENTAGE applies value% capped by maxDiscount', () => {
    const promo = { ...base, kind: 'PERCENTAGE', value: 20, maxDiscount: 3 };
    const d = computePromotionDiscount(promo, { lines: [pizza, drink], subtotal: 25 });
    expect(d).toBe(3); // 20% of 25 = 5, capped at 3
  });

  test('PERCENTAGE without cap', () => {
    const promo = { ...base, kind: 'PERCENTAGE', value: 10 };
    const d = computePromotionDiscount(promo, { lines: [pizza, drink], subtotal: 25 });
    expect(d).toBe(2.5);
  });

  test('FLAT never exceeds base', () => {
    const promo = { ...base, kind: 'FLAT', value: 100 };
    const d = computePromotionDiscount(promo, { lines: [drink], subtotal: 5 });
    expect(d).toBe(5);
  });

  test('BOGO frees the cheaper of each pair (scoped to Pizza)', () => {
    // 2 pizzas @ 10 → one free = 10 discount
    const promo = { ...base, kind: 'BOGO', value: 100, scope: 'CATEGORIES', targetCategories: ['Pizza'] };
    const d = computePromotionDiscount(promo, { lines: [pizza, drink], subtotal: 25 });
    expect(d).toBe(10);
  });

  test('FREE_ITEM frees one cheapest scoped unit', () => {
    const promo = { ...base, kind: 'FREE_ITEM', value: 0 };
    const d = computePromotionDiscount(promo, { lines: [pizza, drink], subtotal: 25 });
    expect(d).toBe(5); // cheapest unit (drink @5)
  });

  test('COMBO discounts down to the bundle price', () => {
    const promo = { ...base, kind: 'COMBO', value: 20 };
    const d = computePromotionDiscount(promo, { lines: [pizza, drink], subtotal: 25 });
    expect(d).toBe(5); // 25 - 20
  });

  test('discount clamps to base (never negative total)', () => {
    const promo = { ...base, kind: 'FLAT', value: 999 };
    const d = computePromotionDiscount(promo, { lines: [drink], subtotal: 5 });
    expect(d).toBeLessThanOrEqual(5);
  });
});

describe('checkEligibility', () => {
  test('min order gate', () => {
    const promo = { ...base, kind: 'FLAT', value: 5, minOrder: 50 };
    const r = checkEligibility(promo, { subtotal: 25, lines: [pizza, drink] });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('PROMO_MIN_ORDER_NOT_MET');
  });

  test('usage limit gate', () => {
    const promo = { ...base, kind: 'FLAT', value: 5, usageLimit: 10, used: 10 };
    const r = checkEligibility(promo, { subtotal: 25, lines: [pizza, drink] });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('PROMO_USAGE_LIMIT_REACHED');
  });

  test('channel gate', () => {
    const promo = { ...base, kind: 'FLAT', value: 5, channels: ['Online'] };
    const r = checkEligibility(promo, { subtotal: 25, lines: [pizza], channel: 'POS' });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('PROMO_CHANNEL_NOT_ALLOWED');
  });

  test('happy-hour time gating', () => {
    const promo = {
      ...base,
      kind: 'PERCENTAGE',
      value: 30,
      startTime: '17:00',
      endTime: '19:00',
    };
    const before = new Date();
    before.setHours(10, 0, 0, 0);
    const during = new Date();
    during.setHours(18, 0, 0, 0);
    expect(checkEligibility(promo, { subtotal: 25, lines: [drink], now: before }).eligible).toBe(false);
    expect(checkEligibility(promo, { subtotal: 25, lines: [drink], now: during }).eligible).toBe(true);
  });

  test('scope with no matching items is ineligible', () => {
    const promo = { ...base, kind: 'PERCENTAGE', value: 10, scope: 'CATEGORIES', targetCategories: ['Sushi'] };
    const r = checkEligibility(promo, { subtotal: 25, lines: [pizza, drink] });
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe('PROMO_NO_MATCHING_ITEMS');
  });

  test('all gates pass', () => {
    const promo = { ...base, kind: 'PERCENTAGE', value: 10, channels: ['POS'] };
    const r = checkEligibility(promo, { subtotal: 25, lines: [pizza], channel: 'POS' });
    expect(r.eligible).toBe(true);
  });
});
