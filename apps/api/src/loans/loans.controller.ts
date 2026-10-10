import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LoansService } from './loans.service.js';

const productSchema = z.object({
  name: z.string().min(1),
  annualRatePct: z.number().nonnegative(),
  termMonths: z.number().int().positive().max(360),
  method: z.enum(['flat', 'reducing']),
});
const disburseSchema = z.object({
  memberId: z.uuid(),
  productId: z.uuid(),
  principalCents: z.number().int().positive(),
});
const repaySchema = z.object({ amountCents: z.number().int().positive() });
const penaltySchema = z.object({
  installmentId: z.uuid(),
  rule: z.union([
    z.object({ type: z.literal('flat'), amountCents: z.number().int().positive() }),
    z.object({ type: z.literal('percent'), ratePct: z.number().positive() }),
  ]),
});
const waiverSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().min(1),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(@Inject(LoansService) private readonly loans: LoansService) {}

  @Post('products')
  createProduct(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.loans.createProduct(user.groupId, parse(productSchema, body));
  }

  @Get('products')
  listProducts(@CurrentUser() user: AuthUser) {
    return this.loans.listProducts(user.groupId);
  }

  @Post()
  disburse(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.loans.disburse(user.groupId, user.sub, parse(disburseSchema, body));
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.loans.list(user.groupId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.loans.get(user.groupId, id);
  }

  @Post(':id/repayments')
  repay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.loans.repay(user.groupId, user.sub, id, parse(repaySchema, body).amountCents);
  }

  @Post(':id/penalties')
  penalize(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const { installmentId, rule } = parse(penaltySchema, body);
    return this.loans.penalize(user.groupId, user.sub, id, installmentId, rule);
  }

  @Post(':id/waivers')
  waive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const { amountCents, reason } = parse(waiverSchema, body);
    return this.loans.waive(user.groupId, user.sub, id, amountCents, reason);
  }
}
