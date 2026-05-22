import 'dotenv/config';
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const dbPassword = process.env.DB_PASSWORD;
const explicitDbHost = process.env.SUPABASE_DB_HOST;
const explicitDbPort = process.env.SUPABASE_DB_PORT
  ? Number(process.env.SUPABASE_DB_PORT)
  : 5432;
const explicitDbUser = process.env.SUPABASE_DB_USER;
const explicitDbName = process.env.SUPABASE_DB_NAME || 'postgres';
const sslCaPath = process.env.SUPABASE_DB_SSL_CA_FILE;
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

const sslConfig = sslCaPath
  ? { ca: readFileSync(sslCaPath, 'utf-8'), rejectUnauthorized: true }
  : { rejectUnauthorized: true };

function validateSupabaseDbHost(host) {
  const normalizedHost = host.toLowerCase();
  const allowedHosts = [
    `db.${supabaseRef}.supabase.co`,
  ];

  if (
    allowedHosts.includes(normalizedHost) ||
    normalizedHost.endsWith('.pooler.supabase.com')
  ) {
    return;
  }

  console.error(
    `Refusing to connect to untrusted database host "${host}". ` +
    'Use a Supabase direct host, a Supabase pooler host, or update the migration policy intentionally.'
  );
  process.exit(1);
}

// Try different connection methods
const connectionConfigs = [
  ...(explicitDbHost
    ? [
        {
          host: explicitDbHost,
          port: explicitDbPort,
          user: explicitDbUser || 'postgres',
          password: dbPassword,
          database: explicitDbName,
          ssl: sslConfig,
          connectionTimeoutMillis: 5000,
        },
      ]
    : []),
  // Direct connection
  {
    host: `db.${supabaseRef}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: sslConfig,
  },
  // Session mode pooler (try common regions)
  ...['us-east-1', 'eu-central-1', 'ap-southeast-1'].map((region) => ({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${supabaseRef}`,
    password: dbPassword,
    database: 'postgres',
    ssl: sslConfig,
    connectionTimeoutMillis: 5000,
  })),
];

for (const config of connectionConfigs) {
  validateSupabaseDbHost(config.host);
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

async function tryConnect(config) {
  const client = new pg.Client(config);
  await client.connect();
  return client;
}

async function main() {
  let client;
  let failedMigration = null;

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
    if (!sslCaPath) {
      console.error(
        'If the pooler reports a self-signed certificate chain, download the Supabase ' +
        'Server root certificate and set SUPABASE_DB_SSL_CA_FILE to its absolute path.'
      );
    }
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
      failedMigration = file;
      break;
    }
  }

  await client.end();

  if (failedMigration) {
    console.error(`Stopped after failed migration: ${failedMigration}`);
    process.exit(1);
  }

  console.log('Done!');
}

main();
