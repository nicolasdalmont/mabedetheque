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
