import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Fresh database with the real migrations applied. A temp file, not :memory:,
// because libsql gives a :memory: connection to transaction() and reopens empty.
// migrationsFolder resolves from the repo root, where vitest runs.
export async function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), 'golf-test-'));
  const client = createClient({ url: `file:${join(dir, 'test.db')}` });
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
  return db;
}
