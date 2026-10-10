# Akaunta

A welfare/SACCO group management platform: member contributions, a group wallet, loans with interest and penalties, waivers, meetings, and donation/environment activities. Ships as a hosted multi-tenant SaaS and as a self-hosted, offline-capable installable package from the same codebase.

See **[docs/implementation-plan.md](docs/implementation-plan.md)** for the full architecture, tech stack, roadmap, and rationale (also maintained as a live doc, linked at the top of that file).

## Status

Core ledger/loan vertical slice, backend to browser. Working so far, verified against a live instance (not just unit tests):

- `packages/domain` — the shared ledger (double-entry primitives) and loan amortization/penalty engine, with property-based tests (fast-check) over the financial invariants.
- `apps/api` — a real, persisted backend: Postgres via Drizzle ORM (`src/db/schema.ts`, migrations in `src/db/migrations/`), JWT auth (`/auth/login`, scrypt-hashed passwords — Argon2 was the plan's original pick, avoided here to skip a native addon in the Docker image), and multi-tenant-scoped modules for Members, Wallet/Contributions, and Loans (products, disbursement with a real generated schedule, repayments, penalties, waivers) — every mutation writes to the hash-chained Audit Log. Swagger UI at `/docs` in non-production (`NODE_ENV=production` disables it).
- `apps/web` — a minimal Next.js admin UI: login, a dashboard (members + contributed amounts + group wallet balance + loan list), and a loan detail page (schedule + record-a-repayment). Not yet verified in an actual browser (the Claude-in-Chrome extension wasn't connected in this environment) — confirmed instead via a clean production build, type-check, and the exact API contract it calls against, all exercised live.
- `apps/api/scripts/seed.ts` — populates a realistic group (3 members, contributions, a disbursed+part-paid loan with a waived penalty) directly against the database; run with `pnpm --filter @akaunta/api run seed`.
- Full tooling: pnpm workspaces + Turborepo, ESLint/Prettier, Husky pre-commit/commit-msg/pre-push hooks, a Makefile, and a working multi-stage Docker build (`pnpm deploy`-based, verified to actually boot against Postgres/Redis).

**Not yet built** (later roadmap phases, deliberately out of scope for this pass): meetings, donations/environment projects, reporting, payments integration (M-Pesa), notifications (SMS/email/push), mobile and desktop apps, offline sync, and running migrations automatically on deploy (`make db-migrate` is still a manual step after pulling schema changes). See the roadmap in the plan for sequencing.

## Getting started

```sh
cp .env.example .env
make dev        # infra + migrations + every app in dev mode (api :3000, web :3100)
make db-seed    # optional: realistic test data
make test
make lint
```

The API serves `localhost:3000` (Swagger at `/docs`); the web app serves `localhost:3100` (log in with `treasurer@jirani.test` / `change-me` after seeding). `make help` lists every available command, including `db-generate`/`db-migrate`/`db-seed`.

## Self-hosting

The same `docker-compose.yml` also runs the whole product as a self-contained
install — set real credentials and `RESTART_POLICY=unless-stopped` in `.env`,
then:

```sh
docker compose up -d   # postgres, redis, api — mailpit (dev-only) stays off
```

See `docs/adr/0003-single-compose-file-with-profiles.md` for why one file
covers both shapes.

## Repo layout

```
apps/           deployable applications (api, web; mobile/desktop to follow)
packages/       shared libraries (domain logic, soon: ui, types)
docs/           implementation plan, ADRs, product docs — see docs/README.md
```
