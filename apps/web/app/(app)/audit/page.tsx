'use client';

import { useEffect, useState } from 'react';

import { api, type AuditEntry, getToken } from '../../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
} from '../../components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; brokenAt: string | null } | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);

  function refresh() {
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entity', entityFilter);
    const qs = params.toString();
    api<AuditEntry[]>(`/audit${qs ? `?${qs}` : ''}`)
      .then(setEntries)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [actionFilter, entityFilter]);

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      setVerifyResult(await api('/audit/verify'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify audit log');
    } finally {
      setVerifying(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/audit/export`, {
        headers: { authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit log');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Every mutating action, insert-only and hash-chained — nothing here can be edited or deleted."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={verify} disabled={verifying}>
              {verifying ? 'Verifying…' : 'Verify integrity'}
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        }
      />
      {error && <ErrorBanner message={error} />}
      {verifyResult && (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${verifyResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          {verifyResult.ok
            ? 'Hash chain intact — no tampering detected.'
            : `Hash chain broken at record ${verifyResult.brokenAt}.`}
        </div>
      )}

      <div className="mb-4 flex gap-3">
        <Input
          placeholder="Filter by action (e.g. loan.disbursed)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <Input
          placeholder="Filter by entity (e.g. member:abc123)"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
        />
      </div>

      <Card>
        {entries.length === 0 ? (
          <EmptyState>No activity recorded yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800 capitalize">
                    {e.action.replace(/[._]/g, ' ')}
                  </p>
                  <Badge tone="brand">{new Date(e.createdAt).toLocaleString()}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {e.entity} · actor {e.actor.slice(0, 8)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
