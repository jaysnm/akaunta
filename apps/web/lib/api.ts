const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// localStorage, not an httpOnly cookie — simplest thing that works for this
// minimal admin UI. Revisit before this handles real member data in production.
export function getToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

/** Decodes the JWT payload client-side — no /me endpoint exists, and this needs no secret, just the claims already in the token. */
export function currentUser(): { sub: string; groupId: string; role: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]!));
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      Array.isArray(body.message) ? body.message.join(', ') : body.message,
      res.status,
    );
  }
  return res.json();
}

export function cents(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}KES ${(Math.abs(n) / 100).toLocaleString()}`;
}

export interface Member {
  id: string;
  groupId: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  contributedCents: number;
  anonymizedAt: string | null;
}

export interface LoanProduct {
  id: string;
  name: string;
  annualRatePct: number;
  termMonths: number;
  method: 'flat' | 'reducing';
}

export interface Loan {
  id: string;
  memberId: string;
  productId: string;
  principalCents: number;
  status: string;
  disbursedAt: string;
}

export interface Installment {
  id: string;
  period: number;
  dueDate: string;
  principalCents: number;
  interestCents: number;
  totalCents: number;
  balanceCents: number;
  paidCents: number;
  status: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Attendance {
  meetingId: string;
  memberId: string;
  status: 'present' | 'absent' | 'excused';
}

export interface Resolution {
  id: string;
  meetingId: string;
  text: string;
  status: 'passed' | 'rejected' | 'deferred';
}

export type MeetingDetail = Meeting & { attendance: Attendance[]; resolutions: Resolution[] };

export interface Donation {
  id: string;
  donorName: string;
  donorContact: string | null;
  amountCents: number;
  method: 'cash' | 'mobile_money' | 'bank' | 'in_kind';
  purpose: string | null;
  projectId: string | null;
  receivedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  budgetCents: number;
  status: 'planned' | 'active' | 'completed';
  spentCents: number;
  raisedCents: number;
  createdAt: string;
}

export interface MemberDataExport {
  member: Member;
  loans: Loan[];
  contributions: { id: string; amountCents: number; memo: string; postedAt: string }[];
  meetingAttendance: {
    meetingId: string;
    status: string;
    meetingTitle: string;
    scheduledAt: string;
  }[];
}
