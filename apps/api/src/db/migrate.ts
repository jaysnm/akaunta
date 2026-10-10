import path from 'node:path';

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

expand(config({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true }));

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: path.resolve(import.meta.dirname, 'migrations') });
await sql.end();
console.log('Migrations applied.');
