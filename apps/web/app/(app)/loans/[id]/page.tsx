'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, cents, type Installment, type Loan } from '../../../../lib/api';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  Select,
  statusTone,
} from '../../../components/ui';

type LoanDetail = Loan & { schedule: Installment[] };

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<LoanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [repayAmount, setRepayAmount] = useState('');
  const [penaltyInstallmentId, setPenaltyInstallmentId] = useState('');
  const [penaltyType, setPenaltyType] = useState<'flat' | 'percent'>('flat');
  const [penaltyValue, setPenaltyValue] = useState('');
  const [waiverAmount, setWaiverAmount] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    api<LoanDetail>(`/loans/${id}`)
      .then((l) => {
        setLoan(l);
        if (!penaltyInstallmentId && l.schedule[0]) setPenaltyInstallmentId(l.schedule[0].id);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [id]);

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  }

  if (!loan) return <p className="text-sm text-slate-400">Loading…</p>;

  const outstanding = loan.schedule.reduce((s, i) => s + (i.totalCents - i.paidCents), 0);

  return (
    <div>
      <Link
        href="/loans"
        className="mb-2 inline-block text-xs font-medium text-brand-600 hover:underline"
      >
        ← Back to loans
      </Link>
      <PageHeader
        title={`Loan · ${cents(loan.principalCents)}`}
        description={`Disbursed ${new Date(loan.disbursedAt).toLocaleDateString()}`}
        action={<Badge tone={statusTone(loan.status)}>{loan.status}</Badge>}
      />
      {error && <ErrorBanner message={error} />}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-slate-500">Principal</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{cents(loan.principalCents)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Outstanding</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {cents(Math.max(outstanding, 0))}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Installments</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{loan.schedule.length}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Repayment schedule</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium tracking-wide text-slate-400 uppercase">
              <th className="pb-2">#</th>
              <th className="pb-2">Due</th>
              <th className="pb-2 text-right">Principal</th>
              <th className="pb-2 text-right">Interest</th>
              <th className="pb-2 text-right">Total</th>
              <th className="pb-2 text-right">Paid</th>
              <th className="pb-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {loan.schedule.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2.5">{i.period}</td>
                <td className="py-2.5 text-slate-500">
                  {new Date(i.dueDate).toLocaleDateString()}
                </td>
                <td className="py-2.5 text-right">{cents(i.principalCents)}</td>
                <td className="py-2.5 text-right">{cents(i.interestCents)}</td>
                <td className="py-2.5 text-right font-medium">{cents(i.totalCents)}</td>
                <td className="py-2.5 text-right text-slate-500">{cents(i.paidCents)}</td>
                <td className="py-2.5 text-right">
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Record repayment</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run('record the repayment', async () => {
                await api(`/loans/${id}/repayments`, {
                  method: 'POST',
                  body: JSON.stringify({ amountCents: Math.round(Number(repayAmount) * 100) }),
                });
                setRepayAmount('');
              });
            }}
            className="space-y-3"
          >
            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={busy === 'record the repayment'}
              className="w-full"
            >
              Record repayment
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Apply penalty</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run('apply the penalty', async () => {
                const rule =
                  penaltyType === 'flat'
                    ? { type: 'flat', amountCents: Math.round(Number(penaltyValue) * 100) }
                    : { type: 'percent', ratePct: Number(penaltyValue) };
                await api(`/loans/${id}/penalties`, {
                  method: 'POST',
                  body: JSON.stringify({ installmentId: penaltyInstallmentId, rule }),
                });
                setPenaltyValue('');
              });
            }}
            className="space-y-3"
          >
            <div>
              <Label>Installment</Label>
              <Select
                value={penaltyInstallmentId}
                onChange={(e) => setPenaltyInstallmentId(e.target.value)}
              >
                {loan.schedule.map((i) => (
                  <option key={i.id} value={i.id}>
                    Period {i.period} — due {new Date(i.dueDate).toLocaleDateString()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Select
                value={penaltyType}
                onChange={(e) => setPenaltyType(e.target.value as 'flat' | 'percent')}
                className="w-28"
              >
                <option value="flat">Flat KES</option>
                <option value="percent">% rate</option>
              </Select>
              <Input
                type="number"
                min="0"
                step="0.1"
                required
                value={penaltyValue}
                onChange={(e) => setPenaltyValue(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={busy === 'apply the penalty'}
              className="w-full"
            >
              Apply penalty
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Waive a penalty</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run('waive the penalty', async () => {
                await api(`/loans/${id}/waivers`, {
                  method: 'POST',
                  body: JSON.stringify({
                    amountCents: Math.round(Number(waiverAmount) * 100),
                    reason: waiverReason,
                  }),
                });
                setWaiverAmount('');
                setWaiverReason('');
              });
            }}
            className="space-y-3"
          >
            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={waiverAmount}
                onChange={(e) => setWaiverAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                required
                placeholder="First-time late fee"
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={busy === 'waive the penalty'}
              className="w-full"
            >
              Waive penalty
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
