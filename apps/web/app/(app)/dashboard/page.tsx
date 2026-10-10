'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, type AuditEntry, cents, currentUser, type Loan, type Member } from '../../../lib/api';
import { Badge, Card, ErrorBanner, PageHeader, StatCard, statusTone } from '../../components/ui';

export default function DashboardPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [balanceCents, setBalanceCents] = useState(0);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Member[]>('/members'),
      api<Loan[]>('/loans'),
      api<{ balanceCents: number }>('/wallet'),
      api<AuditEntry[]>('/audit'),
    ])
      .then(([m, l, w, a]) => {
        setMembers(m);
        setLoans(l);
        setBalanceCents(w.balanceCents);
        setAudit(a.slice(0, 6));
      })
      .catch((err) => setError(err.message));
  }, []);

  const totalContributed = members.reduce((sum, m) => sum + m.contributedCents, 0);
  const activeLoans = loans.filter((l) => l.status === 'active');
  const outstandingPrincipal = activeLoans.reduce((sum, l) => sum + l.principalCents, 0);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${currentUser()?.role ?? 'there'}`}
        description="Here's how your welfare group is doing."
      />
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Group wallet balance" value={cents(balanceCents)} accent="brand" />
        <StatCard
          label="Members"
          value={String(members.length)}
          hint={`${members.filter((m) => m.status === 'active').length} active`}
          accent="accent"
        />
        <StatCard label="Total contributed" value={cents(totalContributed)} accent="brand" />
        <StatCard
          label="Active loans"
          value={String(activeLoans.length)}
          hint={cents(outstandingPrincipal) + ' outstanding'}
          accent="accent"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Members</h2>
            <Link href="/members" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {members.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No members yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {members.slice(0, 6).map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 first:border-0">
                    <td className="py-2.5 font-medium text-slate-800">{m.name}</td>
                    <td className="py-2.5 text-slate-500">{m.phone ?? '—'}</td>
                    <td className="py-2.5 text-right text-slate-700">
                      {cents(m.contributedCents)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent activity</h2>
          {audit.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {audit.map((a) => (
                <li key={a.id} className="text-xs">
                  <p className="font-medium text-slate-700">
                    {a.action.replace('.', ' ').replace('_', ' ')}
                  </p>
                  <p className="text-slate-400">{new Date(a.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
