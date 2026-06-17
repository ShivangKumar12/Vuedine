import { blindIndex, decrypt, encrypt } from '../../../src/utils/crypto.js';

describe('crypto utils', () => {
  describe('encrypt / decrypt round-trip', () => {
    test.each([['hello'], [''], ['ünîcödé 🍔🍕'], ['a'.repeat(1000)], ['1234-5678-9012-3456']])(
      'round-trips %j',
      (plain) => {
        const ct = encrypt(plain);
        expect(typeof ct).toBe('string');
        expect(decrypt(ct)).toBe(plain);
      },
    );

    test('null and undefined pass through', () => {
      expect(encrypt(null)).toBeNull();
      expect(encrypt(undefined)).toBeNull();
      expect(decrypt(null)).toBeNull();
      expect(decrypt(undefined)).toBeNull();
    });

    test('produces different ciphertext for the same plaintext (random IV)', () => {
      const a = encrypt('same');
      const b = encrypt('same');
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe('same');
      expect(decrypt(b)).toBe('same');
    });
  });

  describe('tamper detection', () => {
    test('flipping a byte in the auth tag fails verification', () => {
      const ct = encrypt('sensitive');
      const buf = Buffer.from(ct, 'base64');
      buf[16] ^= 0x80; // mid-tag
      expect(() => decrypt(buf.toString('base64'))).toThrow();
    });

    test('truncated ciphertext throws', () => {
      expect(() => decrypt('YWJj')).toThrow(/too short/i);
    });

    test('unknown version byte rejected', () => {
      const ct = encrypt('x');
      const buf = Buffer.from(ct, 'base64');
      buf[0] = 0x99;
      expect(() => decrypt(buf.toString('base64'))).toThrow(/version/i);
    });
  });

  describe('blindIndex', () => {
    test('deterministic for same input', () => {
      expect(blindIndex('foo')).toBe(blindIndex('foo'));
    });

    test('different for different inputs', () => {
      expect(blindIndex('foo')).not.toBe(blindIndex('bar'));
    });

    test('null pass-through', () => {
      expect(blindIndex(null)).toBeNull();
    });
  });
});
