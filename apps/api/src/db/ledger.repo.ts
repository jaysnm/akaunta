import type { Transaction } from '@akaunta/domain';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { ledgerEntries } from './schema.js';

/** Persists a @akaunta/domain Transaction as rows sharing one txnId. */
export function persistTransaction(db: Database, groupId: string, tx: Transaction) {
  return db.insert(ledgerEntries).values(
    tx.entries.map((e) => ({
      groupId,
      txnId: tx.id,
      account: e.account,
      amountCents: e.amountCents,
      memo: tx.memo,
      postedAt: tx.postedAt,
    })),
  );
}

/** Derived, never stored directly — sums every row posted to one account. */
export async function balanceOfAccount(
  db: Database,
  groupId: string,
  account: string,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountCents}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.groupId, groupId), eq(ledgerEntries.account, account)));
  return Number(row?.total ?? 0);
}
