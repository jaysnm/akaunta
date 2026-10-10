import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DonationsController } from './donations.controller.js';
import { DonationsService } from './donations.service.js';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
