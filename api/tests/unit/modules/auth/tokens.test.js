import { tokens } from '../../../../src/modules/auth/tokens.js';

/**
 * tokens.js is pure (env-bound but no DB/Redis). These tests run in <50ms
 * and never touch the lifecycle hooks in setup.js — but the hooks still run,
 * which is fine: a no-op truncate is cheap.
 */
describe('tokens', () => {
  describe('newRefreshToken', () => {
    test('returns a base64url string and matching sha256 hash', () => {
      const { raw, hash } = tokens.newRefreshToken();
      // 32 random bytes → 43 base64url chars (no padding, no + or /)
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(tokens.hashRefresh(raw)).toBe(hash);
    });

    test('produces different tokens on each call', () => {
      const a = tokens.newRefreshToken();
      const b = tokens.newRefreshToken();
      expect(a.raw).not.toBe(b.raw);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe('signAccess + verifyAccess', () => {
    test('round-trips identity and role payload', () => {
      const user = {
        id: 'u_test1',
        tenantId: 't_test1',
        role: 'OWNER',
        branchIds: ['b1', 'b2'],
      };
      const token = tokens.signAccess(user);
      const payload = tokens.verifyAccess(token);
      expect(payload).toMatchObject({
        sub: 'u_test1',
        tid: 't_test1',
        role: 'OWNER',
        branchIds: ['b1', 'b2'],
      });
    });

    test('null tenantId is preserved (platform staff)', () => {
      const token = tokens.signAccess({
        id: 'admin1',
        tenantId: null,
        role: 'SUPER_ADMIN',
        branchIds: [],
      });
      const payload = tokens.verifyAccess(token);
      expect(payload.tid).toBeNull();
      expect(payload.role).toBe('SUPER_ADMIN');
    });

    test('rejects a tampered token', () => {
      const token = tokens.signAccess({
        id: 'u1',
        tenantId: null,
        role: 'CASHIER',
        branchIds: [],
      });
      const tampered = `${token.slice(0, -4)}AAAA`;
      expect(() => tokens.verifyAccess(tampered)).toThrow();
    });

    test('rejects a token signed with a different secret', () => {
      // Build a JWT with a wrong secret — easiest way: use jsonwebtoken directly.
      // Even simpler: replace the signature segment.
      const good = tokens.signAccess({
        id: 'u1',
        tenantId: null,
        role: 'CASHIER',
        branchIds: [],
      });
      const [h, p] = good.split('.');
      const bad = `${h}.${p}.0123456789abcdef0123456789abcdef0123456789abcdef`;
      expect(() => tokens.verifyAccess(bad)).toThrow();
    });
  });

  describe('refreshCookieOptions', () => {
    test('marks Secure only in production', () => {
      const dev = tokens.refreshCookieOptions(false);
      const prod = tokens.refreshCookieOptions(true);
      expect(dev).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/v1/auth',
      });
      expect(prod.secure).toBe(true);
      expect(typeof prod.maxAge).toBe('number');
    });
  });
});
