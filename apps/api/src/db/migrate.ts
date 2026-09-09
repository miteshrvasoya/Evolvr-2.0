import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function getMigrationsDir(): Promise<string> {
  const localDir = path.join(__dirname, 'migrations');
  try {
    await fs.access(localDir);
    return localDir;
  } catch {
    return path.resolve(__dirname, '../../src/db/migrations');
  }
}

interface MigrationRow {
  name: string;
}

export async function runMigrations(): Promise<void> {
  console.log('🔄 Checking database migrations...');
  const migrationsDir = await getMigrationsDir();

  // Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // Fetch already applied migrations
  const appliedRows = await sql<MigrationRow[]>`
    SELECT name FROM schema_migrations ORDER BY id ASC;
  `;
  const appliedSet = new Set(appliedRows.map((r: MigrationRow) => r.name));

  // Read migration files
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter((f: string) => f.endsWith('.sql')).sort();

  const pendingFiles = sqlFiles.filter((f: string) => !appliedSet.has(f));

  if (pendingFiles.length === 0) {
    console.log('✅ All migrations are up to date.');
    return;
  }

  console.log(`Found ${pendingFiles.length} pending migration(s) to apply.`);

  for (const file of pendingFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    console.log(`Applying migration: ${file}...`);

    await sql.begin(async (trx) => {
      await trx.unsafe(content);
      await trx`
        INSERT INTO schema_migrations (name) VALUES (${file});
      `;
    });

    console.log(`✅ Applied migration: ${file}`);
  }

  console.log('🎉 Migrations finished successfully.');
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  runMigrations()
    .then(async () => {
      await sql.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Migration failed:', err);
      await sql.end();
      process.exit(1);
    });
}
