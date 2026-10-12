import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockAiProvider } from "@/lib/ai/mock";
import type { AiProvider } from "@/lib/ai/provider";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nowJstIso } from "@/lib/utils/date";
import * as usageModule from "@/lib/ai/usage";
import * as r2Module from "@/lib/storage/r2";

const CHILD = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PROBLEM = "33333333-3333-4333-8333-333333333333";
const MATERIAL = "44444444-4444-4444-8444-444444444444";

const state = vi.hoisted(() => ({
  provider: null as unknown,
}));

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: async () => true,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({
      db: getDb(),
      user: { id: "user-ai-1" },
      response: null,
    })),
    requireUser: vi.fn(async () => ({
      db: getDb(),
      user: { id: "user-ai-1" },
    })),
  };
});

vi.mock("@/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai")>();
  return { ...original, getAiProvider: () => state.provider as AiProvider };
});

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validParsedProblem = {
  problemText: "みどり小学校で くばられた もんだい。1Lは何mLですか。",
  correctAnswer: "1000mL",
  subject: "math",
  grade: 4,
  unit: "小数のしくみと計算",
  subUnit: "LとmL",
  difficulty: "standard",
  hints: {
    hint1: "やまだ先生と ならったね。",
    hint2: "100mLが10こだよ。",
    solution: "100を10こ あつめます。",
    answer: "1000mL",
    praise: "よく見られたね。",
  },
  rubyTextRequired: true,
  recommendedVisualTemplate: "volume",
  similarProblemCount: 5,
};

describe("POST /api/ai/analyze-problem (per-item validation, B11)", () => {
  const db = getDb();
  const geminiProvider = (items: readonly unknown[]) => ({
    ...mockAiProvider,
    analyzeProblems: vi.fn(async () => items),
    name: "gemini" as const,
  });

  beforeEach(async () => {
    state.provider = mockAiProvider;
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("IMAGE_GENERATION_MODEL", "");

    vi.spyOn(r2Module, "getFromR2").mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      contentType: "image/png",
    });

    const now = nowJstIso();
    await db.delete(schema.problems).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-ai-1",
        name: "parent",
        email: "user-ai-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-ai-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: MATERIAL,
        childId: CHILD,
        fileUrls: JSON.stringify(["page-1.png"]),
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        status: "pending",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("saves valid items, drops invalid ones, scrubs PII, and reports { saved, failed }", async () => {
    vi.spyOn(usageModule, "reserveAiUsage").mockResolvedValue({
      outcome: "allowed",
      calls: 1,
      costUsd: 0.01,
    });
    state.provider = geminiProvider([validParsedProblem, { broken: true }]);
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(
      post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.saved).toBe(1);
    expect(body.data.failed).toBe(1);

    const inserted = await db
      .select()
      .from(schema.problems)
      .where(eq(schema.problems.childId, CHILD))
      .all();
    expect(inserted).toHaveLength(1);
    expect(inserted[0].problemText).toBe("〇〇で くばられた もんだい。1Lは何mLですか。");
    expect(inserted[0].explanationJson).not.toContain("先生");

    const mat = await db
      .select()
      .from(schema.uploadedMaterials)
      .where(eq(schema.uploadedMaterials.id, MATERIAL))
      .get();
    expect(mat?.status).toBe("done");
  });

  it("marks the material failed and returns { saved: 0, failed } when no item validates", async () => {
    vi.spyOn(usageModule, "reserveAiUsage").mockResolvedValue({
      outcome: "allowed",
      calls: 1,
      costUsd: 0.01,
    });
    state.provider = geminiProvider([{ broken: true }, { alsoBroken: true }]);
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(
      post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.data).toEqual({ saved: 0, failed: 2 });

    const mat = await db
      .select()
      .from(schema.uploadedMaterials)
      .where(eq(schema.uploadedMaterials.id, MATERIAL))
      .get();
    expect(mat?.status).toBe("failed");
  });

  it("fails closed with 503 when the usage RPC errors, without calling the provider", async () => {
    vi.spyOn(usageModule, "reserveAiUsage").mockResolvedValue({
      outcome: "unavailable",
    });
    const provider = geminiProvider([validParsedProblem]);
    state.provider = provider;
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(
      post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }),
    );

    expect(response.status).toBe(503);
    expect(provider.analyzeProblems).not.toHaveBeenCalled();
  });

  it("returns 429 when the reservation is denied", async () => {
    vi.spyOn(usageModule, "reserveAiUsage").mockResolvedValue({
      outcome: "denied",
      calls: 100,
      costUsd: 2,
    });
    state.provider = geminiProvider([validParsedProblem]);
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(
      post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }),
    );
    expect(response.status).toBe(429);
  });
});

describe("POST /api/ai/recognize-handwriting (payload hardening)", () => {
  const PNG_DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
  const JPEG_DATA = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();
    await db.delete(schema.problems).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-ai-1",
        name: "parent",
        email: "user-ai-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-ai-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-hw",
        childId: CHILD,
        fileUrls: "[]",
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-hw",
        problemText: "1Lは何mLですか。",
        correctAnswer: "1000mL",
        unit: "水のかさ",
        subUnit: "LとmL",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("accepts an image whose magic bytes match the declared mimeType", async () => {
    const { POST } = await import("@/app/api/ai/recognize-handwriting/route");

    const response = await POST(
      post("/api/ai/recognize-handwriting", {
        childId: CHILD,
        problemId: PROBLEM,
        image: { data: PNG_DATA, mimeType: "image/png" },
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ answer: "1000mL" });
  });

  it("rejects a mimeType/magic-byte mismatch with 400", async () => {
    const { POST } = await import("@/app/api/ai/recognize-handwriting/route");

    const response = await POST(
      post("/api/ai/recognize-handwriting", {
        childId: CHILD,
        problemId: PROBLEM,
        image: { data: JPEG_DATA, mimeType: "image/png" },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects oversized image data with 400", async () => {
    const { POST } = await import("@/app/api/ai/recognize-handwriting/route");

    const response = await POST(
      post("/api/ai/recognize-handwriting", {
        childId: CHILD,
        problemId: PROBLEM,
        image: { data: "a".repeat(2_000_001), mimeType: "image/png" },
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/ai/generate-hints (regeneration, not persisted)", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();
    await db.delete(schema.problemHintViews).run();
    await db.delete(schema.learningSessions).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-ai-1",
        name: "parent",
        email: "user-ai-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-ai-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-gh",
        childId: CHILD,
        fileUrls: "[]",
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-gh",
        problemText: "1Lは何mLですか。",
        correctAnswer: "1000mL",
        unit: "水のかさ",
        subUnit: "LとmL",
        explanationJson: JSON.stringify({
          hint1: "もとの h1",
          hint2: "もとの h2",
          solution: "もとの s",
          answer: "1000mL",
          praise: "もとの p",
        }),
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.learningSessions)
      .values({
        id: SESSION,
        childId: CHILD,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.problemHintViews)
      .values({
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        maxLevel: 2,
        updatedAt: now,
      })
      .run();
  });

  it("returns regenerated very_easy hints only up to max_level and stores nothing", async () => {
    const { POST } = await import("@/app/api/ai/generate-hints/route");

    const response = await POST(
      post("/api/ai/generate-hints", {
        childId: CHILD,
        problemId: PROBLEM,
        sessionId: SESSION,
        explanationLevel: "very_easy",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hint1).toBe("えを 見てみよう。");
    expect(body.data.hint2).toBe("100が 10こ あるよ。");
    expect(body.data).not.toHaveProperty("solution");
    expect(body.data).not.toHaveProperty("answer");
    expect(body.data.maxLevel).toBe(2);
  });
});

describe("POST /api/ai/generate-image (template first, gated generation)", () => {
  const db = getDb();

  beforeEach(async () => {
    const now = nowJstIso();
    await db.delete(schema.appSettings).run();
    await db.delete(schema.problems).run();
    await db.delete(schema.uploadedMaterials).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-ai-1",
        name: "parent",
        email: "user-ai-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-ai-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.uploadedMaterials)
      .values({
        id: "m-gi",
        childId: CHILD,
        fileUrls: "[]",
        fileType: "image/png",
        pageCount: 1,
        sourceType: "camera",
        expiresAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("returns the curriculum template for a known unit without touching settings", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-gi",
        problemText: "もんだい",
        unit: "水のかさ",
        subUnit: "",
        difficulty: "standard",
        correctAnswer: "1",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/ai/generate-image/route");

    const response = await POST(
      post("/api/ai/generate-image", {
        childId: CHILD,
        problemId: PROBLEM,
        requestedByChild: true,
      }),
    );
    const body = await response.json();

    expect(body.data).toEqual({ kind: "template", url: "/visuals/volume.svg" });
  });

  it("refuses AI generation when the parent has not enabled it (403)", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-gi",
        problemText: "もんだい",
        unit: "むかしの単元",
        subUnit: "",
        difficulty: "standard",
        correctAnswer: "1",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.appSettings)
      .values({
        id: "set-gi",
        childId: CHILD,
        enableImageGeneration: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const { POST } = await import("@/app/api/ai/generate-image/route");

    const response = await POST(
      post("/api/ai/generate-image", {
        childId: CHILD,
        problemId: PROBLEM,
        requestedByChild: true,
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 503 when enabled and reserved but the image provider is not configured", async () => {
    const now = nowJstIso();
    await db
      .insert(schema.problems)
      .values({
        id: PROBLEM,
        childId: CHILD,
        materialId: "m-gi",
        problemText: "もんだい",
        unit: "むかしの単元",
        subUnit: "",
        difficulty: "standard",
        correctAnswer: "1",
        explanationJson: "{}",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.appSettings)
      .values({
        id: "set-gi",
        childId: CHILD,
        enableImageGeneration: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    vi.spyOn(usageModule, "reserveAiUsage").mockResolvedValue({
      outcome: "allowed",
      calls: 1,
      costUsd: 0.01,
    });

    const { POST } = await import("@/app/api/ai/generate-image/route");

    const response = await POST(
      post("/api/ai/generate-image", {
        childId: CHILD,
        problemId: PROBLEM,
        requestedByChild: true,
      }),
    );
    expect(response.status).toBe(503);
  });
});

describe("settings route exposes enable_image_generation without leaking the webhook secret", () => {
  const db = getDb();
  const context = { params: Promise.resolve({ childId: CHILD }) };

  beforeEach(async () => {
    const now = nowJstIso();
    await db.delete(schema.appSettings).run();
    await db.delete(schema.childProfiles).run();

    await db
      .insert(schema.users)
      .values({
        id: "user-ai-1",
        name: "parent",
        email: "user-ai-1@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .run();

    await db
      .insert(schema.childProfiles)
      .values({
        id: CHILD,
        userId: "user-ai-1",
        nickname: "子",
        grade: 2,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await db
      .insert(schema.appSettings)
      .values({
        id: "set-s",
        childId: CHILD,
        explanationLevel: "easy",
        dailyLimitMinutes: 15,
        enableAudio: 1,
        enableVoiceAnswer: 1,
        enableImageGeneration: 1,
        enableSlack: 1,
        slackWebhookUrl: "https://hooks.slack.com/services/secret",
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  it("GET returns the flag and masks the secret id", async () => {
    const { GET } = await import("@/app/api/settings/[childId]/route");

    const response = await GET(new Request("http://localhost/api/settings/x"), context);
    const body = await response.json();

    expect(body.data.enable_image_generation).toBe(true);
    expect(body.data.slack_configured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("services/secret");
    expect(body.data).not.toHaveProperty("slack_webhook_url");
  });

  it("PATCH upserts the flag and returns a masked row", async () => {
    const { PATCH } = await import("@/app/api/settings/[childId]/route");

    const response = await PATCH(
      new Request("http://localhost/api/settings/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          explanationLevel: "easy",
          dailyLimitMinutes: 15,
          enableAudio: true,
          enableVoiceAnswer: true,
          enableImageGeneration: true,
        }),
      }),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    const row = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.childId, CHILD))
      .get();
    expect(Boolean(row?.enableImageGeneration)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("services/secret");
  });

  it("PATCH rejects a payload without enableImageGeneration", async () => {
    const { PATCH } = await import("@/app/api/settings/[childId]/route");

    const response = await PATCH(
      new Request("http://localhost/api/settings/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          explanationLevel: "easy",
          dailyLimitMinutes: 15,
          enableAudio: true,
          enableVoiceAnswer: true,
        }),
      }),
      context,
    );
    expect(response.status).toBe(400);
  });
});
