# 0003: One docker-compose.yml for dev and self-hosted, not two

Date: 2026-10-02
Status: accepted

## Context

`docker-compose.selfhost.yml` duplicated most of `docker-compose.yml` (the
Redis ACL block, healthchecks, Postgres setup), and the two had already
drifted once in normal use — an orphaned volume declaration, a hardcoded
healthcheck user, a mount-path fix applied to one file and not the other.
Two files meant every infra change had to be made twice and kept in sync by
hand.

## Decision

One `docker-compose.yml`, split along the two things that actually differ:

- **Which services run** — solved with Compose profiles. `mailpit` (dev-only:
  captures outgoing email instead of sending it) is tagged `profiles: ["dev"]`.
  Confirmed empirically: a bare `docker compose up -d` (the self-hosted shape)
  never starts it, since nothing activates that profile. Also confirmed:
  _explicitly_ naming a profiled service (`docker compose up -d mailpit`)
  starts it regardless of profile activation — so `make dev`'s
  `docker compose up -d postgres redis mailpit` still works unchanged.
  One more gotcha found the same way: `docker compose down` _without_
  `--profile dev` leaves a running `mailpit` container orphaned (profile
  filtering applies to `down` too, not just `up`) — `make down`/`make logs`
  now pass `--profile dev` unconditionally so they always reach it, whether
  or not it happened to be running.
- **How the always-on services are configured** — solved with env-var
  substitution rather than two service definitions: `restart: ${RESTART_POLICY:-no}`
  (dev default vs. `unless-stopped` for a real install), and bind-mount
  volumes (`${PGDB_DATA_DIR:-./data/pgdb}`, `${REDIS_DATA_DIR:-./data/redis}`)
  used in both contexts instead of a named Docker volume in one and a bind
  mount in the other. Postgres/Redis ports are bound to `127.0.0.1` always,
  since nothing outside the host should reach them directly in either case —
  removing the need to conditionally publish/not-publish them at all.

## Consequences

- One file to keep correct; the Redis ACL block, healthchecks, and mount-path
  fix each exist exactly once now.
- `.env` (via `.env.example`) is the single place dev-vs-production
  differences are expressed — `RESTART_POLICY`, and real credentials instead
  of the dev defaults, for a production install.
- `make dev` (infra + mailpit, api runs natively) and `make up` (the whole
  product, self-hosted/production shape) are both one-line Make targets
  against this same file.
