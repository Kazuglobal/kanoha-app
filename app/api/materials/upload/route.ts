import { sourceType } from "@/lib/utils/schemas";
import { apiError, apiSuccess, internalError, requireOwnedChild } from "@/lib/utils/api";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PAGES, validateImage } from "@/lib/utils/upload";

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
  const validated = await Promise.all(files.map(validateImage));
  if (validated.some((extension) => !extension)) return apiError("Invalid image file");

  const materialId = crypto.randomUUID();
  const paths = files.map(
    (_, index) => `${auth.user!.id}/${childId}/${materialId}/page-${index + 1}.${validated[index]}`,
  );
  const uploads = await Promise.all(
    files.map((file, index) =>
      auth.supabase.storage.from("materials").upload(paths[index], file, {
        contentType: file.type,
        upsert: false,
      }),
    ),
  );
  if (uploads.some(({ error }) => error)) {
    const uploadedPaths = uploads.flatMap((upload, index) => upload.error ? [] : [paths[index]]);
    if (uploadedPaths.length) await auth.supabase.storage.from("materials").remove(uploadedPaths);
    return internalError();
  }

  const retention = Math.min(90, Math.max(1, Number(process.env.MATERIAL_RETENTION_DAYS) || 30));
  const expiresAt = new Date(Date.now() + retention * 86_400_000).toISOString();
  const { data, error } = await auth.supabase
    .from("uploaded_materials")
    .insert({
      id: materialId,
      child_id: childId,
      file_urls: paths,
      file_type: files[0].type,
      page_count: files.length,
      source_type: parsedSource.data,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, status, page_count, expires_at")
    .single();

  if (error) {
    await auth.supabase.storage.from("materials").remove(paths);
    return internalError();
  }
  return apiSuccess(data, 201);
}
