// One-off bulk import: reads a JSON file produced by prepare-import.py,
// fetches a cover per album (Open Library; Google Books is opt-in via
// GOOGLE_BOOKS_API_KEY since anonymous quota is easy to exhaust), uploads
// it to Neon Object Storage, and inserts the row directly via Postgres
// (bypassing the Data API/RLS — connected as the table owner).
//
// Usage: node scripts/db/run-import.mjs <rows.json> <owner_user_id>
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const ROWS_PATH = process.argv[2];
const OWNER_ID = process.argv[3];
const CONCURRENCY = 4;

if (!ROWS_PATH || !OWNER_ID) {
  console.error("Usage: node scripts/db/run-import.mjs <rows.json> <owner_user_id>");
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

const s3 = new S3Client({
  endpoint: env.NEON_STORAGE_ENDPOINT,
  region: env.NEON_STORAGE_REGION,
  credentials: {
    accessKeyId: env.NEON_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.NEON_STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});
const bucket = env.NEON_STORAGE_BUCKET;

function publicUrl(key) {
  return `${env.NEON_STORAGE_ENDPOINT}/${bucket}/${key}`;
}

async function uploadCover(bytes, contentType) {
  const key = `covers/${randomUUID()}.webp`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrl(key);
}

async function processAndUpload(bytes) {
  const webp = await sharp(bytes)
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return uploadCover(webp, "image/webp");
}

async function fetchOpenLibraryCover(isbn) {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null; // OL's "no cover" placeholder
    return buf;
  } catch {
    return null;
  }
}

async function makePlaceholderCover() {
  const svg = `<svg width="600" height="900" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="900" fill="#e4e4e7"/>
    <text x="300" y="450" font-family="sans-serif" font-size="28" fill="#71717a" text-anchor="middle">Couverture indisponible</text>
  </svg>`;
  const bytes = new Uint8Array(Buffer.from(svg));
  return processAndUpload(bytes);
}

async function worker(id, queue, client, placeholderUrl, stats) {
  while (queue.length) {
    const row = queue.shift();
    try {
      let coverUrl = placeholderUrl;
      if (row.isbn) {
        const bytes = await fetchOpenLibraryCover(row.isbn);
        if (bytes) {
          coverUrl = await processAndUpload(bytes);
          stats.withCover++;
        } else {
          stats.placeholder++;
        }
      } else {
        stats.placeholder++;
      }

      await client.query(
        `insert into albums
           (owner_id, isbn, title, series_name, issue_number, publisher,
            writer, illustrator, legal_deposit, purchase_date, comment, cover_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          OWNER_ID,
          row.isbn,
          row.title,
          row.series_name,
          row.issue_number,
          row.publisher,
          row.writer,
          row.illustrator,
          row.legal_deposit,
          row.purchase_date,
          row.comment,
          coverUrl,
        ],
      );
      stats.done++;
    } catch (err) {
      stats.failed.push({ source_id: row.source_id, title: row.title, error: err.message });
    }
    if (stats.done % 25 === 0) {
      console.log(`[${stats.done}/${stats.total}] ok=${stats.withCover} placeholder=${stats.placeholder} failed=${stats.failed.length}`);
    }
  }
}

async function main() {
  const rows = JSON.parse(readFileSync(ROWS_PATH, "utf-8"));
  const client = new pg.Client({ connectionString: env.NEON_DATABASE_URL });
  await client.connect();

  console.log("Uploading placeholder cover...");
  const placeholderUrl = await makePlaceholderCover();
  console.log("Placeholder:", placeholderUrl);

  const stats = { total: rows.length, done: 0, withCover: 0, placeholder: 0, failed: [] };
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i, queue, client, placeholderUrl, stats)),
  );

  await client.end();

  console.log("\n=== Import terminé ===");
  console.log(`Total: ${stats.total}, insérés: ${stats.done}, avec couverture réelle: ${stats.withCover}, placeholder: ${stats.placeholder}`);
  if (stats.failed.length) {
    console.log(`Échecs (${stats.failed.length}):`);
    for (const f of stats.failed) console.log(` - ${f.source_id} ${f.title}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
