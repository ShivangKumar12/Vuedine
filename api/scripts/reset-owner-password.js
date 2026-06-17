// Helper: force-reset the demo owner password back to the seed value.
// Used to recover after a test run mutates state.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const hash = await bcrypt.hash('vuedine123', 10);
const result = await prisma.user.updateMany({
  where: { email: 'owner@vuedine.demo' },
  data: { passwordHash: hash, lockedUntil: null, failedLoginCount: 0 },
});

// eslint-disable-next-line no-console
console.log(`reset password on ${result.count} row(s)`);

await prisma.$disconnect();
