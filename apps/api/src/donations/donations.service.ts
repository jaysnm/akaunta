import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { AuditService } from '../audit/audit.service.js';
import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { donations, projectExpenses, projects } from '../db/schema.js';

@Injectable()
export class DonationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async record(
    groupId: string,
    actor: string,
    input: {
      donorName: string;
      donorContact?: string;
      amountCents: number;
      method: 'cash' | 'mobile_money' | 'bank' | 'in_kind';
      purpose?: string;
      projectId?: string;
    },
  ) {
    const [donation] = await this.db
      .insert(donations)
      .values({ groupId, ...input })
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'donation.recorded',
      entity: `donation:${donation!.id}`,
      after: donation,
    });
    return donation;
  }

  list(groupId: string) {
    return this.db
      .select()
      .from(donations)
      .where(eq(donations.groupId, groupId))
      .orderBy(donations.receivedAt);
  }

  async createProject(
    groupId: string,
    actor: string,
    input: { name: string; description?: string; budgetCents: number },
  ) {
    const [project] = await this.db
      .insert(projects)
      .values({ groupId, ...input })
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'project.created',
      entity: `project:${project!.id}`,
      after: project,
    });
    return project;
  }

  async listProjects(groupId: string) {
    const rows = await this.db.select().from(projects).where(eq(projects.groupId, groupId));
    return Promise.all(
      rows.map(async (p) => {
        const [spent] = await this.db
          .select({ total: sql<string>`coalesce(sum(${projectExpenses.amountCents}), 0)` })
          .from(projectExpenses)
          .where(eq(projectExpenses.projectId, p.id));
        const [raised] = await this.db
          .select({ total: sql<string>`coalesce(sum(${donations.amountCents}), 0)` })
          .from(donations)
          .where(eq(donations.projectId, p.id));
        return {
          ...p,
          spentCents: Number(spent?.total ?? 0),
          raisedCents: Number(raised?.total ?? 0),
        };
      }),
    );
  }

  async addExpense(
    groupId: string,
    actor: string,
    projectId: string,
    input: { description: string; amountCents: number },
  ) {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId));
    if (!project || project.groupId !== groupId) throw new NotFoundException('Project not found');
    const [expense] = await this.db
      .insert(projectExpenses)
      .values({ projectId, ...input })
      .returning();
    await this.audit.record({
      groupId,
      actor,
      action: 'project.expense_recorded',
      entity: `project:${projectId}`,
      after: expense,
    });
    return expense;
  }

  async getProject(groupId: string, projectId: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.groupId, groupId)));
    if (!project) throw new NotFoundException('Project not found');
    const expenses = await this.db
      .select()
      .from(projectExpenses)
      .where(eq(projectExpenses.projectId, projectId));
    const projectDonations = await this.db
      .select()
      .from(donations)
      .where(eq(donations.projectId, projectId));
    return { ...project, expenses, donations: projectDonations };
  }
}
