# 0005: JwtModule.registerAsync, not .register, for the auth secret

Date: 2026-10-02
Status: accepted

## Context

`/auth/login` failed with `secretOrPrivateKey must have a value`, under both
`tsx watch` and a real `tsc` build — ruling out a dev-tooling quirk. Cause:
`AuthModule` did `JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })`.
That options object is built eagerly, during `AuthModule`'s own
`@Module({ imports: [...] })` decorator evaluation — which happens as soon as
`main.ts` imports `AppModule`, and that import runs **before** `main.ts`'s own
`loadEnv()` call (and the `dotenv`/`dotenv-expand` side effect inside it) has
populated `process.env`. `JWT_ACCESS_SECRET` was still `undefined` at the
moment `.register()` read it.

## Decision

`JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.JWT_ACCESS_SECRET, ... }) })`.
A factory is called by Nest at actual provider-instantiation time (inside
`NestFactory.create()`, which `main.ts` calls after `loadEnv()`), not at
module-definition time.

## Consequences

- Any future `XModule.register({ ...process.env... })` in this codebase
  should default to `registerAsync` + `useFactory` instead, for the same
  reason — it's not specific to JWT.
- `DbModule`'s provider (`useFactory: () => createDb(process.env.DATABASE_URL!)`)
  was already correct for this reason, which is why it never showed the
  equivalent symptom.
