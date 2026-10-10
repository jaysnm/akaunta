'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, type Loan, type LoanProduct, type Member } from '../../../../lib/api';
import {
  Button,
  Card,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  Select,
} from '../../../components/ui';

export default function NewLoanPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [memberId, setMemberId] = useState('');
  const [productId, setProductId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Member[]>('/members').then((m) => {
      setMembers(m);
      if (m[0]) setMemberId(m[0].id);
    });
    api<LoanProduct[]>('/loans/products').then((p) => {
      setProducts(p);
      if (p[0]) setProductId(p[0].id);
    });
  }, []);

  async function disburse(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const loan = await api<Loan>('/loans', {
        method: 'POST',
        body: JSON.stringify({
          memberId,
          productId,
          principalCents: Math.round(Number(principal) * 100),
        }),
      });
      router.push(`/loans/${loan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disburse loan');
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/loans"
        className="mb-2 inline-block text-xs font-medium text-brand-600 hover:underline"
      >
        ← Back to loans
      </Link>
      <PageHeader
        title="Disburse a Loan"
        description="Generates the repayment schedule and posts the disbursement to the group wallet."
      />

      {products.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            No loan products yet —{' '}
            <Link href="/loans/products" className="font-medium text-brand-600 hover:underline">
              create one first
            </Link>
            .
          </p>
        </Card>
      ) : (
        <Card className="max-w-lg">
          {error && <ErrorBanner message={error} />}
          <form onSubmit={disburse} className="space-y-4">
            <div>
              <Label>Borrower</Label>
              <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Loan product</Label>
              <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.annualRatePct}% · {p.termMonths}mo · {p.method})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Principal (KES)</Label>
              <Input
                type="number"
                min="1"
                required
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving || !memberId || !productId}>
              {saving ? 'Disbursing…' : 'Disburse loan'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
