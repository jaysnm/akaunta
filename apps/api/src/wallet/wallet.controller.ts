import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { WalletService } from './wallet.service.js';

const contributionSchema = z.object({
  memberId: z.uuid(),
  amountCents: z.number().int().positive(),
});

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(@Inject(WalletService) private readonly wallet: WalletService) {}

  @Get()
  balance(@CurrentUser() user: AuthUser) {
    return this.wallet.balance(user.groupId);
  }

  @Post('contributions')
  contribute(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const result = contributionSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.wallet.contribute(
      user.groupId,
      user.sub,
      result.data.memberId,
      result.data.amountCents,
    );
  }
}
