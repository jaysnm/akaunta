import {
  applyPenalty,
  calculatePenalty,
  disburseLoan,
  generateSchedule,
  type PenaltyRule,
  recordRepayment,
  waivePenalty,
} from '@akaunta/domain';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service.js';
import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { persistTransaction } from '../db/ledger.repo.js';
import { installments, loanProducts, loans } from '../db/schema.js';

@Injectable()
export class LoansService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  createProduct(
    groupId: string,
    input: { name: string; annualRatePct: number; termMonths: number; method: 'flat' | 'reducing' },
  ) {
    return this.db
      .insert(loanProducts)
      .values({ groupId, ...input })
      .returning()
      .then(([p]) => p);
  }

  listProducts(groupId: string) {
    return this.db.select().from(loanProducts).where(eq(loanProducts.groupId, groupId));
  }

  async disburse(
    groupId: string,
    actor: string,
    input: { memberId: string; productId: string; principalCents: number },
  ) {
    const [product] = await this.db
      .select()
      .from(loanProducts)
      .where(eq(loanProducts.id, input.productId));
    if (!product || product.groupId !== groupId)
      throw new NotFoundException('Loan product not found');

    const disbursedAt = new Date();
    const [loan] = await this.db
      .insert(loans)
      .values({
        groupId,
        memberId: input.memberId,
        productId: product.id,
        principalCents: input.principalCents,
        disbursedAt,
      })
      .returning();

    const schedule = generateSchedule(
      {
        principalCents: input.principalCents,
        annualRatePct: product.annualRatePct,
        termMonths: product.termMonths,
        method: product.method,
      },
      disbursedAt,
    );
    await this.db.insert(installments).values(schedule.map((i) => ({ loanId: loan!.id, ...i })));

    const tx = disburseLoan(`wallet:${groupId}`, loan!.id, input.principalCents);
    await persistTransaction(this.db, groupId, tx);
    await this.audit.record({
      groupId,
      actor,
      action: 'loan.disbursed',
      entity: `loan:${loan!.id}`,
      after: { loan, schedule },
    });
    return { ...loan!, schedule };
  }

  async get(groupId: string, loanId: string) {
    const [loan] = await this.db.select().from(loans).where(eq(loans.id, loanId));
    if (!loan || loan.groupId !== groupId) throw new NotFoundException('Loan not found');
    const schedule = await this.db
      .select()
      .from(installments)
      .where(eq(installments.loanId, loanId))
      .orderBy(installments.period);
    return { ...loan, schedule };
  }

  list(groupId: string) {
    return this.db.select().from(loans).where(eq(loans.groupId, groupId));
  }

  /** Applies a payment against the oldest unpaid installment(s), oldest first. */
  async repay(groupId: string, actor: string, loanId: string, amountCents: number) {
    const loan = await this.get(groupId, loanId);
    let remaining = amountCents;

    for (const installment of loan.schedule) {
      if (remaining <= 0) break;
      const owed = installment.totalCents - installment.paidCents;
      if (owed <= 0) continue;

      const applied = Math.min(owed, remaining);
      remaining -= applied;
      const paidCents = installment.paidCents + applied;
      const status = paidCents >= installment.totalCents ? 'paid' : 'partial';
      await this.db
        .update(installments)
        .set({ paidCents, status })
        .where(eq(installments.id, installment.id));
    }

    const tx = recordRepayment(`wallet:${groupId}`, loanId, amountCents - remaining);
    await persistTransaction(this.db, groupId, tx);
    await this.audit.record({
      groupId,
      actor,
      action: 'loan.repayment',
      entity: `loan:${loanId}`,
      after: tx,
    });
    if (remaining > 0) {
      // Overpayment beyond what's owed — still posted to the ledger above, just flagged here for visibility.
      return { ...tx, unappliedCents: remaining };
    }
    return tx;
  }

  async penalize(
    groupId: string,
    actor: string,
    loanId: string,
    installmentId: string,
    rule: PenaltyRule,
  ) {
    const loan = await this.get(groupId, loanId);
    const installment = loan.schedule.find((i) => i.id === installmentId);
    if (!installment) throw new BadRequestException('Installment not found on this loan');

    const amountCents = calculatePenalty(installment, rule);
    const tx = applyPenalty(loanId, amountCents);
    await persistTransaction(this.db, groupId, tx);
    await this.audit.record({
      groupId,
      actor,
      action: 'loan.penalty_applied',
      entity: `loan:${loanId}`,
      after: { installmentId, amountCents },
    });
    return tx;
  }

  async waive(groupId: string, actor: string, loanId: string, amountCents: number, reason: string) {
    const tx = waivePenalty(loanId, amountCents);
    await persistTransaction(this.db, groupId, tx);
    await this.audit.record({
      groupId,
      actor,
      action: 'loan.penalty_waived',
      entity: `loan:${loanId}`,
      after: { amountCents, reason },
    });
    return tx;
  }
}
