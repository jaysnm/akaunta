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
import { MeetingsService } from './meetings.service.js';

const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

const scheduleSchema = z.object({
  title: z.string().min(1),
  scheduledAt: z.coerce.date(),
  location: z.preprocess(blankToUndefined, z.string().optional()),
  agenda: z.preprocess(blankToUndefined, z.string().optional()),
});

const attendanceSchema = z.object({
  entries: z.array(
    z.object({ memberId: z.uuid(), status: z.enum(['present', 'absent', 'excused']) }),
  ),
});

const resolutionSchema = z.object({
  text: z.string().min(1),
  status: z.enum(['passed', 'rejected', 'deferred']).default('passed'),
});

const completeSchema = z.object({ minutes: z.string().min(1) });

@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(@Inject(MeetingsService) private readonly meetings: MeetingsService) {}

  @Post()
  schedule(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const result = scheduleSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.meetings.schedule(user.groupId, user.sub, result.data);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.meetings.list(user.groupId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.get(user.groupId, id);
  }

  @Post(':id/attendance')
  recordAttendance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const result = attendanceSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.meetings.recordAttendance(user.groupId, user.sub, id, result.data.entries);
  }

  @Post(':id/resolutions')
  addResolution(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const result = resolutionSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.meetings.addResolution(user.groupId, user.sub, id, result.data);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const result = completeSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
    return this.meetings.complete(user.groupId, user.sub, id, result.data.minutes);
  }
}
