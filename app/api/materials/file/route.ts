import { NextResponse } from "next/server";
import { getFromR2 } from "@/lib/storage/r2";
import { getServerSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new NextResponse("Key is required", { status: 400 });
  }

  // 認証チェック: 自身の userId で始まるパスであるか確認 (パス構造: userId/childId/materialId/...)
  const session = await getServerSession();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const parts = key.split("/");
  if (parts[0] !== session.user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const file = await getFromR2(key);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
