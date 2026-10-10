import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const memberStatus = pgEnum('member_status', ['active', 'suspended', 'exited']);
export const userRole = pgEnum('user_role', ['admin', 'treasurer', 'secretary', 'member']);
export const amortizationMethod = pgEnum('amortization_method', ['flat', 'reducing']);
export const loanStatus = pgEnum('loan_status', ['active', 'closed']);
export const installmentStatus = pgEnum('installment_status', [
  'pending',
  'partial',
  'paid',
  'overdue',
]);
export const meetingStatus = pgEnum('meeting_status', ['scheduled', 'completed', 'cancelled']);
export const attendanceStatus = pgEnum('attendance_status', ['present', 'absent', 'excused']);
export const resolutionStatus = pgEnum('resolution_status', ['passed', 'rejected', 'deferred']);
export const donationMethod = pgEnum('donation_method', [
  'cash',
  'mobile_money',
  'bank',
  'in_kind',
]);
export const projectStatus = pgEnum('project_status', ['planned', 'active', 'completed']);

/** A welfare group — the tenant boundary every other table is scoped by. */
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Login identities (admin/treasurer/...), distinct from financial Members. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** A welfare group's member — the one who contributes, borrows, and repays. */
export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  status: memberStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  /** Set once an erasure request anonymizes this member — see the plan's Data Protection & Privacy section. */
  anonymizedAt: timestamp('anonymized_at'),
});

/**
 * The double-entry ledger. A posting is 2+ rows sharing one `txnId` whose
 * amounts net to zero — see @akaunta/domain's `postEntry` for how rows are
 * built. Balances are always derived by summing rows, never stored directly.
 */
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  txnId: text('txn_id').notNull(),
  account: text('account').notNull(),
  amountCents: integer('amount_cents').notNull(),
  memo: text('memo').notNull(),
  postedAt: timestamp('posted_at').notNull().defaultNow(),
});

/** A configurable loan product — e.g. "Emergency loan": 5% flat/month, 3 months. */
export const loanProducts = pgTable('loan_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  name: text('name').notNull(),
  annualRatePct: integer('annual_rate_pct').notNull(),
  termMonths: integer('term_months').notNull(),
  method: amortizationMethod('method').notNull(),
});

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => loanProducts.id),
  principalCents: integer('principal_cents').notNull(),
  status: loanStatus('status').notNull().default('active'),
  disbursedAt: timestamp('disbursed_at').notNull().defaultNow(),
});

/** The immutable schedule generated at disbursement by @akaunta/domain's `generateSchedule`. */
export const installments = pgTable('installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id')
    .notNull()
    .references(() => loans.id),
  period: integer('period').notNull(),
  dueDate: timestamp('due_date').notNull(),
  principalCents: integer('principal_cents').notNull(),
  interestCents: integer('interest_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  /** Remaining loan principal after this installment — see @akaunta/domain's `generateSchedule`. */
  balanceCents: integer('balance_cents').notNull(),
  paidCents: integer('paid_cents').notNull().default(0),
  status: installmentStatus('status').notNull().default('pending'),
});

/**
 * Insert-only audit trail, hash-chained per group so a row edited outside the
 * app breaks the chain — see the Audit Logging section of the plan. The
 * database role the app connects as should be granted INSERT only on this
 * table once a migration/grants story exists; not yet wired at this stage.
 */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  prevHash: text('prev_hash'),
  hash: text('hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Scheduling, agenda and minutes for a group meeting — see the plan's Meetings module. */
export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  title: text('title').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  location: text('location'),
  agenda: text('agenda'),
  minutes: text('minutes'),
  status: meetingStatus('status').notNull().default('scheduled'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Per-member attendance record for one meeting. */
export const meetingAttendance = pgTable('meeting_attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  status: attendanceStatus('status').notNull().default('present'),
});

/** A motion recorded at a meeting — not auto-wired to other modules yet, even when it reads like a waiver approval. */
export const resolutions = pgTable('resolutions', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  text: text('text').notNull(),
  status: resolutionStatus('status').notNull().default('passed'),
});

/** A community/environment initiative the group runs — tracks budget vs actual spend. */
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  name: text('name').notNull(),
  description: text('description'),
  budgetCents: integer('budget_cents').notNull().default(0),
  status: projectStatus('status').notNull().default('planned'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** A spend recorded against a project's budget. */
export const projectExpenses = pgTable('project_expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),
  spentAt: timestamp('spent_at').notNull().defaultNow(),
});

/** A non-member cash/in-kind inflow — see the plan's Donations & Environment Projects module. */
export const donations = pgTable('donations', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  /** Optional — a donation may fund a specific community/environment project. */
  projectId: uuid('project_id').references(() => projects.id),
  donorName: text('donor_name').notNull(),
  donorContact: text('donor_contact'),
  amountCents: integer('amount_cents').notNull(),
  method: donationMethod('method').notNull().default('cash'),
  purpose: text('purpose'),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
});
