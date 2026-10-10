'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, type MeetingDetail, type Member } from '../../../../lib/api';
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

type AttendanceDraft = Record<string, 'present' | 'absent' | 'excused'>;

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState<AttendanceDraft>({});
  const [minutes, setMinutes] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<'passed' | 'rejected' | 'deferred'>(
    'passed',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    api<MeetingDetail>(`/meetings/${id}`).then((m) => {
      setMeeting(m);
      setMinutes(m.minutes ?? '');
      setDraft(Object.fromEntries(m.attendance.map((a) => [a.memberId, a.status])));
    });
    api<Member[]>('/members').then(setMembers);
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

  if (!meeting) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <Link
        href="/meetings"
        className="mb-2 inline-block text-xs font-medium text-brand-600 hover:underline"
      >
        ← Back to meetings
      </Link>
      <PageHeader
        title={meeting.title}
        description={`${new Date(meeting.scheduledAt).toLocaleString()}${meeting.location ? ` · ${meeting.location}` : ''}`}
        action={<Badge tone={statusTone(meeting.status)}>{meeting.status}</Badge>}
      />
      {error && <ErrorBanner message={error} />}
      {meeting.agenda && (
        <Card className="mb-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Agenda</h3>
          <p className="text-sm text-slate-600">{meeting.agenda}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Attendance</h3>
          <ul className="mb-4 space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-700">{m.name}</span>
                <Select
                  className="w-32"
                  value={draft[m.id] ?? 'present'}
                  onChange={(e) =>
                    setDraft({ ...draft, [m.id]: e.target.value as AttendanceDraft[string] })
                  }
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </Select>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            disabled={busy === 'save attendance'}
            onClick={() =>
              run('save attendance', () =>
                api(`/meetings/${id}/attendance`, {
                  method: 'POST',
                  body: JSON.stringify({
                    entries: Object.entries(draft).map(([memberId, status]) => ({
                      memberId,
                      status,
                    })),
                  }),
                }),
              )
            }
          >
            Save attendance
          </Button>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Resolutions</h3>
            <ul className="mb-4 space-y-2">
              {meeting.resolutions.length === 0 && (
                <p className="text-sm text-slate-400">No resolutions recorded yet.</p>
              )}
              {meeting.resolutions.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-slate-700">{r.text}</span>
                  <Badge
                    tone={statusTone(
                      r.status === 'passed'
                        ? 'paid'
                        : r.status === 'rejected'
                          ? 'overdue'
                          : 'pending',
                    )}
                  >
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run('record the resolution', async () => {
                  await api(`/meetings/${id}/resolutions`, {
                    method: 'POST',
                    body: JSON.stringify({ text: resolutionText, status: resolutionStatus }),
                  });
                  setResolutionText('');
                });
              }}
              className="space-y-3"
            >
              <Input
                required
                placeholder="Motion text"
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
              />
              <div className="flex gap-2">
                <Select
                  className="w-32"
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as typeof resolutionStatus)}
                >
                  <option value="passed">Passed</option>
                  <option value="rejected">Rejected</option>
                  <option value="deferred">Deferred</option>
                </Select>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={busy === 'record the resolution'}
                >
                  Add resolution
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Minutes</h3>
            <Label>Notes</Label>
            <textarea
              rows={4}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <Button
              variant="secondary"
              disabled={busy === 'save minutes' || meeting.status === 'completed'}
              onClick={() =>
                run('save minutes', () =>
                  api(`/meetings/${id}/complete`, {
                    method: 'POST',
                    body: JSON.stringify({ minutes }),
                  }),
                )
              }
            >
              {meeting.status === 'completed' ? 'Meeting completed' : 'Save minutes & complete'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
