import { recordContribution } from '@akaunta/domain';
import { Inject, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { balanceOfAccount, persistTransaction } from '../db/ledger.repo.js';

@Injectable()
export class WalletService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async contribute(groupId: string, actor: string, memberId: string, amountCents: number) {
    const tx = recordContribution(`wallet:${groupId}`, memberId, amountCents);
    await persistTransaction(this.db, groupId, tx);
    await this.audit.record({
      groupId,
      actor,
      action: 'contribution.recorded',
      entity: `member:${memberId}`,
      after: tx,
    });
    return tx;
  }

  balance(groupId: string) {
    return balanceOfAccount(this.db, groupId, `wallet:${groupId}`).then((balanceCents) => ({
      balanceCents,
    }));
  }
}
