import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  provider: null as unknown,
}));

vi.mock("@/lib/ai", () => ({
  getAiProvider: () => state.provider,
}));

const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// 1x1 PNG transparent pixel in base64 with valid magic bytes
const VALID_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("POST /api/ai/recognize-handwriting (Demo mode support)", () => {
  beforeEach(async () => {
    const { mockAiProvider } = await import("@/lib/ai/mock");
    state.provider = mockAiProvider;
  });

  it(
    "recognizes handwriting for demo kanji problem (kanji-1) and returns あおぞら",
    async () => {
      const { POST } = await import("@/app/api/ai/recognize-handwriting/route");
      const response = await POST(
        post("/api/ai/recognize-handwriting", {
          childId: "demo",
          problemId: "kanji-1",
          image: {
            data: VALID_PNG_BASE64,
            mimeType: "image/png",
          },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        success: true,
        data: { answer: "あおぞら" },
      });
    },
    15000,
  );

  it(
    "recognizes handwriting for demo math problem (volume-1) and returns 1000mL",
    async () => {
      const { POST } = await import("@/app/api/ai/recognize-handwriting/route");
      const response = await POST(
        post("/api/ai/recognize-handwriting", {
          childId: "demo",
          problemId: "volume-1",
          image: {
            data: VALID_PNG_BASE64,
            mimeType: "image/png",
          },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        success: true,
        data: { answer: "1000mL" },
      });
    },
    15000,
  );
});
