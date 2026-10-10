import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  applyPenalty,
  balanceOf,
  isBalanced,
  recordContribution,
  recordRepayment,
  waivePenalty,
} from '../src/ledger.js';

describe('ledger invariants', () => {
  it('every posted transaction nets to zero', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (amount) => {
        expect(isBalanced(recordContribution('wallet:g1', 'member:m1', amount))).toBe(true);
      }),
    );
  });

  it('a waiver exactly reverses the penalty it targets', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (amount) => {
        const penalty = applyPenalty('loan:1', amount);
        const waiver = waivePenalty('loan:1', amount);
        expect(balanceOf('loan:1:penalty', [penalty, waiver])).toBe(0);
      }),
    );
  });

  it('a wallet balance equals the sum of its ledger entries', () => {
    const txs = [
      recordContribution('wallet:g1', 'member:m1', 5000),
      recordContribution('wallet:g1', 'member:m2', 3000),
      recordRepayment('wallet:g1', 'loan:1', 1000),
    ];
    expect(balanceOf('wallet:g1', txs)).toBe(5000 + 3000 + 1000);
  });
});
