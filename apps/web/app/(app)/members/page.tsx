'use client';

import { useEffect, useState } from 'react';

import { api, cents, type Member, type MemberDataExport } from '../../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  PlusIcon,
  statusTone,
} from '../../components/ui';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    api<Member[]>('/members')
      .then(setMembers)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/members', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
        }),
      });
      setForm({ name: '', phone: '', email: '' });
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setSaving(false);
    }
  }

  async function exportMember(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const data = await api<MemberDataExport>(`/members/${id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `member-${id.slice(0, 8)}-data.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export member data');
    } finally {
      setBusyId(null);
    }
  }

  async function anonymizeMember(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/members/${id}/anonymize`, { method: 'POST' });
      setConfirmingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to anonymize member');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Members"
        description="Everyone contributing to and borrowing from the group."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <PlusIcon className="h-4 w-4" />
            Add member
          </Button>
        }
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={addMember} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <Label>Full name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Email (optional)"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {members.length === 0 ? (
          <EmptyState>No members yet — add the first one above.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-wide text-slate-400 uppercase">
                <th className="pb-3">Name</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3 text-right">Contributed</th>
                <th className="pb-3 text-right">Status</th>
                <th className="pb-3 text-right">Data &amp; privacy</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{m.name}</td>
                  <td className="py-3 text-slate-500">{m.phone ?? m.email ?? '—'}</td>
                  <td className="py-3 text-right text-slate-700">{cents(m.contributedCents)}</td>
                  <td className="py-3 text-right">
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  </td>
                  <td className="py-3 text-right">
                    {m.anonymizedAt ? (
                      <Badge tone="slate">Anonymized</Badge>
                    ) : confirmingId === m.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500">Redact identifying fields?</span>
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={busyId === m.id}
                          onClick={() => anonymizeMember(m.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          disabled={busyId === m.id}
                          onClick={() => exportMember(m.id)}
                        >
                          Export data
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => setConfirmingId(m.id)}
                        >
                          Anonymize
                        </Button>
                      </div>
                    )}
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
