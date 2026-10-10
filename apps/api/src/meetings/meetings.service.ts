import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service.js';
import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { meetingAttendance, meetings, resolutions } from '../db/schema.js';

@Injectable()
export class MeetingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async schedule(
    groupId: string,
    actor: string,
    input: { title: string; scheduledAt: Date; location?: string; agenda?: string },
  ) {
    const [meeting] = await this.db
      .insert(meetings)
      .values({ groupId, ...input })
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'meeting.scheduled',
      entity: `meeting:${meeting!.id}`,
      after: meeting,
    });
    return meeting;
  }

  list(groupId: string) {
    return this.db
      .select()
      .from(meetings)
      .where(eq(meetings.groupId, groupId))
      .orderBy(meetings.scheduledAt);
  }

  async get(groupId: string, meetingId: string) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId));
    if (!meeting || meeting.groupId !== groupId) throw new NotFoundException('Meeting not found');
    const attendance = await this.db
      .select()
      .from(meetingAttendance)
      .where(eq(meetingAttendance.meetingId, meetingId));
    const meetingResolutions = await this.db
      .select()
      .from(resolutions)
      .where(eq(resolutions.meetingId, meetingId));
    return { ...meeting, attendance, resolutions: meetingResolutions };
  }

  async recordAttendance(
    groupId: string,
    actor: string,
    meetingId: string,
    entries: { memberId: string; status: 'present' | 'absent' | 'excused' }[],
  ) {
    await this.get(groupId, meetingId);
    await this.db.delete(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId));
    const rows =
      entries.length > 0
        ? await this.db
            .insert(meetingAttendance)
            .values(entries.map((e) => ({ meetingId, ...e })))
            .returning()
        : [];
    await this.audit.record({
      groupId,
      actor,
      action: 'meeting.attendance_recorded',
      entity: `meeting:${meetingId}`,
      after: rows,
    });
    return rows;
  }

  async addResolution(
    groupId: string,
    actor: string,
    meetingId: string,
    input: { text: string; status: 'passed' | 'rejected' | 'deferred' },
  ) {
    await this.get(groupId, meetingId);
    const [resolution] = await this.db
      .insert(resolutions)
      .values({ meetingId, ...input })
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'meeting.resolution_recorded',
      entity: `meeting:${meetingId}`,
      after: resolution,
    });
    return resolution;
  }

  async complete(groupId: string, actor: string, meetingId: string, minutes: string) {
    await this.get(groupId, meetingId);
    const [meeting] = await this.db
      .update(meetings)
      .set({ minutes, status: 'completed' })
      .where(eq(meetings.id, meetingId))
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'meeting.completed',
      entity: `meeting:${meetingId}`,
      after: meeting,
    });
    return meeting;
  }
}
