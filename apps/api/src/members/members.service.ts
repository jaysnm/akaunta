import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service.js';
import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { balanceOfAccount } from '../db/ledger.repo.js';
import { ledgerEntries, loans, meetingAttendance, meetings, members } from '../db/schema.js';

@Injectable()
export class MembersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(
    groupId: string,
    actor: string,
    input: { name: string; phone?: string; email?: string },
  ) {
    const [member] = await this.db
      .insert(members)
      .values({ groupId, ...input })
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'member.created',
      entity: `member:${member!.id}`,
      after: member,
    });
    return member;
  }

  async list(groupId: string) {
    const rows = await this.db.select().from(members).where(eq(members.groupId, groupId));
    return Promise.all(
      rows.map(async (m) => ({
        ...m,
        // Contributions credit the group wallet and debit this account, so it reads negative — negate for display.
        contributedCents: -(await balanceOfAccount(
          this.db,
          groupId,
          `income:contributions:${m.id}`,
        )),
      })),
    );
  }

  private async getOwned(groupId: string, memberId: string) {
    const [member] = await this.db.select().from(members).where(eq(members.id, memberId));
    if (!member || member.groupId !== groupId) throw new NotFoundException('Member not found');
    return member;
  }

  /**
   * The "My Data" export from the plan's Data Protection & Privacy section —
   * every record this member's identity touches, as one portable bundle.
   */
  async exportData(groupId: string, memberId: string) {
    const member = await this.getOwned(groupId, memberId);
    const memberLoans = await this.db.select().from(loans).where(eq(loans.memberId, memberId));
    const ledger = await this.db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.account, `income:contributions:${memberId}`));
    const attendance = await this.db
      .select({
        meetingId: meetingAttendance.meetingId,
        status: meetingAttendance.status,
        meetingTitle: meetings.title,
        scheduledAt: meetings.scheduledAt,
      })
      .from(meetingAttendance)
      .innerJoin(meetings, eq(meetings.id, meetingAttendance.meetingId))
      .where(eq(meetingAttendance.memberId, memberId));

    return { member, loans: memberLoans, contributions: ledger, meetingAttendance: attendance };
  }

  /**
   * Erasure request, resolved as anonymization, not deletion — financial
   * ledger rows stay (keyed to this member's id, not their name/phone/email)
   * so the books still reconcile, but identifying fields are redacted. See
   * the plan's "Erasure vs. retention" rule.
   */
  async anonymize(groupId: string, actor: string, memberId: string) {
    const member = await this.getOwned(groupId, memberId);
    if (member.anonymizedAt) return member;

    const [updated] = await this.db
      .update(members)
      .set({
        name: `Former member ${member.id.slice(0, 8)}`,
        phone: null,
        email: null,
        anonymizedAt: new Date(),
      })
      .where(eq(members.id, memberId))
      .returning();

    await this.audit.record({
      groupId,
      actor,
      action: 'member.anonymized',
      entity: `member:${memberId}`,
      before: { name: member.name, phone: member.phone, email: member.email },
      after: { name: updated!.name },
    });
    return updated;
  }
}
