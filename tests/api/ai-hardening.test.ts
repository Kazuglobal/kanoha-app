import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockAiProvider } from "@/lib/ai/mock";
import type { AiProvider } from "@/lib/ai/provider";
import { callsFor, fakeSupabase, type QueryCall, type Row } from "@/tests/review/fakeSupabase";

const CHILD = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const PROBLEM = "33333333-3333-4333-8333-333333333333";
const MATERIAL = "44444444-4444-4444-8444-444444444444";

const state = vi.hoisted(() => ({
  provider: null as unknown,
  supabase: null as unknown,
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return {
    ...original,
    requireOwnedChild: vi.fn(async () => ({
      supabase: state.supabase,
      user: { id: "user-1" },
      response: null,
    })),
  };
});

vi.mock("@/lib/ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai")>();
  return { ...original, getAiProvider: () => state.provider as AiProvider };
});

const post = (path: string, body: Row) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const allowedRpc = () => ({ data: [{ allowed: true, calls: 1, cost_usd: 0.01 }], error: null });

const validParsedProblem = {
  problemText: "みどり小学校で くばられた もんだい。1Lは何mLですか。",
  correctAnswer: "1000mL",
  subject: "math",
  grade: 2,
  unit: "水のかさ",
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

const materialRow: Row = {
  id: MATERIAL,
  child_id: CHILD,
  file_urls: ["page-1.png"],
  file_type: "image/png",
  status: "uploaded",
};

const analyzeTables = () => ({
  uploaded_materials: (call: QueryCall) =>
    call.operation === "select" ? [materialRow] : [],
  problems: (call: QueryCall) =>
    call.operation === "insert" ? (call.payload as Row[]) : [],
});

const withStorage = (fake: ReturnType<typeof fakeSupabase>) => {
  (fake.client as { storage?: unknown }).storage = {
    from: () => ({
      // jsdom の Blob には arrayBuffer が無いため、ルートが使う形だけを持つスタブにする
      download: async () => ({
        data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as Blob,
        error: null,
      }),
    }),
  };
  return fake;
};

beforeEach(() => {
  state.provider = mockAiProvider;
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("IMAGE_GENERATION_MODEL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/ai/analyze-problem (per-item validation, B11)", () => {
  const geminiProvider = (items: readonly unknown[]) => ({
    ...mockAiProvider,
    analyzeProblems: vi.fn(async () => items),
    name: "gemini" as const,
  });

  it("saves valid items, drops invalid ones, scrubs PII, and reports { saved, failed }", async () => {
    const fake = withStorage(fakeSupabase({ tables: analyzeTables(), rpc: allowedRpc }));
    state.supabase = fake.client;
    state.provider = geminiProvider([validParsedProblem, { broken: true }]);
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.saved).toBe(1);
    expect(body.data.failed).toBe(1);
    const inserted = (callsFor(fake.calls, "problems", "insert")[0].payload as Row[])[0];
    expect(inserted.problem_text).toBe("〇〇で くばられた もんだい。1Lは何mLですか。");
    expect(JSON.stringify(inserted.explanation_json)).not.toContain("先生");
    const statuses = callsFor(fake.calls, "uploaded_materials", "update")
      .map((call) => (call.payload as Row).status);
    expect(statuses).toEqual(["analyzing", "done"]);
  });

  it("marks the material failed and returns { saved: 0, failed } when no item validates", async () => {
    const fake = withStorage(fakeSupabase({ tables: analyzeTables(), rpc: allowedRpc }));
    state.supabase = fake.client;
    state.provider = geminiProvider([{ broken: true }, { alsoBroken: true }]);
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.data).toEqual({ saved: 0, failed: 2 });
    const statuses = callsFor(fake.calls, "uploaded_materials", "update")
      .map((call) => (call.payload as Row).status);
    expect(statuses).toEqual(["analyzing", "failed"]);
  });

  it("fails closed with 503 when the usage RPC errors, without calling the provider", async () => {
    const fake = withStorage(fakeSupabase({
      tables: analyzeTables(),
      rpc: () => ({ data: null, error: { message: "down" } }),
    }));
    state.supabase = fake.client;
    const provider = geminiProvider([validParsedProblem]);
    state.provider = provider;
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }));

    expect(response.status).toBe(503);
    expect(provider.analyzeProblems).not.toHaveBeenCalled();
    expect(callsFor(fake.calls, "problems", "insert")).toHaveLength(0);
  });

  it("returns 429 when the reservation is denied", async () => {
    const fake = withStorage(fakeSupabase({
      tables: analyzeTables(),
      rpc: () => ({ data: [{ allowed: false, calls: 100, cost_usd: 2 }], error: null }),
    }));
    state.supabase = fake.client;
    state.provider = geminiProvider([validParsedProblem]);
    const { POST } = await import("@/app/api/ai/analyze-problem/route");

    const response = await POST(post("/api/ai/analyze-problem", { childId: CHILD, materialId: MATERIAL }));
    expect(response.status).toBe(429);
  });
});

describe("POST /api/ai/recognize-handwriting (payload hardening)", () => {
  const PNG_DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
  const JPEG_DATA = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64");

  const tables = () => ({ problems: () => [{ id: PROBLEM, child_id: CHILD, problem_text: "1Lは何mLですか。" }] });

  it("accepts an image whose magic bytes match the declared mimeType", async () => {
    state.supabase = fakeSupabase({ tables: tables() }).client;
    const { POST } = await import("@/app/api/ai/recognize-handwriting/route");

    const response = await POST(post("/api/ai/recognize-handwriting", {
      childId: CHILD, problemId: PROBLEM, image: { data: PNG_DATA, mimeType: "image/png" },
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ answer: "1000mL" });
  });

  it("rejects a mimeType/magic-byte mismatch with 400", async () => {
    state.supabase = fakeSupabase({ tables: tables() }).client;
    const { POST } = await import("@/app/api/ai/recognize-handwriting/route");

    const response = await POST(post("/api/ai/recognize-handwriting", {
      childId: CHILD, problemId: PROBLEM, image: { data: JPEG_DATA, mimeType: "image/png" },
    }));
    expect(response.status).toBe(400);
  });

  it("rejects oversized image data with 400", async () => {
    state.supabase = fakeSupabase({ tables: tables() }).client;
    const { POST } = await import("@/app/api/ai/recognize-handwriting/route");

    const response = await POST(post("/api/ai/recognize-handwriting", {
      childId: CHILD, problemId: PROBLEM,
      image: { data: "a".repeat(2_000_001), mimeType: "image/png" },
    }));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/ai/generate-hints (regeneration, not persisted)", () => {
  const tables = (maxLevel: number) => ({
    problems: () => [{
      id: PROBLEM, child_id: CHILD, problem_text: "1Lは何mLですか。", correct_answer: "1000mL",
      explanation_json: { hint1: "もとの h1", hint2: "もとの h2", solution: "もとの s", answer: "1000mL", praise: "もとの p" },
    }],
    learning_sessions: () => [{ id: SESSION }],
    problem_hint_views: () => [{ max_level: maxLevel }],
  });

  it("returns regenerated very_easy hints only up to max_level and stores nothing", async () => {
    const fake = fakeSupabase({ tables: tables(2) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/ai/generate-hints/route");

    const response = await POST(post("/api/ai/generate-hints", {
      childId: CHILD, problemId: PROBLEM, sessionId: SESSION, explanationLevel: "very_easy",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hint1).toBe("えを 見てみよう。");
    expect(body.data.hint2).toBe("100が 10こ あるよ。");
    expect(body.data).not.toHaveProperty("solution");
    expect(body.data).not.toHaveProperty("answer");
    expect(body.data.maxLevel).toBe(2);
    expect(callsFor(fake.calls, "problems", "update")).toHaveLength(0);
    expect(callsFor(fake.calls, "problems", "insert")).toHaveLength(0);
  });
});

describe("POST /api/ai/generate-image (template first, gated generation)", () => {
  const tables = (unit: string, enabled: boolean) => ({
    problems: () => [{ id: PROBLEM, child_id: CHILD, problem_text: "もんだい", unit }],
    app_settings: () => [{ enable_image_generation: enabled }],
  });

  it("returns the curriculum template for a known unit without touching settings", async () => {
    const fake = fakeSupabase({ tables: tables("水のかさ", false) });
    state.supabase = fake.client;
    const { POST } = await import("@/app/api/ai/generate-image/route");

    const response = await POST(post("/api/ai/generate-image", {
      childId: CHILD, problemId: PROBLEM, requestedByChild: true,
    }));
    const body = await response.json();

    expect(body.data).toEqual({ kind: "template", url: "/visuals/volume.svg" });
    expect(callsFor(fake.calls, "app_settings")).toHaveLength(0);
  });

  it("refuses AI generation when the parent has not enabled it (403)", async () => {
    state.supabase = fakeSupabase({ tables: tables("むかしの単元", false) }).client;
    const { POST } = await import("@/app/api/ai/generate-image/route");

    const response = await POST(post("/api/ai/generate-image", {
      childId: CHILD, problemId: PROBLEM, requestedByChild: true,
    }));
    expect(response.status).toBe(403);
  });

  it("returns 503 when enabled and reserved but the image provider is not configured", async () => {
    state.supabase = fakeSupabase({ tables: tables("むかしの単元", true), rpc: allowedRpc }).client;
    const { POST } = await import("@/app/api/ai/generate-image/route");

    const response = await POST(post("/api/ai/generate-image", {
      childId: CHILD, problemId: PROBLEM, requestedByChild: true,
    }));
    expect(response.status).toBe(503);
  });
});

describe("settings route exposes enable_image_generation without leaking the webhook secret", () => {
  const row: Row = {
    child_id: CHILD,
    explanation_level: "easy",
    daily_limit_minutes: 15,
    enable_audio: true,
    enable_voice_answer: true,
    enable_image_generation: true,
    enable_slack: true,
    slack_webhook_secret_id: "secret-id-1",
  };
  const context = { params: Promise.resolve({ childId: CHILD }) };

  it("GET returns the flag and masks the secret id", async () => {
    state.supabase = fakeSupabase({ tables: { app_settings: () => [row] } }).client;
    const { GET } = await import("@/app/api/settings/[childId]/route");

    const response = await GET(new Request("http://localhost/api/settings/x"), context);
    const body = await response.json();

    expect(body.data.enable_image_generation).toBe(true);
    expect(body.data.slack_configured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-id-1");
    expect(body.data).not.toHaveProperty("slack_webhook_secret_id");
  });

  it("PATCH upserts the flag and returns a masked row", async () => {
    const fake = fakeSupabase({
      tables: {
        app_settings: (call: QueryCall) =>
          call.operation === "upsert" ? [{ ...row, ...(call.payload as Row) }] : [row],
      },
    });
    state.supabase = fake.client;
    const { PATCH } = await import("@/app/api/settings/[childId]/route");

    const response = await PATCH(new Request("http://localhost/api/settings/x", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        explanationLevel: "easy", dailyLimitMinutes: 15,
        enableAudio: true, enableVoiceAnswer: true, enableImageGeneration: true,
      }),
    }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    const upsert = callsFor(fake.calls, "app_settings", "upsert")[0];
    expect((upsert.payload as Row).enable_image_generation).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret-id-1");
  });

  it("PATCH rejects a payload without enableImageGeneration", async () => {
    state.supabase = fakeSupabase({ tables: { app_settings: () => [row] } }).client;
    const { PATCH } = await import("@/app/api/settings/[childId]/route");

    const response = await PATCH(new Request("http://localhost/api/settings/x", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        explanationLevel: "easy", dailyLimitMinutes: 15, enableAudio: true, enableVoiceAnswer: true,
      }),
    }), context);
    expect(response.status).toBe(400);
  });
});
