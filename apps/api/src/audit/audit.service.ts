import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { auditLog } from '../db/schema.js';

/** Insert-only, hash-chained per group — see the plan's Audit Logging section. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: {
    groupId: string;
    actor: string;
    action: string;
    entity: string;
    before?: unknown;
    after?: unknown;
  }): Promise<void> {
    const [last] = await this.db
      .select({ hash: auditLog.hash })
      .from(auditLog)
      .where(eq(auditLog.groupId, entry.groupId))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);

    const prevHash = last?.hash ?? null;
    // Hashed on the normalized (before/after defaulted to null) shape, not the
    // raw entry — otherwise an omitted `before` hashes differently than a
    // stored null and verifyChain can never reproduce it from the DB row.
    const before = entry.before ?? null;
    const after = entry.after ?? null;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          groupId: entry.groupId,
          actor: entry.actor,
          action: entry.action,
          entity: entry.entity,
          before,
          after,
          prevHash,
        }),
      )
      .digest('hex');

    await this.db.insert(auditLog).values({
      ...entry,
      before,
      after,
      prevHash,
      hash,
    });
  }

  /**
   * Recomputes every row's hash from its recorded fields and prevHash, in
   * insertion order, and compares it against what's stored. A mismatch, or a
   * prevHash that doesn't match the prior row's hash, means a row was edited
   * or deleted outside the application after being written.
   */
  async verifyChain(groupId: string): Promise<{ ok: boolean; brokenAt: string | null }> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.groupId, groupId))
      .orderBy(asc(auditLog.createdAt));

    let expectedPrevHash: string | null = null;
    for (const row of rows) {
      if (row.prevHash !== expectedPrevHash) return { ok: false, brokenAt: row.id };
      const recomputed: string = createHash('sha256')
        .update(
          JSON.stringify({
            groupId: row.groupId,
            actor: row.actor,
            action: row.action,
            entity: row.entity,
            before: row.before,
            after: row.after,
            prevHash: row.prevHash,
          }),
        )
        .digest('hex');
      if (recomputed !== row.hash) return { ok: false, brokenAt: row.id };
      expectedPrevHash = row.hash;
    }
    return { ok: true, brokenAt: null };
  }
}
