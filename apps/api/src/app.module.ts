import { Module } from '@nestjs/common';

import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { DonationsModule } from './donations/donations.module.js';
import { HealthController } from './health/health.controller.js';
import { LoansModule } from './loans/loans.module.js';
import { MeetingsModule } from './meetings/meetings.module.js';
import { MembersModule } from './members/members.module.js';
import { WalletModule } from './wallet/wallet.module.js';

@Module({
  imports: [
    DbModule,
    AuthModule,
    AuditModule,
    MembersModule,
    WalletModule,
    LoansModule,
    MeetingsModule,
    DonationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
