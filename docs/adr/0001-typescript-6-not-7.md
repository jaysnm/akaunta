# 0001: Pin TypeScript to 6.0.x, not the 7.0 "tsgo" rewrite

Date: 2026-10-02
Status: accepted

## Context

TypeScript 7.0 (the Go-ported compiler) is npm's `latest` dist-tag. Our lint
stack (`@typescript-eslint` 8.71.0) declares a peer range of
`>=4.8.4 <6.1.0` and fails outright on TS 7.0.2 ("typescript-eslint does not
support TS 7.0") — confirmed by running `eslint` against it, not just reading
the peer range. A 7.1 line exists only as nightly dev builds as of this date,
with no stable release yet.

## Decision

Pin `typescript` to `^6.0.3` (the latest version actually inside
typescript-eslint's supported range) everywhere in the monorepo, instead of
the newer but currently-incompatible 7.x line.

## Consequences

- Lint and type-check both run cleanly.
- Revisit this pin once `@typescript-eslint` ships a release supporting TS
  7.1+ (tracked upstream) — this is a "latest compatible," not "latest,"
  choice and should be upgraded when the ecosystem catches up.
