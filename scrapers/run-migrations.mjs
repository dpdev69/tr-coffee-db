import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  console.error('DB_PASSWORD env var is required. Set it in scrapers/.env or export it.');
  process.exit(1);
}

const supabaseRef = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
  : null;

if (!supabaseRef) {
  console.error('SUPABASE_URL env var is required.');
  process.exit(1);
}

// Try different connection methods
const connectionConfigs = [
  // Direct connection
  {
    host: `db.${supabaseRef}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  },
  // Session mode pooler (try common regions)
  ...['us-east-1', 'eu-central-1', 'ap-southeast-1'].map((region) => ({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${supabaseRef}`,
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })),
];

const migrationFiles = [
  '001_initial_schema.sql',
  '002_rls_policies.sql',
  '003_indexes.sql',
  '004_functions.sql',
  '005_seed_roasters.sql',
  '006_deactivate_coffee_sapiens.sql',
  '007_set_function_search_paths.sql',
];

async function tryConnect(config) {
  const client = new pg.Client(config);
  await client.connect();
  return client;
}

async function main() {
  let client;

  for (const config of connectionConfigs) {
    try {
      console.log(`Trying ${config.host}:${config.port}...`);
      client = await tryConnect(config);
      console.log('Connected!');
      break;
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }

  if (!client) {
    console.error('Could not connect to database with any method.');
    console.error('You may need to run migrations manually via the Supabase SQL Editor.');
    process.exit(1);
  }

  for (const file of migrationFiles) {
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, 'utf-8');
    console.log(`Running ${file}...`);
    try {
      await client.query(sql);
      console.log(`  OK`);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }

  await client.end();
  console.log('Done!');
}

main();
