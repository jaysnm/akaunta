export interface LedgerEntry {
  readonly account: string;
  /** Signed amount in integer cents. A transaction's entries must net to zero. */
  readonly amountCents: number;
}

export interface Transaction {
  readonly id: string;
  readonly postedAt: Date;
  readonly memo: string;
  readonly entries: readonly LedgerEntry[];
}

function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** The double-entry invariant: a transaction's legs must net to zero. */
export function isBalanced(tx: Transaction): boolean {
  return sumCents(tx.entries.map((e) => e.amountCents)) === 0;
}

/** Signed balance of an account across posted transactions; never stored, always derived. */
export function balanceOf(account: string, txs: readonly Transaction[]): number {
  return sumCents(
    txs
      .flatMap((tx) => tx.entries)
      .filter((e) => e.account === account)
      .map((e) => e.amountCents),
  );
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now()}_${seq}`;
}

/** Debits `fromAccount` and credits `toAccount` by the same amount — always balanced by construction. */
export function postEntry(
  memo: string,
  fromAccount: string,
  toAccount: string,
  amountCents: number,
  postedAt: Date = new Date(),
): Transaction {
  return {
    id: nextId('txn'),
    postedAt,
    memo,
    entries: [
      { account: fromAccount, amountCents: -amountCents },
      { account: toAccount, amountCents },
    ],
  };
}

export const recordContribution = (
  groupWallet: string,
  memberId: string,
  amountCents: number,
): Transaction =>
  postEntry(
    `contribution:${memberId}`,
    `income:contributions:${memberId}`,
    groupWallet,
    amountCents,
  );

export const disburseLoan = (
  groupWallet: string,
  loanId: string,
  principalCents: number,
): Transaction =>
  postEntry(`disbursement:${loanId}`, groupWallet, `loan:${loanId}:principal`, principalCents);

export const recordRepayment = (
  groupWallet: string,
  loanId: string,
  amountCents: number,
): Transaction =>
  postEntry(`repayment:${loanId}`, `loan:${loanId}:principal`, groupWallet, amountCents);

export const applyPenalty = (loanId: string, amountCents: number): Transaction =>
  postEntry(
    `penalty:${loanId}`,
    `loan:${loanId}:penalty`,
    `income:penalties:${loanId}`,
    amountCents,
  );

/** Reverses a penalty exactly — the original charge is never deleted, only offset (see Audit Logging in the plan). */
export const waivePenalty = (loanId: string, amountCents: number): Transaction =>
  postEntry(
    `waiver:${loanId}`,
    `income:penalties:${loanId}`,
    `loan:${loanId}:penalty`,
    amountCents,
  );
