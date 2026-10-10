'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, cents, type Donation, type Project } from '../../../../../lib/api';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  statusTone,
} from '../../../../components/ui';

interface Expense {
  id: string;
  description: string;
  amountCents: number;
  spentAt: string;
}

type ProjectDetail = Project & { expenses: Expense[]; donations: Donation[] };

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  function refresh() {
    api<ProjectDetail>(`/projects/${id}`)
      .then(setProject)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [id]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/projects/${id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({ description, amountCents: Math.round(Number(amount) * 100) }),
      });
      setDescription('');
      setAmount('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  }

  if (!project) return <p className="text-sm text-slate-400">Loading…</p>;

  const spent = project.expenses.reduce((s, e) => s + e.amountCents, 0);
  const raised = project.donations.reduce((s, d) => s + d.amountCents, 0);

  return (
    <div>
      <Link
        href="/donations"
        className="mb-2 inline-block text-xs font-medium text-brand-600 hover:underline"
      >
        ← Back to donations &amp; projects
      </Link>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        action={
          <Badge
            tone={statusTone(
              project.status === 'completed'
                ? 'closed'
                : project.status === 'active'
                  ? 'active'
                  : 'pending',
            )}
          >
            {project.status}
          </Badge>
        }
      />
      {error && <ErrorBanner message={error} />}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium text-slate-500">Budget</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{cents(project.budgetCents)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Spent</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{cents(spent)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Raised from donations</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{cents(raised)}</p>
        </Card>
      </div>

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Record expense</h3>
        <form onSubmit={addExpense} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <Label>Description</Label>
            <Input required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add expense'}
          </Button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Expenses</h3>
        {project.expenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No expenses recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {project.expenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 first:border-0">
                  <td className="py-2.5 text-slate-700">{e.description}</td>
                  <td className="py-2.5 text-right text-slate-500">
                    {new Date(e.spentAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 text-right font-medium text-slate-900">
                    {cents(e.amountCents)}
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
