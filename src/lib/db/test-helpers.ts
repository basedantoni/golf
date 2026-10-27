import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

// Fresh in-memory database with the real migrations applied.
// migrationsFolder resolves from the repo root, where vitest runs.
export async function createTestDb() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
  return db;
}
