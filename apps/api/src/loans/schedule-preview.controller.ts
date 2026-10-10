import { generateSchedule, type LoanTerms } from '@akaunta/domain';
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

const loanTermsSchema = z.object({
  principalCents: z.number().int().positive(),
  annualRatePct: z.number().nonnegative(),
  termMonths: z.number().int().positive().max(360),
  method: z.enum(['flat', 'reducing']),
  startDate: z.iso.date(),
});

/** Unauthenticated and stateless — a pure calculator, no tenant data involved. */
@ApiTags('loans')
@Controller('loans')
export class SchedulePreviewController {
  @Post('schedule-preview')
  preview(@Body() body: unknown) {
    const result = loanTermsSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(z.prettifyError(result.error));

    const { startDate, ...terms } = result.data satisfies LoanTerms & { startDate: string };
    return generateSchedule(terms, new Date(startDate));
  }
}
