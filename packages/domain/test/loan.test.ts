import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { calculatePenalty, generateSchedule } from '../src/loan.js';

describe('amortization schedule', () => {
  it('fully retires the principal with no remainder, for both methods', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10_000_000 }),
        fc.integer({ min: 1, max: 36 }),
        fc.constantFrom('flat', 'reducing') as fc.Arbitrary<'flat' | 'reducing'>,
        (principalCents, termMonths, method) => {
          const schedule = generateSchedule(
            { principalCents, annualRatePct: 12, termMonths, method },
            new Date('2026-01-01'),
          );
          expect(schedule.at(-1)?.balanceCents).toBe(0);
          expect(schedule.reduce((sum, i) => sum + i.principalCents, 0)).toBe(principalCents);
        },
      ),
    );
  });

  it('produces one installment per month, in order, a month apart', () => {
    const schedule = generateSchedule(
      { principalCents: 120_000, annualRatePct: 10, termMonths: 3, method: 'reducing' },
      new Date('2026-01-01'),
    );
    expect(schedule).toHaveLength(3);
    expect(schedule[1]!.dueDate.getMonth()).toBe(schedule[0]!.dueDate.getMonth() + 1);
  });
});

describe('penalties', () => {
  const installment = generateSchedule(
    { principalCents: 100_000, annualRatePct: 12, termMonths: 6, method: 'flat' },
    new Date('2026-01-01'),
  )[0]!;

  it('a flat penalty is independent of the installment amount', () => {
    expect(calculatePenalty(installment, { type: 'flat', amountCents: 500 })).toBe(500);
  });

  it('a percent penalty scales with the installment total', () => {
    expect(calculatePenalty(installment, { type: 'percent', ratePct: 10 })).toBe(
      Math.round(installment.totalCents * 0.1),
    );
  });
});
