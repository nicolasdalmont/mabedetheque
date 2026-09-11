// Applies a SQL migration file against NEON_DATABASE_URL (direct Postgres
// connection, bypasses the Data API) — for environments without `psql`.
// Executes the file's full contents as one (possibly multi-statement)
// command, same as `psql -f`.
//
// Usage: node scripts/db/run-migration.mjs db/migrations/000X_xxx.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/db/run-migration.mjs <path-to-migration.sql>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    }),
);

const sql = readFileSync(file, "utf-8");

const client = new pg.Client({ connectionString: env.NEON_DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log(`Migration appliquée : ${file}`);
} finally {
  await client.end();
}
