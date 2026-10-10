'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, type LoanProduct } from '../../../../lib/api';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  PlusIcon,
  Select,
} from '../../../components/ui';

export default function LoanProductsPage() {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    annualRatePct: '12',
    termMonths: '3',
    method: 'reducing',
  });
  const [saving, setSaving] = useState(false);

  function refresh() {
    api<LoanProduct[]>('/loans/products')
      .then(setProducts)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/loans/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          annualRatePct: Number(form.annualRatePct),
          termMonths: Number(form.termMonths),
          method: form.method,
        }),
      });
      setForm({ name: '', annualRatePct: '12', termMonths: '3', method: 'reducing' });
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create loan product');
    } finally {
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
        title="Loan Products"
        description="Configurable terms — e.g. an Emergency loan at 5% flat for 3 months."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <PlusIcon className="h-4 w-4" />
            New product
          </Button>
        }
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <Card className="mb-6">
          <form
            onSubmit={addProduct}
            className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end"
          >
            <div className="sm:col-span-2">
              <Label>Name</Label>
              <Input
                required
                placeholder="Emergency loan"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Annual rate %</Label>
              <Input
                type="number"
                step="0.1"
                required
                value={form.annualRatePct}
                onChange={(e) => setForm({ ...form, annualRatePct: e.target.value })}
              />
            </div>
            <div>
              <Label>Term (months)</Label>
              <Input
                type="number"
                min="1"
                required
                value={form.termMonths}
                onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="reducing">Reducing balance</option>
                <option value="flat">Flat</option>
              </Select>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {products.length === 0 ? (
          <EmptyState>No loan products configured yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-wide text-slate-400 uppercase">
                <th className="pb-3">Name</th>
                <th className="pb-3">Method</th>
                <th className="pb-3 text-right">Rate</th>
                <th className="pb-3 text-right">Term</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="py-3 text-slate-500 capitalize">{p.method}</td>
                  <td className="py-3 text-right text-slate-700">{p.annualRatePct}% / yr</td>
                  <td className="py-3 text-right text-slate-700">{p.termMonths} mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
