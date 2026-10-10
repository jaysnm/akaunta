import { Controller, Get, Header, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { and, desc, eq } from 'drizzle-orm';

import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Database } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { auditLog } from '../db/schema.js';
import { AuditService } from './audit.service.js';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // groupId comes from the JWT, never a query param — a client-supplied
  // groupId here would let any authenticated user read another tenant's log.
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
  ) {
    const conditions = [eq(auditLog.groupId, user.groupId)];
    if (action) conditions.push(eq(auditLog.action, action));
    if (entity) conditions.push(eq(auditLog.entity, entity));
    return this.db
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
  }

  @Get('verify')
  verify(@CurrentUser() user: AuthUser) {
    return this.audit.verifyChain(user.groupId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  async export(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.groupId, user.groupId))
      .orderBy(desc(auditLog.createdAt));

    const header = 'timestamp,actor,action,entity,before,after,hash';
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.actor,
        r.action,
        r.entity,
        JSON.stringify(r.before ?? null),
        JSON.stringify(r.after ?? null),
        r.hash,
      ]
        .map(csvEscape)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }
}
