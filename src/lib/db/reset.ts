import 'dotenv/config';

import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { seed } from './seed';

const client = createClient({ url: process.env.DATABASE_URL! });

/**
 * Drops all tables in the database
 */
const dropAllTables = async () => {
  console.log('  🗑️  Dropping all tables...');

  // Disable foreign key constraints temporarily
  await client.execute('PRAGMA foreign_keys = OFF');

  // Get all table names
  const result = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE '__drizzle_%'`
  );

  const tables = result.rows.map((row) => ({ name: row.name as string }));

  // Drop each table
  for (const table of tables) {
    await client.execute(`DROP TABLE IF EXISTS "${table.name}"`);
    console.log(`    ✓ Dropped table: ${table.name}`);
  }

  // Re-enable foreign key constraints
  await client.execute('PRAGMA foreign_keys = ON');

  console.log('  ✅ All tables dropped');
};

/**
 * Runs all SQL migration files
 */
const runMigrations = async () => {
  console.log('  📦 Running migrations...');

  const migrationsDir = join(process.cwd(), 'src/lib/db/migrations');
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    // Split by statement-breakpoint
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await client.execute(statement);
    }

    console.log(`    ✓ Applied migration: ${file}`);
  }

  // Create the drizzle migrations table and record migrations
  await client.execute(
    `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      hash text PRIMARY KEY NOT NULL,
      created_at numeric
    )`
  );

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(sql).digest('hex');
    const timestamp = Date.now();

    await client.execute({
      sql: 'INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      args: [hash, timestamp],
    });
  }

  console.log('  ✅ Migrations complete');
};

/**
 * Resets the database by:
 * 1. Dropping all tables
 * 2. Running migrations
 * 3. Optionally seeding the database
 */
const resetDatabase = async (shouldSeed: boolean = true): Promise<void> => {
  console.log('🔄 Resetting database...');
  console.log('');

  try {
    // Step 1: Drop all tables
    await dropAllTables();
    console.log('');

    // Step 2: Run migrations
    await runMigrations();
    console.log('');

    // Step 3: Optionally seed
    if (shouldSeed) {
      try {
        await seed();
        console.log('');
      } catch (seedError) {
        console.error('❌ Seeding failed with error:');
        console.error(seedError);
        throw seedError;
      }
    }

    console.log('✅ Database reset complete!');
    client.close();
  } catch (error) {
    console.error('❌ Database reset failed');
    console.error(error);
    client.close();
    process.exit(1);
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSeed = !args.includes('--no-seed');

resetDatabase(shouldSeed);
