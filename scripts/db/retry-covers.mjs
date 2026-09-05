// Retries cover lookup for albums still on the placeholder image, trying
// harder than the original bulk import: the stored ISBN, its ISBN-10/13
// counterpart, and finally an Open Library title search (a different
// edition of the same book may have a cover even when ours doesn't).
//
// Usage: node scripts/db/retry-covers.mjs
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const CONCURRENCY = 4;

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

function isbn13to10(isbn13) {
  if (isbn13.length !== 13 || !isbn13.startsWith("978")) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const remainder = (11 - (sum % 11)) % 11;
  const check = remainder === 10 ? "X" : String(remainder);
  return core + check;
}

function isbn10to13(isbn10) {
  if (isbn10.length !== 10) return null;
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(core[i]);
  const check = (10 - (sum % 10)) % 10;
  return core + String(check);
}

async function fetchOpenLibraryCoverByIsbn(isbn) {
  try {
    const res = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    return buf;
  } catch {
    return null;
  }
}

function normalizeTitle(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A result only counts as a match if its title and ours overlap
// meaningfully — Open Library's free-text relevance ranking otherwise
// happily returns an unrelated book (e.g. "Les 24h de la bd" once matched
// "The Complete Plays of William Shakespeare"). A wrong cover is worse
// than the placeholder, since nobody will think to double-check it.
function titlesMatch(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

async function findCoverByTitleSearch(title) {
  // Title only, no author: combining "Lastname, Firstname"-formatted authors
  // into the free-text query was found to suppress matches entirely rather
  // than narrow them (Open Library's relevance ranking doesn't handle the
  // comma well).
  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("q", title);
    url.searchParams.set("fields", "isbn,title");
    url.searchParams.set("limit", "5");
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    for (const doc of data.docs ?? []) {
      if (!titlesMatch(title, doc.title ?? "")) continue;
      for (const isbn of doc.isbn ?? []) {
        const bytes = await fetchOpenLibraryCoverByIsbn(isbn);
        if (bytes) return bytes;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function findBetterCover(album) {
  if (album.isbn) {
    const direct = await fetchOpenLibraryCoverByIsbn(album.isbn);
    if (direct) return direct;

    const alt = album.isbn.length === 13 ? isbn13to10(album.isbn) : isbn10to13(album.isbn);
    if (alt) {
      const altCover = await fetchOpenLibraryCoverByIsbn(alt);
      if (altCover) return altCover;
    }
  }
  return findCoverByTitleSearch(album.title);
}

async function uploadCover(bytes) {
  const webp = await sharp(bytes)
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `covers/${randomUUID()}.webp`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: webp,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${env.NEON_STORAGE_ENDPOINT}/${bucket}/${key}`;
}

async function worker(queue, client, stats) {
  while (queue.length) {
    const album = queue.shift();
    try {
      const bytes = await findBetterCover(album);
      if (bytes) {
        const url = await uploadCover(bytes);
        await client.query("update albums set cover_url = $1 where id = $2", [url, album.id]);
        stats.found++;
      } else {
        stats.stillMissing++;
      }
    } catch (err) {
      stats.failed.push({ id: album.id, title: album.title, error: err.message });
    }
    stats.done++;
    if (stats.done % 25 === 0) {
      console.log(`[${stats.done}/${stats.total}] trouvées=${stats.found} toujours absentes=${stats.stillMissing} erreurs=${stats.failed.length}`);
    }
  }
}

async function main() {
  const client = new pg.Client({ connectionString: env.NEON_DATABASE_URL });
  await client.connect();

  const placeholder = await client.query(
    "select cover_url, count(*) as n from albums group by cover_url having count(*) > 1 order by n desc limit 1",
  );
  if (placeholder.rows.length === 0) {
    console.log("Aucune couverture partagée (placeholder) trouvée — rien à faire.");
    await client.end();
    return;
  }
  const placeholderUrl = placeholder.rows[0].cover_url;
  console.log(`Placeholder détecté (${placeholder.rows[0].n} albums) : ${placeholderUrl}`);

  const limit = process.argv[2] ? Number(process.argv[2]) : null;
  const { rows } = await client.query(
    `select id, isbn, title from albums where cover_url = $1${limit ? " limit " + limit : ""}`,
    [placeholderUrl],
  );

  const stats = { total: rows.length, done: 0, found: 0, stillMissing: 0, failed: [] };
  const queue = [...rows];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue, client, stats)));

  await client.end();
  console.log("\n=== Terminé ===");
  console.log(`Total: ${stats.total}, nouvelles couvertures trouvées: ${stats.found}, toujours sans couverture: ${stats.stillMissing}`);
  if (stats.failed.length) {
    console.log(`Erreurs (${stats.failed.length}):`);
    for (const f of stats.failed) console.log(` - ${f.id} ${f.title}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
