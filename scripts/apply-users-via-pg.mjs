/**
 * Applies `007_ensure_public_users.sql` over a direct Postgres connection.
 *
 * 1) Supabase Dashboard → Project Settings → Database → copy the **URI** connection string
 *    (include password). Session mode is fine.
 * 2) Add to `.env.local`:  DATABASE_URL=postgresql://...
 * 3) From repo root:  npm run db:apply-users
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.error(
    "Set DATABASE_URL in .env.local to your Supabase Postgres URI (Dashboard → Database → Connection string → URI).",
  );
  process.exit(1);
}

const sqlPath = join(__dirname, "..", "supabase", "migrations", "007_ensure_public_users.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Applied", sqlPath);
} finally {
  await client.end();
}
