import path from 'node:path';

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { z } from 'zod';

// Loads and expands .env (resolving ${VAR} references like DATABASE_URL using
// PG_USER/PG_PASSWORD/...) for `pnpm dev` running natively on the host. Inside
// Docker there is no .env file in the image — the container's real env vars
// are already injected by Compose, and a missing file here is a silent no-op.
// Resolved relative to this file, not process.cwd(): pnpm/turbo run the `dev`
// script with apps/api as the working directory, not the monorepo root where
// .env actually lives.
expand(config({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true }));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  /** Defaults to the primary when unset or blank — see the Scalability section's read-replica toggle. */
  DATABASE_READ_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

/** Fails fast on a missing/malformed env var instead of surfacing a bad default in production. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
