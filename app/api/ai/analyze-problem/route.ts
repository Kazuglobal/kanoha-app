import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { buildProblemRecords } from "@/lib/ai/buildProblemRecords";
import { costLimitsFromEnv } from "@/lib/ai/costGuard";
import { scrubPiiFromProblem } from "@/lib/ai/pii";
import { parsedProblemSchema, type ParsedProblem } from "@/lib/ai/schemas";
import { reserveAiUsage } from "@/lib/ai/usage";
import * as schema from "@/lib/db/schema";
import { getFromR2 } from "@/lib/storage/r2";
import { apiError, apiSuccess, internalError, parseJson, requireOwnedChild } from "@/lib/utils/api";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { ownedMaterial } from "@/lib/utils/resources";
import { uuid } from "@/lib/utils/schemas";
import { nowJstIso } from "@/lib/utils/date";
import type { Database } from "@/lib/db";

const schemaValidation = z.object({ childId: uuid, materialId: uuid });
const ANALYZE_COST_USD = Number(process.env.AI_ANALYZE_COST_USD ?? 0.01);

export async function POST(request: Request) {
  const parsed = await parseJson(request, schemaValidation);
  if (!parsed.success) return apiError("Invalid analysis request");
  const auth = await requireOwnedChild(parsed.data.childId);
  if (auth.response) return auth.response;
  if (!checkRateLimit(`analyze:${auth.user!.id}`, 10)) return apiError("Too many requests", 429);

  const material = await ownedMaterial(parsed.data.childId, parsed.data.materialId, auth.db);
  if (!material) return apiError("Material not found", 404);

  const provider = getAiProvider();
  if (provider.name === "mock") return analyzeWithMock(auth.db, material, provider);
  return analyzeWithGemini(auth, material, provider, parsed.data.childId);
}

type Auth = Awaited<ReturnType<typeof requireOwnedChild>>;
type Material = NonNullable<Awaited<ReturnType<typeof ownedMaterial>>>;

async function analyzeWithMock(
  db: Database,
  material: Material,
  provider: ReturnType<typeof getAiProvider>,
) {
  const [mock] = await provider.analyzeProblems([]);
  const validated = parsedProblemSchema.safeParse(mock);
  if (!validated.success) return internalError();
  return persistProblems(db, material, material.childId, [validated.data], 0);
}

async function analyzeWithGemini(
  auth: Auth,
  material: Material,
  provider: ReturnType<typeof getAiProvider>,
  childId: string,
) {
  const reservation = await reserveAiUsage(
    auth.user!.id,
    ANALYZE_COST_USD,
    costLimitsFromEnv(),
    auth.db,
  );
  if (reservation.outcome === "unavailable") {
    return apiError("AIをいまは利用できません。しばらくしてからお試しください。", 503);
  }
  if (reservation.outcome === "denied") {
    return apiError("AIの利用上限に達しました。しばらくしてからお試しください。", 429);
  }

  await auth.db
    .update(schema.uploadedMaterials)
    .set({ status: "analyzing", updatedAt: nowJstIso() })
    .where(eq(schema.uploadedMaterials.id, material.id))
    .run();

  try {
    let fileUrls: string[] = [];
    try {
      fileUrls = JSON.parse(material.fileUrls);
    } catch {
      fileUrls = [];
    }

    const images = await Promise.all(
      fileUrls.map(async (path) => {
        const file = await getFromR2(path);
        if (!file) throw new Error("Failed to download material image");
        return { mimeType: material.fileType, data: file.buffer.toString("base64") };
      }),
    );

    const results = (await provider.analyzeProblems(images)).map((item) =>
      parsedProblemSchema.safeParse(item),
    );
    const problems = results.flatMap((result) => (result.success ? [result.data] : []));
    const failed = results.length - problems.length;
    if (problems.length === 0) {
      await auth.db
        .update(schema.uploadedMaterials)
        .set({ status: "failed", updatedAt: nowJstIso() })
        .where(eq(schema.uploadedMaterials.id, material.id))
        .run();
      return NextResponse.json(
        {
          success: false,
          error: "問題を読み取れませんでした。画像を確認してもう一度お試しください。",
          data: { saved: 0, failed },
        },
        { status: 422 },
      );
    }
    return persistProblems(auth.db, material, childId, problems, failed);
  } catch {
    await auth.db
      .update(schema.uploadedMaterials)
      .set({ status: "failed", updatedAt: nowJstIso() })
      .where(eq(schema.uploadedMaterials.id, material.id))
      .run();
    return apiError("画像の解析に失敗しました。もう一度お試しください。", 502);
  }
}

async function persistProblems(
  db: Database,
  material: Material,
  childId: string,
  problems: readonly ParsedProblem[],
  failed: number,
) {
  const scrubbed = problems.map(scrubPiiFromProblem);
  const records = buildProblemRecords(scrubbed, childId, material.id);
  const now = nowJstIso();

  try {
    const inserted = [];
    for (const record of records) {
      const row = await db
        .insert(schema.problems)
        .values({
          id: crypto.randomUUID(),
          childId: record.child_id,
          materialId: record.material_id,
          problemText: record.problem_text,
          problemImageUrl: null,
          subject: record.subject,
          grade: record.grade,
          unit: record.unit,
          subUnit: record.sub_unit,
          difficulty: record.difficulty,
          correctAnswer: record.correct_answer,
          explanationJson: JSON.stringify(record.explanation_json),
          status: record.status ?? "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: schema.problems.id,
          problem_text: schema.problems.problemText,
          unit: schema.problems.unit,
          sub_unit: schema.problems.subUnit,
          difficulty: schema.problems.difficulty,
          status: schema.problems.status,
        })
        .get();
      inserted.push(row);
    }

    if (inserted.length === 0) {
      await db
        .update(schema.uploadedMaterials)
        .set({ status: "failed", updatedAt: now })
        .where(eq(schema.uploadedMaterials.id, material.id))
        .run();
      return internalError();
    }

    await db
      .update(schema.uploadedMaterials)
      .set({ status: "done", updatedAt: now })
      .where(eq(schema.uploadedMaterials.id, material.id))
      .run();

    return apiSuccess({ ...inserted[0], saved: inserted.length, failed, problems: inserted }, 201);
  } catch {
    await db
      .update(schema.uploadedMaterials)
      .set({ status: "failed", updatedAt: now })
      .where(eq(schema.uploadedMaterials.id, material.id))
      .run();
    return internalError();
  }
}
