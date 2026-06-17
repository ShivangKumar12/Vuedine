import { describe, expect, test } from '@jest/globals';

import { canTransition, nextStatus } from '../../../../src/modules/orders/order-state.js';

describe('Order state machine', () => {
  test('happy path dine-in', () => {
    expect(canTransition('PENDING', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'READY')).toBe(true);
    expect(canTransition('READY', 'SERVED')).toBe(true);
  });

  test('happy path delivery', () => {
    expect(canTransition('READY', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransition('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });

  test('cancellable from any pre-terminal', () => {
    for (const s of ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']) {
      expect(canTransition(s, 'CANCELLED')).toBe(true);
    }
  });

  test('terminal states reject any transition', () => {
    expect(canTransition('SERVED', 'PREPARING')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
  });

  test('skipping states forbidden', () => {
    expect(canTransition('PENDING', 'PREPARING')).toBe(false);
    expect(canTransition('PENDING', 'SERVED')).toBe(false);
  });

  test('READY → PREPARING is a valid recall', () => {
    expect(canTransition('READY', 'PREPARING')).toBe(true);
  });

  test('nextStatus picks delivery branch correctly', () => {
    expect(nextStatus({ status: 'READY', type: 'DINE_IN' })).toBe('SERVED');
    expect(nextStatus({ status: 'READY', type: 'TAKEAWAY' })).toBe('SERVED');
    expect(nextStatus({ status: 'READY', type: 'DELIVERY' })).toBe('OUT_FOR_DELIVERY');
    expect(nextStatus({ status: 'OUT_FOR_DELIVERY', type: 'DELIVERY' })).toBe('DELIVERED');
    expect(nextStatus({ status: 'SERVED', type: 'DINE_IN' })).toBeNull();
  });
});
