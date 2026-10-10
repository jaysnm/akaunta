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
import { MembersService } from './members.service.js';

// Blank, not just absent — a form that leaves an optional field empty still
// sends "". Same gap as DATABASE_READ_URL (see apps/api/src/config/env.ts).
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

const createMemberSchema = z.object({
  name: z.string().min(1),
  phone: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  email: z.preprocess(blankToUndefined, z.email().optional()),
});

@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(@Inject(MembersService) private readonly members: MembersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const result = createMemberSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.members.create(user.groupId, user.sub, result.data);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.members.list(user.groupId);
  }

  @Get(':id/export')
  exportData(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.exportData(user.groupId, id);
  }

  @Post(':id/anonymize')
  anonymize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.anonymize(user.groupId, user.sub, id);
  }
}
