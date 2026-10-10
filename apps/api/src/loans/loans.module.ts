import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LoansController } from './loans.controller.js';
import { LoansService } from './loans.service.js';
import { SchedulePreviewController } from './schedule-preview.controller.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [LoansController, SchedulePreviewController],
  providers: [LoansService],
})
export class LoansModule {}
