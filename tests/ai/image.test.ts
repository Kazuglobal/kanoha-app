import { describe, expect, it, vi } from "vitest";

import { generateVisualImage, ImageGenerationUnavailableError } from "@/lib/ai/image";

const env = { IMAGE_GENERATION_MODEL: "image-model-from-env", OPENAI_API_KEY: "image-key" };

describe("generateVisualImage", () => {
  it("throws ImageGenerationUnavailableError when the key or model is missing", async () => {
    await expect(generateVisualImage("prompt", { env: {} })).rejects.toBeInstanceOf(
      ImageGenerationUnavailableError,
    );
    await expect(
      generateVisualImage("prompt", { env: { OPENAI_API_KEY: "k" } }),
    ).rejects.toBeInstanceOf(ImageGenerationUnavailableError);
  });

  it("returns a data URL and never hardcodes the model name", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "abc123" }] }), { status: 200 }),
    );

    const url = await generateVisualImage("ずかいのプロンプト", { env, fetchImpl });

    expect(url).toBe("data:image/png;base64,abc123");
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe("https://api.openai.com/v1/images/generations");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer image-key");
    expect(JSON.parse(init.body as string).model).toBe("image-model-from-env");
  });

  it("throws on a non-OK response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(generateVisualImage("p", { env, fetchImpl })).rejects.toThrow("429");
  });

  it("throws when the response has no image data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await expect(generateVisualImage("p", { env, fetchImpl })).rejects.toThrow(
      "did not contain image data",
    );
  });
});
