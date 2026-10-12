import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const bucket = process.env.NEON_STORAGE_BUCKET!;

const s3 = new S3Client({
  endpoint: process.env.NEON_STORAGE_ENDPOINT!,
  region: process.env.NEON_STORAGE_REGION ?? "auto",
  credentials: {
    accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY!,
  },
  // Required for Neon's custom S3-compatible endpoint (path-style addressing:
  // https://endpoint/bucket/key, rather than https://bucket.endpoint/key).
  forcePathStyle: true,
});

// Object Storage buckets are branch-scoped and served at
// `${endpoint}/${bucket}/${key}` for `public_read` buckets.
function publicUrl(key: string): string {
  const endpoint = process.env.NEON_STORAGE_ENDPOINT!.replace(/\/$/, "");
  return `${endpoint}/${bucket}/${key}`;
}

export async function uploadCover(
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
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

export async function deleteCover(coverUrl: string): Promise<void> {
  const endpoint = process.env.NEON_STORAGE_ENDPOINT!.replace(/\/$/, "");
  const prefix = `${endpoint}/${bucket}/`;
  if (!coverUrl.startsWith(prefix)) return; // not one of ours (e.g. never replaced)
  const key = coverUrl.slice(prefix.length);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function bucketPrefix(): string {
  return `${process.env.NEON_STORAGE_ENDPOINT!.replace(/\/$/, "")}/${bucket}/`;
}

/**
 * Copies a cover already in our bucket to a NEW key and returns its URL.
 * Used when a user adopts the cover of another account's album with the same
 * ISBN: covers are never shared by URL, because deleting or replacing one
 * album's cover deletes the object (DELETE /api/covers) and would break the
 * other album. Refuses anything outside our bucket.
 */
export async function copyCover(sourceUrl: string): Promise<string> {
  if (!sourceUrl.startsWith(bucketPrefix())) {
    throw new Error("URL de couverture non autorisée.");
  }
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Couverture source introuvable.");
  const contentType = res.headers.get("content-type") ?? "image/webp";
  return uploadCover(new Uint8Array(await res.arrayBuffer()), contentType);
}
