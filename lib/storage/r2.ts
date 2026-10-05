import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getCloudflareBindings } from "@/lib/cloudflare/context";

/**
 * Cloudflare R2 ストレージクライアント
 */
const getS3Client = () => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "kanoha-materials";

/** インメモリ/ローカルモック用ストレージ（キー -> バッファ） */
const localMemoryStore = new Map<string, { buffer: Buffer; contentType: string }>();

export const uploadToR2 = async (
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; key: string }> => {
  // 1. Cloudflare Workers バインディングがある場合
  const storage = getCloudflareBindings()?.STORAGE;
  if (storage) {
    await storage.put(key, buffer, {
      httpMetadata: { contentType },
    });
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : `/api/materials/file?key=${encodeURIComponent(key)}`;
    return { url: publicUrl, key };
  }

  // 2. S3 クライアント（環境変数設定時）
  const s3 = getS3Client();
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${key}`
      : `/api/materials/file?key=${encodeURIComponent(key)}`;
    return { url: publicUrl, key };
  }

  // 3. ローカルモック
  localMemoryStore.set(key, { buffer, contentType });
  return {
    url: `/api/materials/file?key=${encodeURIComponent(key)}`,
    key,
  };
};

export const deleteFromR2 = async (key: string): Promise<boolean> => {
  const storage = getCloudflareBindings()?.STORAGE;
  if (storage) {
    await storage.delete(key);
    return true;
  }

  const s3 = getS3Client();
  if (s3) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
    );
    return true;
  }

  localMemoryStore.delete(key);
  return true;
};

export const getFromR2 = async (
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> => {
  const storage = getCloudflareBindings()?.STORAGE;
  if (storage) {
    const obj = await storage.get(key);
    if (!obj) return null;
    const arrayBuffer = await obj.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: obj.httpMetadata?.contentType || "application/octet-stream",
    };
  }

  const s3 = getS3Client();
  if (s3) {
    try {
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        }),
      );
      if (!res.Body) return null;
      const byteArray = await res.Body.transformToByteArray();
      return {
        buffer: Buffer.from(byteArray),
        contentType: res.ContentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  const found = localMemoryStore.get(key);
  return found || null;
};
