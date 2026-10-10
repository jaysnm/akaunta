'use client';

import { useEffect, useState } from 'react';

import { api, cents, type Member } from '../../../lib/api';
import {
  Button,
  Card,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  Select,
  StatCard,
} from '../../components/ui';

export default function WalletPage() {
  const [balanceCents, setBalanceCents] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    api<{ balanceCents: number }>('/wallet').then((w) => setBalanceCents(w.balanceCents));
    api<Member[]>('/members').then((m) => {
      setMembers(m);
      if (!memberId && m[0]) setMemberId(m[0].id);
    });
  }

  useEffect(refresh, []);

  async function contribute(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api('/wallet/contributions', {
        method: 'POST',
        body: JSON.stringify({ memberId, amountCents: Math.round(Number(amount) * 100) }),
      });
      setAmount('');
      setSuccess('Contribution recorded.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record contribution');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Group Wallet"
        description="The shared pool every contribution, repayment, and disbursement moves through."
      />

      <div className="mb-6 max-w-xs">
        <StatCard label="Current balance" value={cents(balanceCents)} accent="brand" />
      </div>

      <Card className="max-w-lg">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Record a contribution</h2>
        {error && <ErrorBanner message={error} />}
        {success && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            {success}
          </p>
        )}
        <form onSubmit={contribute} className="space-y-4">
          <div>
            <Label>Member</Label>
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              min="1"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving || !memberId}>
            {saving ? 'Recording…' : 'Record contribution'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
