import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { defineConfig } from 'drizzle-kit';

// Same cwd caveat as apps/api/src/config/env.ts: resolved relative to this
// file, not process.cwd(), since drizzle-kit runs with apps/api as cwd.
// drizzle-kit's loader doesn't populate import.meta.dirname, hence fileURLToPath.
const here = path.dirname(fileURLToPath(import.meta.url));
expand(config({ path: path.resolve(here, '../../.env'), quiet: true }));

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
