import { describe, expect, it, vi } from "vitest";

import { createGeminiClient } from "@/lib/ai/gemini";
import { hintsSchema } from "@/lib/ai/schemas";

describe("Gemini client", () => {
  it("uses the env-selected model and retries transient failures", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(
        JSON.stringify({
          answer: "4",
          hint1: "2をふたつあつめよう。",
          hint2: "2+2を考えよう。",
          praise: "よく考えたね。",
          solution: "2+2=4です。",
        }),
      );
    const client = createGeminiClient({
      env: {
        GEMINI_API_KEY: "test",
        GEMINI_TEXT_MODEL: "text-from-env",
      },
      retries: 1,
      run,
      timeoutMs: 100,
    });

    const result = await client.generateStructured("text", "prompt", hintsSchema);

    expect(result.answer).toBe("4");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0][0].model).toBe("text-from-env");
  });

  it("times out a slow request", async () => {
    const client = createGeminiClient({
      env: { GEMINI_API_KEY: "test", GEMINI_TEXT_MODEL: "text-from-env" },
      retries: 0,
      run: () => new Promise(() => undefined),
      timeoutMs: 5,
    });

    await expect(client.generateText("text", "prompt")).rejects.toThrow(
      "Gemini request timed out",
    );
  });

  it("requires the requested model environment variable", async () => {
    const client = createGeminiClient({
      env: { GEMINI_API_KEY: "test" },
      run: vi.fn(),
    });

    await expect(client.generateText("vision", "prompt")).rejects.toThrow(
      "GEMINI_VISION_MODEL",
    );
  });

  it("passes image parts through to the runner for vision requests", async () => {
    const run = vi.fn().mockResolvedValue("[]");
    const client = createGeminiClient({
      env: { GEMINI_API_KEY: "test", GEMINI_VISION_MODEL: "vision-from-env" },
      retries: 0,
      run,
      timeoutMs: 100,
    });

    await client.generateText(
      "vision",
      "prompt",
      undefined,
      [{ data: "base64data", mimeType: "image/png" }],
    );

    expect(run.mock.calls[0][0].images).toEqual([
      { data: "base64data", mimeType: "image/png" },
    ]);
  });
});
