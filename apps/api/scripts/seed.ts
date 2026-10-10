/**
 * Populates realistic test data against a running database — not via HTTP,
 * so it also works before auth/members exist to call the API with. Safe to
 * re-run: it always creates a fresh group, so nothing collides.
 *
 * Usage: pnpm --filter @akaunta/api run seed
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculatePenalty, generateSchedule } from '@akaunta/domain';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { eq } from 'drizzle-orm';

const here = path.dirname(fileURLToPath(import.meta.url));
expand(config({ path: path.resolve(here, '../../../.env'), quiet: true }));

const { createDb } = await import('../src/db/client.js');
const { groups, users, members, loanProducts, loans, installments } =
  await import('../src/db/schema.js');
const { hashPassword } = await import('../src/auth/password.js');
const { persistTransaction } = await import('../src/db/ledger.repo.js');
const domain = await import('@akaunta/domain');

const db = createDb(process.env.DATABASE_URL!);

const [group] = await db.insert(groups).values({ name: 'Jirani Welfare Group' }).returning();
const groupId = group!.id;

const [admin] = await db
  .insert(users)
  .values({
    groupId,
    email: 'treasurer@jirani.test',
    passwordHash: hashPassword('change-me'),
    role: 'treasurer',
  })
  .returning();

const memberRows = await db
  .insert(members)
  .values([
    { groupId, name: 'Amina Hassan', phone: '+254700111111', email: 'amina@example.com' },
    { groupId, name: 'Brian Otieno', phone: '+254700222222', email: 'brian@example.com' },
    { groupId, name: 'Grace Wanjiru', phone: '+254700333333', email: 'grace@example.com' },
  ])
  .returning();

// Contributions: each member puts something into the group wallet.
for (const [member, amountCents] of [
  [memberRows[0], 500_00],
  [memberRows[1], 300_00],
  [memberRows[2], 800_00],
] as const) {
  const tx = domain.recordContribution(`wallet:${groupId}`, member!.id, amountCents);
  await persistTransaction(db, groupId, tx);
}

const [product] = await db
  .insert(loanProducts)
  .values({ groupId, name: 'Emergency loan', annualRatePct: 12, termMonths: 3, method: 'reducing' })
  .returning();

// Disburse a loan to Brian, then part-pay it, then apply and waive a penalty.
const borrower = memberRows[1]!;
const principalCents = 100_000;
const disbursedAt = new Date();
const [loan] = await db
  .insert(loans)
  .values({ groupId, memberId: borrower.id, productId: product!.id, principalCents, disbursedAt })
  .returning();

const schedule = generateSchedule(
  {
    principalCents,
    annualRatePct: product!.annualRatePct,
    termMonths: product!.termMonths,
    method: product!.method,
  },
  disbursedAt,
);
const installmentRows = await db
  .insert(installments)
  .values(schedule.map((i) => ({ loanId: loan!.id, ...i })))
  .returning();

await persistTransaction(
  db,
  groupId,
  domain.disburseLoan(`wallet:${groupId}`, loan!.id, principalCents),
);

const firstInstallment = installmentRows[0]!;
await db
  .update(installments)
  .set({ paidCents: firstInstallment.totalCents, status: 'paid' })
  .where(eq(installments.id, firstInstallment.id));
await persistTransaction(
  db,
  groupId,
  domain.recordRepayment(`wallet:${groupId}`, loan!.id, firstInstallment.totalCents),
);

const penaltyCents = calculatePenalty(firstInstallment, { type: 'flat', amountCents: 500 });
await persistTransaction(db, groupId, domain.applyPenalty(loan!.id, penaltyCents));
await persistTransaction(db, groupId, domain.waivePenalty(loan!.id, penaltyCents));

console.log('Seeded group:', groupId);
console.log(`Login with: ${admin!.email} / change-me`);
console.log(
  'Members:',
  memberRows.map((m) => m.id),
);
console.log('Loan:', loan!.id);
process.exit(0);
