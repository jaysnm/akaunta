/**
 * Creates a login account — the only way to get one, since there's no
 * self-service signup endpoint by design (accounts are admin-managed).
 *
 * Usage:
 *   pnpm --filter @akaunta/api run create-admin -- \
 *     --email you@example.com --password secret123 --group "My Welfare Group"
 *
 * To add another login to an EXISTING group instead of creating a new one,
 * pass --group-id <uuid> in place of --group.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

const here = path.dirname(fileURLToPath(import.meta.url));
expand(config({ path: path.resolve(here, '../../../.env'), quiet: true }));

const { createDb } = await import('../src/db/client.js');
const { groups, users } = await import('../src/db/schema.js');
const { hashPassword } = await import('../src/auth/password.js');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const email = arg('email');
const password = arg('password');
const groupName = arg('group');
const existingGroupId = arg('group-id');
const role = arg('role') ?? 'admin';

if (!email || !password || (!groupName && !existingGroupId)) {
  console.error(
    'Usage: pnpm --filter @akaunta/api run create-admin -- --email you@example.com --password secret --group "My Welfare Group" [--role admin]',
  );
  console.error(
    '   or: ... --group-id <existing-group-uuid> instead of --group, to add a login to an existing group',
  );
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);

const groupId =
  existingGroupId ?? (await db.insert(groups).values({ name: groupName! }).returning())[0]!.id;

const [user] = await db
  .insert(users)
  .values({
    groupId,
    email,
    passwordHash: hashPassword(password),
    role: role as 'admin' | 'treasurer' | 'secretary' | 'member',
  })
  .returning();

console.log(`Created ${user!.role} login: ${user!.email}`);
console.log(`Group ID: ${groupId}`);
console.log('Log in at the web app (http://localhost:3100) with this email and password.');
process.exit(0);
