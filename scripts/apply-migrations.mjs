import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import pg from "pg";

const { Client } = pg;

const databaseUrl = process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL is required.");
}

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const ensureMigrationTable = async () => {
  await client.query("create schema if not exists app_private;");
  await client.query(`
    create table if not exists app_private.scn_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
};

const getMigrationFiles = async () => {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
};

const hasMigrationRun = async (name) => {
  const result = await client.query(
    "select 1 from app_private.scn_migrations where name = $1",
    [name],
  );

  return result.rowCount > 0;
};

const applyMigration = async (name) => {
  const fullPath = path.join(migrationsDir, name);
  const sql = await fs.readFile(fullPath, "utf8");

  await client.query("begin");
  try {
    await client.query(sql);
    await client.query(
      "insert into app_private.scn_migrations (name) values ($1)",
      [name],
    );
    await client.query("commit");
    console.log(`Applied ${name}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};

await client.connect();

try {
  await ensureMigrationTable();

  const migrations = await getMigrationFiles();

  for (const migration of migrations) {
    if (await hasMigrationRun(migration)) {
      console.log(`Skipped ${migration}`);
      continue;
    }

    await applyMigration(migration);
  }
} finally {
  await client.end();
}
