import type { AiEnv } from "./gemini";

/** OPENAI_API_KEY / IMAGE_GENERATION_MODEL 未設定。Route は 503 で親切に案内する。 */
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

interface ImageGenerationPayload {
  data?: Array<{ b64_json?: string }>;
}

/**
 * GPT Image 系で図解を1枚生成し、データURLで返す(doc.md §19)。
 * 生成画像は保存しない: 呼び出し元もこの戻り値を DB / Storage に書かないこと。
 */
export async function generateVisualImage(
  prompt: string,
  { env = process.env, fetchImpl = fetch }: GenerateVisualImageOptions = {},
): Promise<string> {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.IMAGE_GENERATION_MODEL;
  if (!apiKey || !model) throw new ImageGenerationUnavailableError();

  const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
    body: JSON.stringify({ model, n: 1, prompt, size: "1024x1024" }),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
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
