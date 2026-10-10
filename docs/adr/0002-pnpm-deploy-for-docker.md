# 0002: Use `pnpm deploy` to build the API's Docker runtime stage

Date: 2026-10-02
Status: accepted

## Context

The first version of `apps/api/Dockerfile` copied `apps/api/node_modules`
straight into the runtime stage. It built, but the container crashed on boot
with `ERR_MODULE_NOT_FOUND: reflect-metadata` — confirmed by actually running
the built image, not just building it. The cause: pnpm's `node_modules` is a
tree of symlinks into a content-addressable store (`node_modules/.pnpm`) at
the workspace root; copying one package's `node_modules` folder alone carries
only dangling symlinks into a fresh image.

## Decision

Build stage runs `pnpm --filter @akaunta/api deploy --prod /out`, which
resolves the workspace package and its production dependencies into real
files (hard-linked, then self-contained) in one directory. The runtime stage
just copies `/out`. Both `packages/domain` and `apps/api` declare
`"files": ["dist"]` so `deploy` is guaranteed to include the compiled output
regardless of `.gitignore`.

## Consequences

- The runtime image has no symlink/workspace-resolution surprises — verified
  by actually running it against live Postgres/Redis containers and hitting
  `/healthz` and `/loans/schedule-preview`.
- Adding a new workspace package that the API depends on requires no Dockerfile
  change; `deploy` resolves whatever the lockfile says.
