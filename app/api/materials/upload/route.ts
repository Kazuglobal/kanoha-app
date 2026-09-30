import * as schema from "@/lib/db/schema";
import { uploadToR2, deleteFromR2 } from "@/lib/storage/r2";
import { sourceType } from "@/lib/utils/schemas";
import { apiError, apiSuccess, internalError, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimitDb } from "@/lib/utils/rateLimit";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES, validateImage } from "@/lib/utils/upload";
import { nowJstIso } from "@/lib/utils/date";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 1024 * 1024) return apiError("Upload is too large", 413);
  const form = await request.formData().catch(() => null);
  if (!form) return apiError("Invalid form data");

  const childId = String(form.get("childId") ?? "");
  const parsedSource = sourceType.safeParse(form.get("sourceType"));
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (
    !parsedSource.success ||
    files.length < 1 ||
    files.length > MAX_UPLOAD_PAGES ||
    totalBytes > MAX_UPLOAD_BYTES
  ) {
    return apiError("Invalid upload");
  }

  const auth = await requireOwnedChild(childId);
  if (auth.response) return auth.response;
  if (!(await checkRateLimitDb(auth.user!.id, "materials-upload", 10))) {
    return apiError("Too many requests", 429);
  }
  const validated = await Promise.all(files.map(validateImage));
  if (validated.some((extension) => !extension)) return apiError("Invalid image file");

  const materialId = crypto.randomUUID();
  const paths = files.map(
    (_, index) => `${auth.user!.id}/${childId}/${materialId}/page-${index + 1}.${validated[index]}`,
  );

  const uploadedKeys: string[] = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await uploadToR2(paths[index], buffer, file.type);
      uploadedKeys.push(res.key);
    }
  } catch {
    await Promise.all(uploadedKeys.map(deleteFromR2));
    return internalError();
  }

  const retention = Math.min(90, Math.max(1, Number(process.env.MATERIAL_RETENTION_DAYS) || 30));
  const expiresAt = new Date(Date.now() + retention * 86_400_000).toISOString();
  const now = nowJstIso();

  try {
    const created = await auth.db
      .insert(schema.uploadedMaterials)
      .values({
        id: materialId,
        childId,
        fileUrls: JSON.stringify(paths),
        fileType: files[0].type,
        pageCount: files.length,
        sourceType: parsedSource.data,
        status: "pending",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: schema.uploadedMaterials.id,
        status: schema.uploadedMaterials.status,
      })
      .get();

    return apiSuccess(created, 201);
  } catch {
    await Promise.all(uploadedKeys.map(deleteFromR2));
    return internalError();
  }
}
