# 0007: Always use explicit `@Inject()`, never bare type-based constructor injection

Date: 2026-10-02
Status: accepted

## Context

`/auth/login` returned 500 with `Cannot read properties of undefined (reading
'login')` — `AuthController`'s constructor received `undefined` for its
`auth: AuthService` parameter. Confirmed with a direct debug log: Nest called
`new AuthController(undefined)`, with no error at bootstrap (Nest normally
throws loudly when it can't resolve a dependency — this was a silent `undefined`
instead).

Compiling with real `tsc` and running via plain `node` worked fine with the
_identical_ source — ruling out a logic bug and pointing at the dev-mode
toolchain (`tsx`, which transpiles via esbuild) specifically. Adding an
explicit `@Inject(AuthService)` to `AuthController` fixed that layer, which
only revealed the same failure one level deeper: `AuthService`'s own
constructor — `@Inject(DB) db` followed by a bare `jwt: JwtService` — had the
_second_, undecorated parameter resolving to `undefined` too. Making that one
explicit (`@Inject(JwtService)`) fixed it completely, confirmed by a full
request cycle: login → JWT issued → member created → audit entry recorded
with the correct actor ID.

The pattern in both failures: a constructor **mixing** an explicit `@Inject()`
parameter with a bare type-only one. `JwtAuthGuard`'s single bare parameter
(no other params, so nothing to "mix" with) worked fine on its own, which is
why this wasn't caught earlier — the failure mode isn't "bare injection never
works under tsx," it's specifically inconsistent once a constructor has a mix
of explicit and implicit parameters. The exact esbuild/tsx mechanism wasn't
fully pinned down (esbuild is documented to not implement TypeScript's
`emitDecoratorMetadata`, which is the likely underlying cause, but that alone
doesn't explain why single-bare-parameter cases worked) — the fix doesn't
depend on fully explaining it.

## Decision

Every constructor parameter needing DI, in every class, gets an explicit
`@Inject(Token)` — `MembersService`, `WalletService`, `LoansService` (their
`AuditService` parameter, same mixed-constructor shape as the original bug)
and `MembersController`, `WalletController`, `LoansController`,
`JwtAuthGuard` (single-parameter cases that happened to work, made explicit
anyway rather than trusted to keep working). No class in this codebase should
rely on bare type-based constructor injection going forward.

## Consequences

- One more line per injected dependency; in exchange, DI resolution no longer
  depends on a transpiler behavior this project doesn't fully control and
  can't verify is deterministic.
- Any new controller/service/guard added to `apps/api` must follow the same
  pattern — bare `constructor(private readonly x: X)` is not safe here,
  unlike in a typical NestJS project compiled only with `tsc`.
- This was caught by actually calling the endpoint after wiring something new
  (`create-admin`, then a real login), not by the test suite or a build —
  worth remembering as a reason `make dev`'s stack should get a real request
  fired at it after any DI-shaped change, not just a successful boot log.
