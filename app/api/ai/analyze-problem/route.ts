import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { buildProblemRecords } from "@/lib/ai/buildProblemRecords";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromProblem } from "@/lib/ai/pii";
import { parsedProblemSchema, type ParsedProblem } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedMaterial } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";

const schema = z.object({ childId: uuid, materialId: uuid });

const ANALYZE_COST_USD = Number(process.env.AI_ANALYZE_COST_USD ?? 0.01);

export async function POST(request: Request) {
  const parsed = await parseJson(request, schema);
  if (!parsed.success) return apiError("Invalid analysis request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`analyze:${auth.user!.id}`, 10)) return apiError("Too many requests", 429);

  const material = await ownedMaterial(auth.supabase, parsed.data.childId, parsed.data.materialId);
  if (!material) return apiError("Material not found", 404);

  const provider = getAiProvider();
  if (provider.name === "mock") return analyzeWithMock(auth.supabase, material, provider);
  return analyzeWithGemini(auth, material, provider, parsed.data.childId);
}

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Material = NonNullable<Awaited<ReturnType<typeof ownedMaterial>>>;

async function analyzeWithMock(
  supabase: Auth["supabase"],
  material: Material,
  provider: ReturnType<typeof getAiProvider>,
) {
  // The mock provider is the single source of demo problems (canonical curriculum units).
  const [mock] = await provider.analyzeProblems([]);
  const validated = parsedProblemSchema.safeParse(mock);
  if (!validated.success) return internalError();
  return persistProblems(supabase, material, material.child_id, [validated.data], 0);
}

async function analyzeWithGemini(
  auth: Auth,
  material: Material,
  provider: ReturnType<typeof getAiProvider>,
  childId: string,
) {
  // 予約は必ずプロバイダ呼び出しの「前」。RPC不通は 503(フェイルクローズ、B10)。
  const reservation = await reserveAiUsage(auth.supabase, auth.user!.id, ANALYZE_COST_USD, costLimitsFromEnv());
  if (reservation.outcome === "unavailable") {
    return apiError("AIをいまは利用できません。しばらくしてからお試しください。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429);
  }

  await auth.supabase.from("uploaded_materials").update({ status: "analyzing" }).eq("id", material.id);

  try {
    const images = await Promise.all(
      (material.file_urls as string[]).map(async (path) => {
        const { data, error } = await auth.supabase.storage.from("materials").download(path);
        if (error || !data) throw new Error("Failed to download material image");
        const buffer = Buffer.from(await data.arrayBuffer());
        return { mimeType: material.file_type as string, data: buffer.toString("base64") };
      }),
    );

    // 1件ずつ検証し、有効な問題だけ保存する(B11)。検証失敗数は failed として親UIへ返す。
    const results = (await provider.analyzeProblems(images)).map((item) =>
      parsedProblemSchema.safeParse(item),
    );
    const problems = results.flatMap((result) => (result.success ? [result.data] : []));
    const failed = results.length - problems.length;
    if (problems.length === 0) {
      await auth.supabase.from("uploaded_materials").update({ status: "failed" }).eq("id", material.id);
      return NextResponse.json(
        {
          success: false,
          error: "問題を読み取れませんでした。画像を確認してもう一度お試しください。",
          data: { saved: 0, failed },
        },
        { status: 422 },
      );
    }
    return persistProblems(auth.supabase, material, childId, problems, failed);
  } catch {
    await auth.supabase.from("uploaded_materials").update({ status: "failed" }).eq("id", material.id);
    return apiError("画像の解析に失敗しました。もう一度お試しください。", 502);
  }
}

/** PII除去(scrubPiiFromProblem)は Zod 検証後・insert 前にここで一括適用する(B12)。 */
async function persistProblems(
  supabase: Auth["supabase"],
  material: Material,
  childId: string,
  problems: readonly ParsedProblem[],
  failed: number,
) {
  const scrubbed = problems.map(scrubPiiFromProblem);
  const { data, error } = await supabase
    .from("problems")
    .insert(buildProblemRecords(scrubbed, childId, material.id))
    .select("id, problem_text, unit, sub_unit, difficulty, status");
  if (error || !data?.length) {
    await supabase.from("uploaded_materials").update({ status: "failed" }).eq("id", material.id);
    return internalError();
  }
  await supabase.from("uploaded_materials").update({ status: "done" }).eq("id", material.id);
  return apiSuccess({ ...data[0], saved: data.length, failed, problems: data }, 201);
}
