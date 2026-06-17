import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';

import { env } from '../../src/config/index.js';
import { getPrisma } from '../helpers/test-db.js';

/**
 * Create a user, hashed-password and all.
 *
 *   const u = await makeUser({ role: 'OWNER', tenantId, password: 'pass1234' });
 *
 * The plaintext password is exposed via `u._plain.password` so tests can
 * actually log in as the user without re-deriving the hash.
 */
export async function makeUser(overrides = {}) {
  const prisma = getPrisma();
  const password = overrides.password ?? 'pass1234';
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);

  const data = {
    email: (overrides.email ?? faker.internet.email()).toLowerCase(),
    name: overrides.name ?? faker.person.fullName(),
    passwordHash,
    role: overrides.role ?? 'CASHIER',
    status: overrides.status ?? 'ACTIVE',
    tenantId: overrides.tenantId ?? null,
    branchIds: overrides.branchIds ?? [],
    emailVerifiedAt: overrides.emailVerifiedAt ?? new Date(),
  };

  const user = await prisma.user.create({ data });
  user._plain = { password };
  return user;
}
