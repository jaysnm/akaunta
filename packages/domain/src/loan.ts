export type AmortizationMethod = 'flat' | 'reducing';

export interface LoanTerms {
  readonly principalCents: number;
  readonly annualRatePct: number;
  readonly termMonths: number;
  readonly method: AmortizationMethod;
}

export interface Installment {
  readonly period: number;
  readonly dueDate: Date;
  readonly principalCents: number;
  readonly interestCents: number;
  readonly totalCents: number;
  readonly balanceCents: number;
}

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function flatSchedule(terms: LoanTerms, startDate: Date): Installment[] {
  const { principalCents, termMonths } = terms;
  const interestPerPeriod = Math.round(principalCents * monthlyRate(terms.annualRatePct));
  const basePrincipal = Math.floor(principalCents / termMonths);
  let balance = principalCents;
  return Array.from({ length: termMonths }, (_, i) => {
    const period = i + 1;
    // the last installment absorbs the rounding remainder so the schedule always fully retires the principal
    const principal = period === termMonths ? balance : basePrincipal;
    balance -= principal;
    return {
      period,
      dueDate: addMonths(startDate, period),
      principalCents: principal,
      interestCents: interestPerPeriod,
      totalCents: principal + interestPerPeriod,
      balanceCents: balance,
    };
  });
}

function reducingSchedule(terms: LoanTerms, startDate: Date): Installment[] {
  const { principalCents, termMonths } = terms;
  const r = monthlyRate(terms.annualRatePct);
  const payment =
    r === 0
      ? Math.round(principalCents / termMonths)
      : Math.round((principalCents * r) / (1 - (1 + r) ** -termMonths));

  let balance = principalCents;
  return Array.from({ length: termMonths }, (_, i) => {
    const period = i + 1;
    const interest = Math.round(balance * r);
    // the last installment absorbs any rounding remainder so the balance always reaches exactly zero
    const principal = period === termMonths ? balance : payment - interest;
    balance -= principal;
    return {
      period,
      dueDate: addMonths(startDate, period),
      principalCents: principal,
      interestCents: interest,
      totalCents: principal + interest,
      balanceCents: balance,
    };
  });
}

/** Builds an immutable repayment schedule at disbursement time. Amounts stay in integer cents throughout to avoid float drift. */
export function generateSchedule(terms: LoanTerms, startDate: Date): Installment[] {
  return terms.method === 'flat'
    ? flatSchedule(terms, startDate)
    : reducingSchedule(terms, startDate);
}

export type PenaltyRule =
  | { readonly type: 'flat'; readonly amountCents: number }
  | { readonly type: 'percent'; readonly ratePct: number };

/** Penalty for one overdue installment; callers apply their own grace-period check before calling this. */
export function calculatePenalty(installment: Installment, rule: PenaltyRule): number {
  return rule.type === 'flat'
    ? rule.amountCents
    : Math.round(installment.totalCents * (rule.ratePct / 100));
}
