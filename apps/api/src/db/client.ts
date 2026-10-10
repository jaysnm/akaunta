import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(databaseUrl: string): Database {
  return drizzle(postgres(databaseUrl), { schema });
}
