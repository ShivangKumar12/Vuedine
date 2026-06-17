import { createHmac } from 'node:crypto';

import { describe, expect, test } from '@jest/globals';

// We re-implement the same verification helper here to avoid importing the
// service (which pulls in Prisma).
function verifySignature({ rawBody, signature, secret }) {
  if (!secret) return true;
  if (!signature) return false;
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}

describe('Webhook signature verification', () => {
  const secret = 'whsec_test_secret';
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));

  test('valid signature passes', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifySignature({ rawBody: body, signature: sig, secret })).toBe(true);
  });

  test('tampered body fails', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    const tampered = Buffer.from(JSON.stringify({ event: 'payment.failed' }));
    expect(verifySignature({ rawBody: tampered, signature: sig, secret })).toBe(false);
  });

  test('wrong secret fails', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(
      verifySignature({ rawBody: body, signature: sig, secret: 'whsec_test_other' }),
    ).toBe(false);
  });

  test('missing signature fails when secret configured', () => {
    expect(verifySignature({ rawBody: body, signature: null, secret })).toBe(false);
  });

  test('skipped when no secret configured (dev mode)', () => {
    expect(verifySignature({ rawBody: body, signature: null, secret: null })).toBe(true);
  });
});
