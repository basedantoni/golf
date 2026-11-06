import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { seed } from './seed';

const client = createClient({ url: process.env.DATABASE_URL! });

/**
 * Drops all tables in the database
 */
const dropAllTables = async () => {
  console.log('  🗑️  Dropping all tables...');

  // Disable foreign key constraints temporarily
  await client.execute('PRAGMA foreign_keys = OFF');

  // Get all table names, including the migrations journal so every migration re-applies
  const result = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'`
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
 * Applies migrations with Drizzle's migrator (same journal drizzle-kit migrate uses)
 */
const runMigrations = async () => {
  console.log('  📦 Running migrations...');
  await migrate(drizzle({ client }), { migrationsFolder: 'src/lib/db/migrations' });
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
