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
import { DonationsService } from './donations.service.js';

const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

const donationSchema = z.object({
  donorName: z.string().min(1),
  donorContact: z.preprocess(blankToUndefined, z.string().optional()),
  amountCents: z.number().int().positive(),
  method: z.enum(['cash', 'mobile_money', 'bank', 'in_kind']).default('cash'),
  purpose: z.preprocess(blankToUndefined, z.string().optional()),
  projectId: z.preprocess(blankToUndefined, z.uuid().optional()),
});

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.preprocess(blankToUndefined, z.string().optional()),
  budgetCents: z.number().int().nonnegative().default(0),
});

const expenseSchema = z.object({
  description: z.string().min(1),
  amountCents: z.number().int().positive(),
});

@ApiTags('donations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class DonationsController {
  constructor(@Inject(DonationsService) private readonly donations: DonationsService) {}

  @Post('donations')
  record(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const result = donationSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.donations.record(user.groupId, user.sub, result.data);
  }

  @Get('donations')
  list(@CurrentUser() user: AuthUser) {
    return this.donations.list(user.groupId);
  }

  @Post('projects')
  createProject(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const result = projectSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.donations.createProject(user.groupId, user.sub, result.data);
  }

  @Get('projects')
  listProjects(@CurrentUser() user: AuthUser) {
    return this.donations.listProjects(user.groupId);
  }

  @Get('projects/:id')
  getProject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.donations.getProject(user.groupId, id);
  }

  @Post('projects/:id/expenses')
  addExpense(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const result = expenseSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.donations.addExpense(user.groupId, user.sub, id, result.data);
  }
}
