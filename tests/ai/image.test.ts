import { describe, expect, it, vi } from "vitest";

import { generateVisualImage, ImageGenerationUnavailableError } from "@/lib/ai/image";

const env = { IMAGE_GENERATION_MODEL: "image-model-from-env", OPENAI_API_KEY: "image-key" };
const geminiEnv = {
  GEMINI_API_KEY: "gemini-key-123",
  IMAGE_GENERATION_MODEL: "imagen-3.0-generate-002",
};
const flashLiteEnv = {
  GEMINI_API_KEY: "gemini-key-123",
  IMAGE_GENERATION_MODEL: "gemini-3.1-flash-lite-image",
};

describe("generateVisualImage", () => {
  it("throws ImageGenerationUnavailableError when the key or model is missing", async () => {
    await expect(generateVisualImage("prompt", { env: {} })).rejects.toBeInstanceOf(
      ImageGenerationUnavailableError,
    );
    await expect(
      generateVisualImage("prompt", { env: { OPENAI_API_KEY: "k" } }),
    ).rejects.toBeInstanceOf(ImageGenerationUnavailableError);
  });

  it("returns a data URL and never hardcodes the model name (OpenAI mode)", async () => {
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

  it("generates visual image with Gemini Imagen 3 when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          predictions: [{ bytesBase64Encoded: "geminiImgBase64" }],
        }),
        { status: 200 },
      ),
    );

    const url = await generateVisualImage("図解プロンプト", { env: geminiEnv, fetchImpl });

    expect(url).toBe("data:image/png;base64,geminiImgBase64");
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toContain("imagen-3.0-generate-002:predict");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("gemini-key-123");
    const body = JSON.parse(init.body as string);
    expect(body.instances[0].prompt).toBe("図解プロンプト");
  });

  it("generates visual image with NanoBanana2 Lite (gemini-3.1-flash-lite-image) via generateContent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: "flashLiteBase64Data",
                      mimeType: "image/png",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const url = await generateVisualImage("算数の図解プロンプト", { env: flashLiteEnv, fetchImpl });

    expect(url).toBe("data:image/png;base64,flashLiteBase64Data");
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toContain("gemini-3.1-flash-lite-image:generateContent");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("gemini-key-123");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe("算数の図解プロンプト");
    expect(body.generationConfig.responseModalities).toEqual(["image", "text"]);
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
