'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, type Meeting } from '../../../lib/api';
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

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', scheduledAt: '', location: '', agenda: '' });
  const [saving, setSaving] = useState(false);

  function refresh() {
    api<Meeting[]>('/meetings')
      .then(setMeetings)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          location: form.location || undefined,
          agenda: form.agenda || undefined,
        }),
      });
      setForm({ title: '', scheduledAt: '', location: '', agenda: '' });
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule meeting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Scheduling, agendas, attendance, minutes, and resolutions."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <PlusIcon className="h-4 w-4" />
            Schedule meeting
          </Button>
        }
      />
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={schedule} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Date &amp; time</Label>
              <Input
                type="datetime-local"
                required
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                placeholder="Chairperson's home"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label>Agenda</Label>
              <Input
                placeholder="Loan approvals, Q4 contributions"
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Scheduling…' : 'Schedule meeting'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {meetings.length === 0 ? (
          <EmptyState>No meetings scheduled yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {meetings.map((m) => (
              <li key={m.id} className="py-3">
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between gap-4 hover:opacity-80"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {new Date(m.scheduledAt).toLocaleString()}{' '}
                      {m.location ? `· ${m.location}` : ''}
                    </p>
                  </div>
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
