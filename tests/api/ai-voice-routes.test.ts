import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  allowed: true,
  limitCalls: [] as Array<{ key: string; action: string; limit: number; windowSeconds?: number }>,
  speech: { success: true, audioDataUrl: "data:audio/wav;base64,AAAA" } as Record<string, unknown>,
  speechArgs: [] as unknown[],
  transcript: "I like apples" as string | null,
  transcribeThrows: false,
  transcribeArgs: [] as unknown[],
}));

vi.mock("@/lib/utils/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils/api")>();
  return { ...original, requireUser: vi.fn(async () => ({ db: {}, user: state.user })) };
});

vi.mock("@/lib/utils/rateLimit", () => ({
  checkRateLimit: () => true,
  checkRateLimitDb: vi.fn(async (key: string, action: string, limit: number, windowSeconds?: number) => {
    state.limitCalls.push({ key, action, limit, windowSeconds });
    return state.allowed;
  }),
}));

vi.mock("@/lib/ai/tts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/tts")>();
  return {
    ...original,
    generateGeminiSpeech: vi.fn(async (options: unknown) => {
      state.speechArgs.push(options);
      return state.speech;
    }),
  };
});

vi.mock("@/lib/ai/stt", () => ({
  transcribeAudio: vi.fn(async (options: unknown) => {
    state.transcribeArgs.push(options);
    if (state.transcribeThrows) throw new Error("Gemini API secret-detail 500");
    return state.transcript;
  }),
}));

const AUDIO = "A".repeat(200);

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  state.user = null;
  state.allowed = true;
  state.limitCalls.length = 0;
  state.speech = { success: true, audioDataUrl: "data:audio/wav;base64,AAAA" };
  state.speechArgs.length = 0;
  state.transcript = "I like apples";
  state.transcribeThrows = false;
  state.transcribeArgs.length = 0;
});

describe("POST /api/ai/tts", () => {
  const call = async (body: unknown, headers?: Record<string, string>) =>
    (await import("@/app/api/ai/tts/route")).POST(post("/api/ai/tts", body, headers));

  it("serves anonymous demo visitors, limited per client IP and by a shared daily budget", async () => {
    const res = await call({ text: "こんにちは" }, { "cf-connecting-ip": "203.0.113.7" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(state.limitCalls.map((c) => c.key.replace(/:\d{4}-\d{2}-\d{2}$/, ""))).toEqual([
      "ip:203.0.113.7",
      "anonymous",
    ]);
    // 共有の1日枠は日本時間の日付ごと(日付が変われば枠も新しくなる)
    expect(state.limitCalls[1].key).toMatch(/^anonymous:\d{4}-\d{2}-\d{2}$/);
    expect(state.limitCalls[1].windowSeconds).toBe(86_400);
  });

  it("ignores the spoofable x-forwarded-for header when picking the limiter key", async () => {
    await call({ text: "hi" }, { "x-forwarded-for": "198.51.100.9", "cf-connecting-ip": "203.0.113.7" });
    expect(state.limitCalls[0].key).toBe("ip:203.0.113.7");
    state.limitCalls.length = 0;
    await call({ text: "hi" }, { "x-forwarded-for": "198.51.100.9" });
    expect(state.limitCalls[0].key).not.toContain("198.51.100.9");
  });

  it("limits signed-in users per user (per minute and per day)", async () => {
    state.user = { id: "user-1" };
    const res = await call({ text: "こんにちは" });
    expect(res.status).toBe(200);
    expect(state.limitCalls.map((c) => `${c.key.replace(/:\d{4}-\d{2}-\d{2}$/, "")}/${c.action}`)).toEqual([
      "user-1/tts",
      "user-1/tts-daily",
      "signed-in/tts-daily-global",
    ]);
    expect(state.limitCalls[2].key).toMatch(/^signed-in:\d{4}-\d{2}-\d{2}$/);
  });

  it("does not spend any budget on invalid requests (validated before the shared limits)", async () => {
    await call({ text: "   " }, { "cf-connecting-ip": "203.0.113.7" });
    await call("{not json", { "cf-connecting-ip": "203.0.113.7" });
    expect(state.limitCalls).toHaveLength(0);
  });

  it("rejects oversized bodies by Content-Length before reading them", async () => {
    const res = await call({ text: "hi" }, { "content-length": "100000" });
    expect(res.status).toBe(413);
    expect(state.limitCalls).toHaveLength(0);
    expect(state.speechArgs).toHaveLength(0);
  });

  it("stops reading a streamed body (no Content-Length) once it passes the cap", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1_024));
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 200) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const res = await (await import("@/app/api/ai/tts/route")).POST(
      new Request("http://localhost/api/ai/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThan(40); // 8KB の上限を少し超えたところで読むのをやめる(200KB 全部は読まない)
    expect(state.limitCalls).toHaveLength(0);
    expect(state.speechArgs).toHaveLength(0);
  });

  it("lets operators switch demo voice off with TTS_ANON_DAILY_LIMIT=0 (0 is a valid value)", async () => {
    vi.stubEnv("TTS_ANON_DAILY_LIMIT", "0");
    try {
      await call({ text: "hi" }, { "cf-connecting-ip": "203.0.113.7" });
      expect(state.limitCalls[1].limit).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("returns 429 and never calls Gemini when over the limit", async () => {
    state.allowed = false;
    const res = await call({ text: "こんにちは" }, { "cf-connecting-ip": "203.0.113.7" });
    expect(res.status).toBe(429);
    expect(state.speechArgs).toHaveLength(0);
  });

  it("does not spend the shared anonymous budget when the per-IP limit already denied", async () => {
    state.allowed = false;
    await call({ text: "hi" }, { "cf-connecting-ip": "203.0.113.7" });
    expect(state.limitCalls).toHaveLength(1);
  });

  it("validates input: empty text and malformed JSON are 400, not 500", async () => {
    expect((await call({ text: "   " })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call("{not json")).status).toBe(400);
    expect(state.speechArgs).toHaveLength(0);
  });

  it("falls back to safe defaults for unknown voice, mood and language, and truncates long text", async () => {
    await call({ text: "あ".repeat(500), voiceName: "Evil\nvoice", mood: "angry", lang: "fr" });
    expect(state.speechArgs[0]).toEqual({
      text: "あ".repeat(300),
      mood: "happy",
      voiceName: "Aoede",
      lang: "ja",
    });
  });

  it("never leaks upstream error details to the client", async () => {
    state.speech = { success: false, fallback: true, error: "Gemini API (m) returned 400: secret-detail" };
    const res = await call({ text: "hi" });
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("secret-detail");
    expect(text).toContain("fallback");
  });
});

describe("POST /api/ai/stt", () => {
  const call = async (body: unknown, headers?: Record<string, string>) =>
    (await import("@/app/api/ai/stt/route")).POST(post("/api/ai/stt", body, headers));

  it("requires a signed-in user and never calls Gemini without one", async () => {
    const res = await call({ audioBase64: AUDIO });
    expect(res.status).toBe(401);
    expect(state.transcribeArgs).toHaveLength(0);
  });

  it("limits signed-in users per minute and per day", async () => {
    state.user = { id: "user-1" };
    await call({ audioBase64: AUDIO });
    expect(state.limitCalls.map((c) => `${c.key.replace(/:\d{4}-\d{2}-\d{2}$/, "")}/${c.action}`)).toEqual([
      "user-1/stt",
      "user-1/stt-daily",
      "signed-in/stt-daily-global",
    ]);
  });

  it("rejects oversized bodies by Content-Length before reading them or charging limits", async () => {
    state.user = { id: "user-1" };
    const res = await call({ audioBase64: AUDIO }, { "content-length": "5000000" });
    expect(res.status).toBe(413);
    expect(state.limitCalls).toHaveLength(0);
    expect(state.transcribeArgs).toHaveLength(0);
  });

  it("returns 429 when over the limit", async () => {
    state.user = { id: "user-1" };
    state.allowed = false;
    expect((await call({ audioBase64: AUDIO })).status).toBe(429);
    expect(state.transcribeArgs).toHaveLength(0);
  });

  it("transcribes through the lib/ai wrapper with the scene context", async () => {
    state.user = { id: "user-1" };
    const res = await call({ audioBase64: AUDIO, mimeType: "audio/webm;codecs=opus", lang: "en-US" });
    expect(await res.json()).toEqual({ success: true, transcript: "I like apples" });
    // コーデックなどの指定は落とし、基本の型だけを Gemini へ渡す
    expect(state.transcribeArgs[0]).toMatchObject({ audioBase64: AUDIO, mimeType: "audio/webm" });
  });

  it("rejects missing, wrongly typed or oversized audio and bad MIME types", async () => {
    state.user = { id: "user-1" };
    expect((await call({ audioBase64: "" })).status).toBe(400);
    expect((await call({ audioBase64: 123 })).status).toBe(400);
    expect((await call("{not json")).status).toBe(400);
    expect((await call({ audioBase64: "A".repeat(2_000_001) })).status).toBe(413);
    await call({ audioBase64: AUDIO, mimeType: "text/html\r\nX-Evil: 1" });
    expect(state.transcribeArgs[0]).toMatchObject({ mimeType: "audio/webm" });

    for (const [sent, expected] of [
      ['audio/mp4; codecs="mp4a.40.2"', "audio/mp4"],
      ["audio/ogg; codecs=opus", "audio/ogg"],
      ["audio/mp4", "audio/mp4"],
    ]) {
      state.transcribeArgs.length = 0;
      await call({ audioBase64: AUDIO, mimeType: sent });
      expect(state.transcribeArgs[0], sent).toMatchObject({ mimeType: expected });
    }
  });

  it("does not charge the limits for invalid audio", async () => {
    state.user = { id: "user-1" };
    await call({ audioBase64: "" });
    await call({ audioBase64: "A".repeat(2_000_001) });
    expect(state.limitCalls).toHaveLength(0);
  });

  it("asks for a Japanese transcript when the client answers in Japanese (math/kokugo voice answers)", async () => {
    state.user = { id: "user-1" };
    await call({ audioBase64: AUDIO, lang: "ja-JP" });
    expect(String((state.transcribeArgs[0] as { prompt: string }).prompt)).toContain("Japanese");
    expect(String((state.transcribeArgs[0] as { prompt: string }).prompt)).not.toContain("English words only");
    await call({ audioBase64: AUDIO, lang: "en-US" });
    expect(String((state.transcribeArgs[1] as { prompt: string }).prompt)).toContain("English words only");
  });

  it("answers with a generic message when transcription fails or throws", async () => {
    state.user = { id: "user-1" };
    state.transcribeThrows = true;
    const thrown = await call({ audioBase64: AUDIO });
    expect(thrown.status).toBe(500);
    expect(JSON.stringify(await thrown.json())).not.toContain("secret-detail");

    state.transcribeThrows = false;
    state.transcript = null;
    const empty = await call({ audioBase64: AUDIO });
    expect(await empty.json()).toEqual({ success: false, error: "Speech recognition unavailable" });
  });
});
