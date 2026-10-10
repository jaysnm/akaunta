# 0004: Load and expand .env explicitly, from a path relative to the source file

Date: 2026-10-02
Status: accepted

## Context

`pnpm dev` (`tsx watch src/main.ts`, run via `pnpm --filter`/Turborepo) failed
immediately with every required env var reported as `undefined`, even with a
correctly filled-in `.env` at the repo root. Two separate causes, both
confirmed by testing, not assumed:

1. Nothing in the app ever loaded `.env` into `process.env` for the native
   path — only Docker Compose's `env_file:`/`environment:` wired env vars in,
   so running outside Docker had no env at all.
2. After adding `dotenv`, it still failed: `pnpm`/Turborepo run a package's
   scripts with that package's directory (`apps/api/`) as the working
   directory, not the repo root — so dotenv's default `process.cwd()`-relative
   lookup for `.env` silently found nothing.

Separately, `.env` needed `${VAR}` substitution (e.g. building `DATABASE_URL`
from `PG_USER`/`PG_PASSWORD`/...) so the connection pieces are defined once,
not duplicated into a literal URL — plain `.env` files don't do this on their
own.

## Decision

In `apps/api/src/config/env.ts`: `dotenv` + `dotenv-expand`, with the path
resolved explicitly from `import.meta.dirname` (`../../../../.env` — up from
`apps/api/src/config` to the repo root), not left to default to
`process.cwd()`. A missing file (the case inside Docker, where no `.env` is
ever copied into the image) is a silent no-op; the container's real env vars,
already injected by Compose, are unaffected either way.

## Consequences

- `pnpm dev` works from any directory the workspace tooling happens to invoke
  it from.
- `.env`/`.env.example` can define `PG_USER`, `PG_HOST_IP`, `PG_HOST_PORT`,
  etc. once and compose `DATABASE_URL`/`REDIS_URL` from them via `${VAR}`,
  rather than keeping a literal URL in sync by hand.
- `PG_HOST_IP`/`REDIS_HOST_IP` are shared between two consumers with
  different needs — Docker's port-bind address (must be a real IP) and the
  native app's connect host (a hostname would also work) — kept as one
  variable set to `127.0.0.1`, which satisfies both.
