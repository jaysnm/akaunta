import { describe, expect, it } from 'vitest';

import { SchedulePreviewController } from '../src/loans/schedule-preview.controller.js';

describe('SchedulePreviewController', () => {
  const controller = new SchedulePreviewController();

  it('returns a schedule that fully retires the principal', () => {
    const schedule = controller.preview({
      principalCents: 100_000,
      annualRatePct: 12,
      termMonths: 6,
      method: 'reducing',
      startDate: '2026-01-01',
    }) as Array<{ balanceCents: number }>;

    expect(schedule).toHaveLength(6);
    expect(schedule.at(-1)?.balanceCents).toBe(0);
  });

  it('rejects an invalid payload with a 400', () => {
    expect(() => controller.preview({ principalCents: -5 })).toThrow();
  });
});
