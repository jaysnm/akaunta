'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, cents, type Donation, type Project } from '../../../lib/api';
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
  Select,
  statusTone,
} from '../../components/ui';

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDonationForm, setShowDonationForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [donationForm, setDonationForm] = useState({
    donorName: '',
    donorContact: '',
    amountCents: '',
    method: 'cash',
    purpose: '',
    projectId: '',
  });
  const [projectForm, setProjectForm] = useState({ name: '', description: '', budgetCents: '' });
  const [saving, setSaving] = useState(false);

  function refresh() {
    api<Donation[]>('/donations')
      .then(setDonations)
      .catch((err) => setError(err.message));
    api<Project[]>('/projects')
      .then(setProjects)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function addDonation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/donations', {
        method: 'POST',
        body: JSON.stringify({
          donorName: donationForm.donorName,
          donorContact: donationForm.donorContact || undefined,
          amountCents: Math.round(Number(donationForm.amountCents) * 100),
          method: donationForm.method,
          purpose: donationForm.purpose || undefined,
          projectId: donationForm.projectId || undefined,
        }),
      });
      setDonationForm({
        donorName: '',
        donorContact: '',
        amountCents: '',
        method: 'cash',
        purpose: '',
        projectId: '',
      });
      setShowDonationForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record donation');
    } finally {
      setSaving(false);
    }
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectForm.name,
          description: projectForm.description || undefined,
          budgetCents: Math.round(Number(projectForm.budgetCents || 0) * 100),
        }),
      });
      setProjectForm({ name: '', description: '', budgetCents: '' });
      setShowProjectForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Donations & Environment Projects"
        description="Non-member cash inflows and group-led community initiatives, with budgets vs. actuals."
      />
      {error && <ErrorBanner message={error} />}

      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Community &amp; environment projects
        </h2>
        <Button variant="secondary" onClick={() => setShowProjectForm((s) => !s)}>
          <PlusIcon className="h-4 w-4" />
          New project
        </Button>
      </div>

      {showProjectForm && (
        <Card className="mb-6">
          <form
            onSubmit={addProject}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end"
          >
            <div>
              <Label>Name</Label>
              <Input
                required
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Budget (KES)"
                value={projectForm.budgetCents}
                onChange={(e) => setProjectForm({ ...projectForm, budgetCents: e.target.value })}
              />
              <Button type="submit" disabled={saving}>
                Save
              </Button>
            </div>
          </form>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card className="mb-8">
          <EmptyState>No projects yet.</EmptyState>
        </Card>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/donations/projects/${p.id}`}>
              <Card className="h-full hover:border-brand-300">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  <Badge
                    tone={statusTone(
                      p.status === 'completed'
                        ? 'closed'
                        : p.status === 'active'
                          ? 'active'
                          : 'pending',
                    )}
                  >
                    {p.status}
                  </Badge>
                </div>
                {p.description && <p className="mb-3 text-xs text-slate-500">{p.description}</p>}
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Raised {cents(p.raisedCents)}</span>
                  <span>
                    Spent {cents(p.spentCents)} / {cents(p.budgetCents)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                    style={{
                      width: `${p.budgetCents > 0 ? Math.min(100, (p.spentCents / p.budgetCents) * 100) : 0}%`,
                    }}
                  />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Donations</h2>
        <Button onClick={() => setShowDonationForm((s) => !s)}>
          <PlusIcon className="h-4 w-4" />
          Record donation
        </Button>
      </div>

      {showDonationForm && (
        <Card className="mb-6">
          <form onSubmit={addDonation} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Donor name</Label>
              <Input
                required
                value={donationForm.donorName}
                onChange={(e) => setDonationForm({ ...donationForm, donorName: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact</Label>
              <Input
                value={donationForm.donorContact}
                onChange={(e) => setDonationForm({ ...donationForm, donorContact: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={donationForm.amountCents}
                onChange={(e) => setDonationForm({ ...donationForm, amountCents: e.target.value })}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={donationForm.method}
                onChange={(e) => setDonationForm({ ...donationForm, method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile money</option>
                <option value="bank">Bank</option>
                <option value="in_kind">In-kind</option>
              </Select>
            </div>
            <div>
              <Label>Purpose</Label>
              <Input
                value={donationForm.purpose}
                onChange={(e) => setDonationForm({ ...donationForm, purpose: e.target.value })}
              />
            </div>
            <div>
              <Label>Project (optional)</Label>
              <Select
                value={donationForm.projectId}
                onChange={(e) => setDonationForm({ ...donationForm, projectId: e.target.value })}
              >
                <option value="">— None —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Record donation'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {donations.length === 0 ? (
          <EmptyState>No donations recorded yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium tracking-wide text-slate-400 uppercase">
                <th className="pb-3">Donor</th>
                <th className="pb-3">Purpose</th>
                <th className="pb-3">Method</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 text-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{d.donorName}</td>
                  <td className="py-3 text-slate-500">{d.purpose ?? '—'}</td>
                  <td className="py-3 text-slate-500 capitalize">{d.method.replace('_', ' ')}</td>
                  <td className="py-3 text-right text-slate-700">{cents(d.amountCents)}</td>
                  <td className="py-3 text-right text-slate-400">
                    {new Date(d.receivedAt).toLocaleDateString()}
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
