# Welfare/SACCO Platform — Implementation Plan

Snapshot date: 2026-10-02. This is a historical snapshot for offline/repo reference. The live, editable version (with an interactive architecture diagram) is at:
https://claude.ai/artifact/672txNggp8faSqdTmB8hAJ

Recommended approach: one shared codebase shipped two ways — a multi-tenant hosted SaaS (web + mobile) and a self-hosted, installable desktop package with a local-first database that runs fully offline and syncs opportunistically to the central service. A single welfare group can operate entirely on one laptop with zero internet dependency, while still supporting remote member access via web/mobile when connectivity and a subscription are available.

## Architecture Overview

One backend serves web, mobile, and an offline-capable desktop client. Hybrid model: hosted multi-tenant SaaS, or the same app self-hosted per group.

```
 [Desktop App]        [Web Portal]        [Mobile App]
 Tauri + SQLite       Next.js PWA         React Native
 offline-capable      admin + member      iOS + Android
       |                    |                   |
       | (sync when          |                   |
       |  online)            |                   |
       +--------+------------+-------------------+
                v
          [ Central API ]
        NestJS · multi-tenant · RBAC
        REST/GraphQL + webhooks
          /       |         \
         v        v          v
   [Postgres] [Payment      [Notifications]
   row-level   Gateways]     SMS, email, push
   isolation   M-Pesa, bank
```

One codebase, two delivery modes. As a hosted SaaS, the central API serves web, mobile, and desktop clients with full multi-tenant isolation. As a self-hosted installable package, the same desktop app runs standalone against a local SQLite database with zero cloud dependency — a group with no reliable internet can run contributions, loans, and meetings entirely offline, then optionally sync to the hosted service later for remote member access or multi-device backup.

## Core Domain Modules

| Module                           | What it does                                                                                                                                                             | Key entities                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Membership                       | Onboarding, KYC docs, member status (active/suspended/exited), next-of-kin, roles (member, treasurer, secretary, chair, admin)                                           | Member, Role, Document                     |
| Contributions & Wallet           | Scheduled + ad-hoc contributions, multiple funding sources (member cash/mobile money, grants, fundraising, interest income), per-member ledger plus group wallet balance | Wallet, Transaction, FundingSource         |
| Loans                            | Applications, approval workflow, disbursement, amortization schedule, multiple loan products (emergency, development, school fees) with different interest/term rules    | LoanProduct, LoanApplication, LoanSchedule |
| Interest & Penalties             | Interest accrual (flat or reducing balance), late-payment penalty rules, automatic recalculation on partial/late payment                                                 | InterestRule, PenaltyRule, PenaltyLedger   |
| Waivers                          | Request + approval workflow to reduce or cancel accrued interest/penalties, with an audit trail of who approved and why                                                  | WaiverRequest, ApprovalLog                 |
| Meetings                         | Scheduling, agendas, attendance, minutes, and resolutions that can trigger system actions (e.g. an approved waiver)                                                      | Meeting, Agenda, Minute, Resolution        |
| Donations & Environment Projects | Tracking of non-member cash inflows and group-led community/environment initiatives, budgets vs actuals                                                                  | Project, Budget, Expense                   |
| Reporting                        | Member statements, group financial statements, loan book health, arrears aging, audit log export                                                                         | Statement, Report                          |
| Audit Log                        | Immutable, insert-only record of every action across every module above (actor, before/after values, timestamp), hash-chained for tamper evidence                        | AuditEntry                                 |

Every module posts to a single double-entry ledger underneath, so the group wallet balance, member balances, and loan book always reconcile to one source of truth.

## Recommended Tech Stack

| Layer                   | Recommendation                                                                                                                                           | Why                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend API             | Node.js + NestJS (TypeScript)                                                                                                                            | Mature DI/module system for multi-tenant SaaS, shares types/validation with frontend via a TypeScript monorepo                                                                    |
| Primary database        | PostgreSQL                                                                                                                                               | ACID transactions for ledger integrity, row-level security for tenant isolation, works both as a hosted multi-tenant instance and embedded in a single-tenant self-hosted install |
| Local/offline database  | SQLite, via an embedded sync engine (PowerSync or ElectricSQL)                                                                                           | Gives the desktop app a real local database that works with zero connectivity and syncs deltas to Postgres when online                                                            |
| Desktop shell           | Tauri (Rust shell + the same React web app)                                                                                                              | Produces small native installers for Windows/macOS/Linux from one web codebase; lighter and more secure than Electron                                                             |
| Web app                 | Next.js (React) as an installable PWA                                                                                                                    | Shares components and business logic with the Tauri desktop shell                                                                                                                 |
| Mobile apps             | React Native (Expo)                                                                                                                                      | Maximizes code/logic reuse with the React web and desktop codebases                                                                                                               |
| Shared logic            | TypeScript monorepo (Turborepo) with shared packages for domain types, validation (Zod), loan/interest calculations                                      | One amortization/penalty engine used identically by backend, desktop, web, and mobile                                                                                             |
| Auth                    | JWT access + refresh tokens, Argon2 password hashing, optional device biometric unlock                                                                   | Standard, works offline and online                                                                                                                                                |
| Payments                | M-Pesa Daraja API, bank API/SFTP reconciliation, manual cash entry with receipt numbers                                                                  | Covers mobile money, bank transfer, and cash at meetings                                                                                                                          |
| Notifications           | Africa's Talking or Twilio (SMS), Firebase Cloud Messaging (push), SMTP/Postmark (email)                                                                 | Reaches feature-phone and smartphone/web users alike                                                                                                                              |
| Background jobs         | BullMQ on Redis                                                                                                                                          | Interest accrual, penalty calculation, sync reconciliation                                                                                                                        |
| Hosting (SaaS)          | Docker containers on a managed platform — see Deployment Options below for the concrete free-tier-to-production path (Cloud Run, a VM, or Fly.io/Render) | Keeps ops overhead low for a small team                                                                                                                                           |
| Packaging (self-hosted) | Tauri's own bundler for signed installers (.msi, .dmg, .AppImage/.deb/.rpm)                                                                              | One installer gives a group a fully working system                                                                                                                                |
| CI/CD                   | GitHub Actions: lint/test/build on every PR, signed release builds per OS on tag                                                                         | Desktop installers must be code-signed per platform                                                                                                                               |

## Technology Trade-offs: A Closer Look

**Backend: NestJS vs. alternatives**

| Option                         | Strengths                                                                                                                                                                       | Trade-offs vs. NestJS                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| NestJS (Node/TS) — recommended | Shares TypeScript types, DTOs, and the loan/interest/penalty calculation code 1:1 with the web, desktop, and mobile clients; large ecosystem for payment SDKs; fast to hire for | Lower raw throughput and weaker compile-time guarantees than Go/Kotlin/Rust at extreme scale — not a real constraint at SACCO scale |
| Go (Gin/Fiber)                 | Single small static binary, ideal for the self-hosted embedded server; higher raw performance                                                                                   | No shared code with TS clients — the amortization/penalty formulas need a second, independently maintained implementation           |
| Kotlin / Java (Spring Boot)    | Very mature for transactional, financial-grade backends                                                                                                                         | Same code-sharing loss as Go, plus a heavier runtime                                                                                |
| Rust (Axum/Actix)              | Matches the Tauri shell's language; one language across embedded server + desktop                                                                                               | Slower dev velocity; still no sharing with TS clients — a future option for one hot path, not a day-one rewrite                     |

**Verdict:** keep NestJS. The deciding factor is that the same loan/penalty/validation logic can be imported, unchanged, into the backend, web, desktop, and mobile — removing the single biggest offline-sync risk (client/server disagreeing on a balance).

**Mobile: React Native vs. Flutter (Dart) vs. Kotlin**

| Option                            | Strengths                                                                                              | Trade-offs                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| React Native (Expo) — recommended | Shares the domain-logic package with backend/web; largest hiring pool; mature offline SQLite libraries | Slightly behind Flutter on raw UI/animation performance — largely irrelevant for a forms-and-tables ledger app |
| Flutter (Dart)                    | Native compile, smooth animations, mature drift/sqflite local-db story                                 | No code sharing with the TS backend — logic ported and maintained a second time                                |
| Kotlin (native, or KMM)           | Best native feel/performance on Android; KMM shares logic Android/iOS                                  | Plain Kotlin forces a separate Swift iOS app; KMM iOS tooling younger; no sharing with TS backend either way   |

**Verdict:** React Native, for the same reason as the backend choice. Flutter is a legitimate second choice with a Flutter-strong team.

**Desktop local database: is SQLite the best fit?** Yes — both recommended sync engines (PowerSync, ElectricSQL) are purpose-built around a Postgres-server/SQLite-client pairing. Embedded Postgres would double installer size and slow startup for no benefit at this data scale. DuckDB was ruled out (OLAP, not OLTP).

## Offline-First Data & Sync Strategy

1. **Local write path.** The desktop app always writes to local SQLite first, never blocking on the network; every write also appends to a local outbox table.
2. **Sync engine.** PowerSync or ElectricSQL streams the outbox to central Postgres when online, and streams changes back down — per-tenant sync without a hand-built replication protocol.
3. **Conflict resolution.** Financial writes are immutable, append-only ledger entries, not mutable balances, so most "conflicts" are simple merges. Balances are always derived by summing the ledger, never stored and fought over.
4. **Non-additive conflicts** (e.g. two officers edit a loan's interest rate offline) use last-writer-wins plus a visible "changed elsewhere" flag — never a silent overwrite of financial terms.
5. **Tenant isolation in sync** is enforced server-side via Postgres row-level security scoped by `group_id`, not just client-side filtering.
6. **Degraded modes are explicit in the UI** — "Offline — N changes pending sync."

## Scalability & Load Balancing (Optional, Toggle-On)

Ships simple by default, scales by flipping configuration, not by rewriting code.

- **API layer:** stateless NestJS API (JWT auth, no in-memory session) runs as 1 replica by default, scales to N behind a load balancer by changing a replica count — no code change. Realtime features use a Redis-backed adapter from day one so this stays free later.
- **Database, default:** one managed Postgres instance, serving dozens to low hundreds of tenant groups.
- **Database, read scaling (opt-in):** enable read replicas, route read-heavy queries via a `DATABASE_READ_URL` env var defaulting to the primary — the whole change, since every query already goes through a repository/data-access layer.
- **Database, write scaling / sharding (opt-in, later):** tenant-based sharding (Citus, or a `group_id → shard` lookup) if a deployment reaches thousands of tenant groups.
- **Static assets and self-hosted installs are unaffected** — CDN by default; self-hosted is single-tenant by construction.

## Deployment Options: From Free Pilot to Production

This is about the hosted SaaS side specifically — a self-hosted installer is deployed by the group itself. The architecture's stateless API + Dockerized build is what makes moving between these options a configuration change, not a rewrite.

**The options compared**

| Option                                                                                                          | What it is                                                                                                                                                    | Best for                                                                                                                                                                                                                                                           | Trade-off                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Cloud Run (serverless containers)                                                                        | Runs the same Docker image; scales to zero, autoscales, managed TLS + load balancer included                                                                  | Pilot and early production — pay only for usage, no servers to patch                                                                                                                                                                                               | Cold starts after scale-to-zero; poor fit for a long-running worker alone; per-instance limits                                                                              |
| A VM (Compute Engine, DigitalOcean/Hetzner, etc.) running the same `docker-compose.yml` as self-hosted installs | One or more persistent servers managed directly                                                                                                               | Predictable, steady-state load; teams wanting full control                                                                                                                                                                                                         | You own patching/upgrades/scaling                                                                                                                                           |
| Fly.io / Render / Railway                                                                                       | A middle ground — same Docker image, less serverless specialization, less manual ops                                                                          | A quick low-effort alternative during evaluation                                                                                                                                                                                                                   | Smaller free tiers than Cloud Run's; less autoscaling headroom                                                                                                              |
| Oracle Cloud "Always Free" (Ampere VM)                                                                          | Up to 4 Ampere A1 OCPUs / 24GB RAM (splittable across up to 4 VMs), permanently free, plus a free Flexible Load Balancer (10 Mbps) and 10TB/month free egress | A single, fully self-contained free environment with real headroom — the whole stack (API, worker, Postgres, Redis) via the same `docker-compose.yml` (self-hosted shape — `docker compose up -d`), with spare capacity to test the load-balancing toggle for free | No managed Postgres in the free tier (self-hosted on the VM instead); ARM architecture needs multi-arch images; free-tier capacity can be hard to provision in busy regions |

**Two equally valid $0 starting points**

- **Path A — serverless-first:** Cloud Run + Neon/Supabase (genuinely free-forever Postgres, scales to zero) + Upstash (free serverless Redis) + Vercel/Cloudflare Pages/Firebase Hosting (web) + Google Play Internal Testing / Apple TestFlight (mobile — the $25 Play Console fee and $99/yr Apple Developer Program are the only real mobile costs, unavoidable since Apple requires it for a device install) + GitHub Actions (CI). The one real-world pilot cost: a custom domain (~$10–15/yr); Cloud Run's default `*.run.app` URL is free.
- **Path B — single-VM (Oracle Cloud Always Free):** one Ampere A1 VM runs the entire stack via the same `docker-compose.yml` used for self-hosted installs — the pilot environment and the self-hosted product are literally the same artifact. Optionally split into two small instances behind Oracle's free load balancer to exercise the load-balancing toggle before paying for one elsewhere. Web app can sit on Vercel/Cloudflare in front, or be served from the same VM.

Both paths deploy the identical Docker images used everywhere else — the choice is infrastructure, not application.

**A caveat on Vercel:** its free Hobby tier is, by Vercel's own terms, for personal/non-commercial use — once serving real welfare groups, Pro is the compliant choice, not something to quietly outgrow. Its storage marketplace (Vercel Postgres = Neon, Vercel KV = Upstash under the hood) can consolidate billing with no technical difference.

**Handling background jobs on Cloud Run:** a scale-to-zero service is a poor fit for a persistent BullMQ worker. Either run scheduled jobs (interest accrual, penalties) as **Cloud Run Jobs** triggered by **Cloud Scheduler**, or run the worker as its own Cloud Run service with `min-instances: 1` for a small, predictable always-on cost.

**Moving to production:**

1. Move each free-tier managed service to its paid tier (removes storage/traffic/connection caps).
2. Set `min-instances: 1`+ on the API service to remove cold starts.
3. Enable the read-replica/multi-replica toggles already designed above, if and when load calls for it.
4. Point the custom domain; Cloud Run manages the TLS cert automatically.
5. If steady-state load favors it, the same Docker images can move to a VM or GKE later — nothing in the app assumes Cloud Run specifically.

## Loan, Interest, Penalty & Waiver Engine

- **Loan products are configurable, not hard-coded** — e.g. "Emergency loan": 3x savings cap, 5% flat/month, 3-month term; "Development loan": 2x savings cap, 10% reducing balance/year, 12-month term.
- **Amortization engine** computes the repayment schedule at disbursement (flat-rate or reducing-balance, configurable per product) as an immutable schedule.
- **Penalty engine** runs as a scheduled job: an unpaid installment past its grace period accrues a penalty, posted as its own ledger line — never silently folded into principal.
- **Waivers are a workflow, not a direct edit** — requires approval (single approver, or committee quorum via a meeting resolution) before a reversing ledger entry is posted. The original charge, the reversal, requester, approver, and reason are all kept.
- **Delinquency reporting** (arrears aging, at-risk members) is a read-model built off the ledger, correct automatically as waivers/payments/penalties post.

## Audit Logging

Every mutating action in every module — a contribution, a disbursement, a penalty, a waiver, a resolution, a role change — writes an immutable audit record.

- **Captured:** actor (user, device, IP), action type, affected entity, before/after snapshot, timestamp, and a link to the ledger entry it produced.
- **Insert-only, enforced at the database:** the app's DB role has INSERT but not UPDATE/DELETE on the audit table; each record stores a hash of the previous one (hash-chained) so tampering outside the app is detectable.
- **Works offline too** — captured locally, synced like any other row; a treasurer can't quietly edit history without it surfacing as a gap on next sync.
- **Retention & export:** retained indefinitely by default; exportable by date range as CSV/PDF.
- **Surfaced to users:** an "Activity" view per member/loan/wallet in plain language, not just a regulator export.

## Implementation Roadmap

| Phase                                         | Focus                                                                                            | Key deliverables                                       | Exit criteria                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 0. Discovery (2-3 wks)                        | Confirm regulatory scope (SASRA, data protection), finalize loan/penalty rules with a real group | Requirements doc, domain model, compliance checklist   | Stakeholders sign off on the ledger model and loan rules                   |
| 1. Core ledger & API (4-6 wks)                | Double-entry ledger, membership, contributions, wallet, multi-tenant auth                        | Backend API + admin web screens                        | A pilot group's contributions can be recorded and reconciled               |
| 2. Loan engine (4-5 wks)                      | Loan products, amortization, penalties, waivers                                                  | Loan module end-to-end                                 | A test loan can be disbursed, repaid late, penalized, and waived correctly |
| 3. Meetings & reporting (3 wks)               | Meetings/minutes/resolutions, statements, reports                                                | Meetings module, core reports                          | A pilot group runs one real meeting through the system                     |
| 4. Desktop packaging + offline sync (5-6 wks) | Tauri shell, local SQLite, sync engine, conflict handling                                        | Signed Windows/macOS/Linux installers                  | App works fully offline for a full day, then syncs cleanly                 |
| 5. Mobile + web polish (4-5 wks)              | React Native app, installable PWA, notifications                                                 | Mobile apps in internal testing, web app installable   | Member can view balance and get a payment reminder                         |
| 6. Donations & environment module (2 wks)     | Project/budget tracking for community activities                                                 | Donations module                                       | A pilot group tracks one project's budget vs. actuals                      |
| 7. Security review & pilot (3-4 wks)          | Pen test/code review, backup/restore drill, pilot with 1-2 groups                                | Security report, pilot feedback                        | No critical findings open; books balance for a full month                  |
| 8. Distribution & launch                      | App store submissions, installer signing/notarization, SaaS go-live                              | Public installers, app store listings, onboarding docs | First group fully live                                                     |

Total: roughly 7-9 months for a small team (2-4 engineers), assuming phases 1-3 and the client phases 4-5 overlap somewhat.

## Packaging & Distribution

| Platform | Format                                 | Notes                                                                 |
| -------- | -------------------------------------- | --------------------------------------------------------------------- |
| Windows  | Signed .msi via Tauri's bundler        | Needs an Authenticode cert; auto-update via Tauri's updater           |
| macOS    | Signed + notarized .dmg                | Needs an Apple Developer account; notarization is mandatory           |
| Linux    | .AppImage (universal) + .deb/.rpm      | AppImage needs zero install step                                      |
| Web      | Installable PWA                        | Standard PWA manifest                                                 |
| iOS      | App Store (TestFlight for pilot)       | Budget extra time for financial-app review scrutiny                   |
| Android  | Google Play (closed testing for pilot) | Declare financial-services data handling in the Play data safety form |

For the self-hosted installer: bundle the API server, background worker, and SQLite (or embedded Postgres) into one desktop package — one installer, no separate server setup.

## Engineering Practices & Developer Tooling

**Code organization & maintainability**

- Turborepo monorepo: `apps/` (api, web, mobile, desktop) + `packages/` (domain, ui, config, types). Lint-enforced boundaries: `apps/*` depends on `packages/*`, never on other apps; framework code never reaches into `packages/domain`.
- One typed config module per app (Zod-validated at startup) — a bad env var fails fast, never a silent fallback.
- Every optional toggle (read replicas, sharding, sync) is a named config entry, not scattered `process.env.X` checks.
- TypeScript `strict: true` + `noUncheckedIndexedAccess` everywhere; near-full branch coverage on the loan engine specifically.
- Conventional Commits as the house style — what makes automated changelogs/version bumps possible.

**Pre-commit hooks & local branch protection**

- Husky + lint-staged (format/lint/type-check on changed files at `pre-commit`); scoped unit tests at `pre-push`.
- commitlint on `commit-msg` rejects non-conventional commits before they're even on a branch.
- A local `pre-commit` branch guard blocks direct commits to `main` — a courtesy guardrail (bypassable with `--no-verify`); real enforcement is GitHub's server-side branch protection on top.
- gitleaks as a `pre-commit` hook to catch staged secrets before they're committed.

**Formatting, linting & import sorting**

- Prettier (shared config) for TS/JS/JSON/Markdown; `rustfmt` for the Tauri shell.
- ESLint + typescript-eslint + `simple-import-sort`; `clippy` for Rust at the same CI severity.
- `.editorconfig` at the repo root.

**Makefile** — one entrypoint across Docker/pnpm/Tauri: `dev`, `test`, `lint`, `migrate`, `desktop-build`, `release`.

**Dockerfiles & docker-compose**

- Multi-stage Dockerfiles (`deps` → `build` → slim runtime).
- One `docker-compose.yml` for both local dev and a self-hosted/production install: api, postgres, redis, mailpit, each with a healthcheck. Compose profiles gate the one service that's genuinely dev-only (mailpit — captures outgoing email instead of sending it); everything else that differs (restart policy, data directory) is an env var, not a second file (see `docs/adr/0003`).
- `.env.example` committed, `.env` gitignored; `docker-compose.override.yml` gitignored for personal tweaks.

**Releases, versioning & changelog**

- Changesets for independent per-package versioning (API, desktop, mobile don't share one version number).
- An auto-opened release PR bumps versions and writes `CHANGELOG.md`; merging it is the release.
- Git tags per app (`api-v1.4.0`, `desktop-v1.4.0`, etc.). GitHub Releases carry the changelog + signed installers.

**Keeping tags in sync with main** (the specific drift failure guarded against — a tag not actually reachable from `main`, from manual tagging, a stale local `main`, or tagging a branch instead of `main`'s real HEAD):

- Tags are created by CI only, on `main`'s own post-merge `push` event — never by hand.
- One merge strategy used consistently (e.g. squash-and-merge) so the tagged commit is unambiguous.
- Branch protection requires branches to be up to date before merging.
- The release pipeline asserts `git merge-base --is-ancestor <tag> origin/main` before publishing — fails loudly instead of shipping a drifted tag.
- Tag protection rules restrict pushing release-pattern tags to the release bot's token only.

**Other guardrails:** Renovate/Dependabot for dependency PRs; CODEOWNERS on `packages/domain` and auth/payments paths; a `docs/adr/` folder for Architecture Decision Records.

## Testing Strategy

| Layer                       | Tool                                                                      | What it covers                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Unit                        | Vitest/Jest, `cargo test`                                                 | Pure functions in `packages/domain`: interest, penalties, waiver math                                                       |
| Property-based / invariant  | fast-check                                                                | Ledger invariants for any input: debits = credits, wallet balance = sum of ledger entries, a waiver's reversal nets to zero |
| Integration                 | Jest/Vitest + Testcontainers                                              | Repository layer against a real Postgres, not a mock                                                                        |
| Contract                    | OpenAPI schema validation                                                 | API and every client agree on shapes — important since an offline client may run an older cached contract                   |
| End-to-end                  | Playwright (web + Tauri via `tauri-driver`), Maestro/Detox (React Native) | Full user flows, UI to database                                                                                             |
| Offline-sync scenario tests | Custom harness: two SQLite instances + one Postgres, scripted partitions  | The hardest risk in this plan — concurrent offline edits, assert a correct merge, not a silent loss/double-count            |
| Load/performance            | k6 or Artillery                                                           | Run around a deliberate scaling change, not routine CI                                                                      |

- CI blocks merge on lint/type-check/tests/coverage (~90%+ on `packages/domain`). Mutation testing (Stryker) runs periodically there too.
- `npm audit`/Snyk on every PR; external pen test in Roadmap Phase 7.
- Shared fixture factories (Fishery); migrations tested forward and backward.
- A manual UAT pass with the pilot group precedes every tagged release.

## Observability: Logging & Error Handling

**Fail soft, log loud**

- Every write path is wrapped so an unexpected error is caught, logged with context, and surfaced clearly — never a crash or silent no-op. Writes are all-or-nothing.
- A global exception filter (NestJS) / error boundary (React/RN) catches anything else and renders a recoverable state, not a crash — on desktop, an uncaught error must never take down the app mid-meeting; already-committed local data stays intact.
- Errors are classified at the throw site: _expected_ (validation, insufficient balance) handled inline, not logged as errors; _unexpected_ (DB drop, third-party timeout, a bug) logged at `error` with a stack trace and routed to the error tracker.

**Structured logging**

- JSON structured logs everywhere (Pino on the API); every line carries timestamp, level, service name, `tenant_id`, `user_id`, and a `correlation_id` threaded through the whole operation.
- One house standard for log levels, enforced in review.

**Centralized aggregation & error tracking (hosted SaaS)**

- Logs to an aggregator (Grafana Loki, or the host's log drain); Sentry for unhandled exceptions, grouped with `tenant_id`/`correlation_id`.
- `/healthz`/`/readyz` feed the load balancer; a failing check removes that replica from rotation.

**Self-hosted / offline is different, by necessity**

- Local rotating log files (size/age-capped), same JSON shape.
- A "Generate support bundle" action packages recent logs, app/DB version, and a redacted config snapshot — the realistic support path for a group with no ops team.
- Forwarding logs to the hosted Sentry/Loki is opt-in, consistent with the self-hosted privacy stance.

**Resilience around external integrations**

- Retry-with-backoff + circuit breakers around M-Pesa/bank/SMS calls.
- Background jobs run through BullMQ with a dead-letter queue — a failed accrual job is reviewable, not silently lost.

**Pipeline & release observability:** CI runs are logged with direct links from failing checks; the release pipeline reports its outcome to wherever the team watches alerts.

## Security, Compliance & Multi-Tenancy

- **Tenant isolation:** Postgres row-level security keyed on `group_id`; self-hosted is naturally single-tenant.
- **Encryption:** TLS in transit everywhere; encryption at rest for the hosted DB and the local SQLite file (SQLCipher).
- **RBAC:** treasurer, secretary, chair, member, admin roles; financial actions may require a second approver above a configurable amount.
- **Audit trail:** immutable, attributed to user/device/timestamp (see Audit Logging above).
- **Regulatory scope (to confirm with legal counsel):** a welfare group acting like a SACCO may fall under SASRA oversight in Kenya once it takes deposits and lends at scale.
- **Backups:** automated daily backups for hosted; one-click local backup/export for self-hosted.

## Data Protection & Privacy

- **Governing law (to confirm):** for a Kenya pilot, the Data Protection Act 2019 (ODPC) — financial data counts as sensitive personal data. Confirm registration/DPO requirements with counsel.
- **Data minimization:** each module collects only what it needs.
- **Consent and notice:** a plain-language privacy notice naming every third party that processes data; service communications aren't opt-out, anything beyond that is.
- **Data subject rights as product features:** a "My Data" screen for export, correction, erasure/objection requests, logged with an internal SLA.
- **Erasure vs. retention, resolved by rule:** an exited member's identifying fields are anonymized; ledger entries remain, keyed to an anonymized ID.
- **Data residency:** hosted SaaS defaults to a region matching the jurisdiction's transfer rules; self-hosted sidesteps most of this — data never leaves the group's own device except for chosen payment/SMS API calls.
- **Processor agreements** with every third party touching personal data.
- **No raw payment credentials stored** — tokenized references only.
- **Breach response:** a runbook with a 72-hour internal notification target.
- **Retention schedule:** ledger/audit data per statutory period; identifying PII for fully-exited members reviewed for anonymization after that period.

## Risks & Open Questions

- **Offline sync is the highest-risk technical component** — budget a 1-2 week spike on PowerSync/ElectricSQL against the real ledger schema first.
- **Regulatory status is unconfirmed** — get legal/compliance input before go-live, not just at launch.
- **Payment integration access** (M-Pesa Daraja production, bank agreements) often takes longer than the engineering — start in Phase 0.
- **Self-hosted support burden** — plan for auto-update and remote diagnostics from day one.
- **Pricing/business model** for the hybrid offering isn't yet decided and affects which features gate behind the hosted plan.
