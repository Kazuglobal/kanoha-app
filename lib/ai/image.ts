import type { AiEnv } from "./gemini";

/** API Key / IMAGE_GENERATION_MODEL 未設定。Route は 503 で親切に案内する。 */
export class ImageGenerationUnavailableError extends Error {
  constructor() {
    super("Image generation is not configured");
    this.name = "ImageGenerationUnavailableError";
  }
}

export interface GenerateVisualImageOptions {
  env?: AiEnv;
  fetchImpl?: typeof fetch;
}

interface InlineDataPart {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  text?: string;
}

interface ImageGenerationPayload {
  data?: Array<{ b64_json?: string }>;
  predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  candidates?: Array<{
    content?: {
      parts?: InlineDataPart[];
    };
  }>;
}

/**
 * Gemini (NanoBanana / gemini-3.1-flash-lite-image / Imagen 3) または OpenAI で図解を1枚生成し、データURLで返す(doc.md §19)。
 * 生成画像は保存しない: 呼び出し元もこの戻り値を DB / Storage に書かないこと。
 */
export async function generateVisualImage(
  prompt: string,
  { env = process.env, fetchImpl = fetch }: GenerateVisualImageOptions = {},
): Promise<string> {
  const model = env.IMAGE_GENERATION_MODEL;
  const geminiKey = env.GEMINI_API_KEY ?? env.GOOGLE_AI_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  if (!model || (!geminiKey && !openaiKey)) {
    throw new ImageGenerationUnavailableError();
  }

  const normalized = model.toLowerCase();

  // 1. Google Gemini / NanoBanana / Imagen
  if (
    geminiKey &&
    (!openaiKey ||
      normalized.includes("gemini") ||
      normalized.includes("imagen") ||
      normalized.includes("banana") ||
      normalized.includes("flash"))
  ) {
    // A) Gemini Native multimodal image models (e.g., gemini-3.1-flash-lite-image / NanoBanana)
    if (normalized.includes("gemini") || normalized.includes("flash") || normalized.includes("banana")) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["image", "text"],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini generateContent failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ImageGenerationPayload;
      const parts = payload.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((part) => part.inlineData?.data);
      const b64 =
        imagePart?.inlineData?.data ??
        payload.predictions?.[0]?.bytesBase64Encoded ??
        payload.data?.[0]?.b64_json;
      const mime = imagePart?.inlineData?.mimeType ?? "image/png";

      if (!b64) throw new Error("Gemini image response did not contain image data");
      return `data:${mime};base64,${b64}`;
    }

    // B) Google Imagen 3 (e.g. imagen-3.0-generate-002)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          outputOptions: { mimeType: "image/png" },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Imagen predict failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ImageGenerationPayload;
    const b64 =
      payload.predictions?.[0]?.bytesBase64Encoded ??
      payload.data?.[0]?.b64_json;

    if (!b64) throw new Error("Imagen response did not contain image data");
    return `data:image/png;base64,${b64}`;
  }

  // 2. OpenAI が設定されている場合 (後方互換用)
  if (openaiKey) {
    const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
      body: JSON.stringify({ model, n: 1, prompt, size: "1024x1024" }),
      headers: { authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Image generation failed with status ${response.status}`);
    }
    const payload = (await response.json()) as ImageGenerationPayload;
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image generation response did not contain image data");
    return `data:image/png;base64,${b64}`;
  }

  throw new ImageGenerationUnavailableError();
}
