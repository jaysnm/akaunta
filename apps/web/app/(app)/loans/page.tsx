'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, cents, type Loan, type Member } from '../../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  PlusIcon,
  statusTone,
} from '../../components/ui';

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Loan[]>('/loans'), api<Member[]>('/members')])
      .then(([l, m]) => {
        setLoans(l);
        setMembers(m);
      })
      .catch((err) => setError(err.message));
  }, []);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '—';

  return (
    <div>
      <PageHeader
        title="Loans"
        description="Disbursements, repayments, penalties, and waivers."
        action={
          <div className="flex gap-2">
            <Link href="/loans/products">
              <Button variant="secondary">Loan products</Button>
            </Link>
            <Link href="/loans/new">
              <Button>
                <PlusIcon className="h-4 w-4" />
                Disburse loan
              </Button>
            </Link>
          </div>
        }
      />
      {error && <ErrorBanner message={error} />}

      <Card>
        {loans.length === 0 ? (
          <EmptyState>No loans disbursed yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-wide text-slate-400 uppercase">
                <th className="pb-3">Borrower</th>
                <th className="pb-3">Disbursed</th>
                <th className="pb-3 text-right">Principal</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr
                  key={l.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => (window.location.href = `/loans/${l.id}`)}
                >
                  <td className="py-3 font-medium text-brand-700">{memberName(l.memberId)}</td>
                  <td className="py-3 text-slate-500">
                    {new Date(l.disbursedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right text-slate-700">{cents(l.principalCents)}</td>
                  <td className="py-3 text-right">
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
