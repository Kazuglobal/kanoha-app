import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateGeminiSpeech } from "@/lib/ai/tts";

interface TtsRequestBody {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
}

describe("generateGeminiSpeech payload format", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_TTS_MODEL;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-api-key";
    process.env.GEMINI_TTS_MODEL = "test-tts-model";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_TTS_MODEL;
    else process.env.GEMINI_TTS_MODEL = originalModel;
    vi.restoreAllMocks();
  });

  it("sends systemInstruction at top level and keeps user text free of prompt instructions (ja)", async () => {
    const captured: { body: TtsRequestBody | null } = { body: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.body) {
          captured.body = JSON.parse(init.body as string) as TtsRequestBody;
        }
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "audio/wav",
                        data: Buffer.from("dummy audio").toString("base64"),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      })
    );

    const result = await generateGeminiSpeech({
      text: "やったね！大正解！",
      mood: "celebrate",
      lang: "ja",
    });

    expect(result.success).toBe(true);
    expect(captured.body).not.toBeNull();
    const capturedBody = captured.body as TtsRequestBody;

    // Verify systemInstruction is at top level
    expect(capturedBody.systemInstruction).toBeDefined();
    expect(capturedBody.systemInstruction.parts[0].text).toContain("愛されマスコット「かのは」");
    expect(capturedBody.systemInstruction.parts[0].text).toContain("最重要ルール");

    // Verify contents contains ONLY the target speech text, NOT the prompt
    expect(capturedBody.contents).toHaveLength(1);
    expect(capturedBody.contents[0].role).toBe("user");
    expect(capturedBody.contents[0].parts[0].text).toBe("やったね！大正解！");
    expect(capturedBody.contents[0].parts[0].text).not.toContain("愛されマスコット");
    expect(capturedBody.contents[0].parts[0].text).not.toContain("読み上げるセリフ");
  });

  it("sends systemInstruction at top level and keeps user text free of prompt instructions (en)", async () => {
    const captured: { body: TtsRequestBody | null } = { body: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        if (init?.body) {
          captured.body = JSON.parse(init.body as string) as TtsRequestBody;
        }
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "audio/wav",
                        data: Buffer.from("dummy audio").toString("base64"),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        };
      })
    );

    const result = await generateGeminiSpeech({
      text: "Hello! What is your name?",
      mood: "happy",
      lang: "en",
    });

    expect(result.success).toBe(true);
    expect(captured.body).not.toBeNull();
    const capturedBody = captured.body as TtsRequestBody;

    // Verify systemInstruction is at top level
    expect(capturedBody.systemInstruction).toBeDefined();
    expect(capturedBody.systemInstruction.parts[0].text).toContain("You are Kanoha");
    expect(capturedBody.systemInstruction.parts[0].text).toContain("CRITICAL");

    // Verify contents contains ONLY the target speech text
    expect(capturedBody.contents[0].parts[0].text).toBe("Hello! What is your name?");
    expect(capturedBody.contents[0].parts[0].text).not.toContain("You are Kanoha");
    expect(capturedBody.contents[0].parts[0].text).not.toContain("Line to read");
  });
});
