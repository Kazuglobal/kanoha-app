const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
export const MAX_UPLOAD_PAGES = 10;

const fileTypes = {
  "image/jpeg": { extension: "jpg", signatures: [[0xff, 0xd8, 0xff]] },
  "image/png": { extension: "png", signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  "image/webp": { extension: "webp", signatures: [[0x52, 0x49, 0x46, 0x46]] },
} as const;

async function readBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

export async function validateImage(file: File) {
  const type = fileTypes[file.type as keyof typeof fileTypes];
  if (!type || file.size < 4 || file.size > MAX_FILE_BYTES) return null;

  const bytes = await readBytes(file.slice(0, 12));
  const matches = type.signatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte),
  );
  if (!matches) return null;

  if (file.type === "image/webp") {
    const webp = String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!webp) return null;
  }
  return type.extension;
}
