import { z } from "zod";

export type GeminiModelKind = "structured" | "text" | "vision";
export type AiEnv = Record<string, string | undefined>;

export interface GeminiGenerationConfig {
  responseMimeType?: string;
  responseSchema?: object;
}

export interface GeminiImagePart {
  data: string;
  mimeType: string;
}

export interface GeminiRunInput {
  generationConfig?: GeminiGenerationConfig;
  images?: readonly GeminiImagePart[];
  model: string;
  prompt: string;
}

export type GeminiRunner = (input: GeminiRunInput) => Promise<string>;

export interface GeminiClientOptions {
  env?: AiEnv;
  retries?: number;
  run?: GeminiRunner;
  timeoutMs?: number;
}

const modelEnvKey: Record<GeminiModelKind, string> = {
  structured: "GEMINI_STRUCTURED_MODEL",
  text: "GEMINI_TEXT_MODEL",
  vision: "GEMINI_VISION_MODEL",
};

const timeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs);
    }),
  ]);

const createRestRunner = (apiKey: string): GeminiRunner => {
  return async ({ generationConfig, images, model, prompt }) => {
    // The API key travels only in the x-goog-api-key header, never in the URL (B9: keys leak via logs).
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent`;
    const imageParts = (images ?? []).map(({ data, mimeType }) => ({
      inlineData: { data, mimeType },
    }));
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        contents: [{ parts: [...imageParts, { text: prompt }], role: "user" }],
        generationConfig,
      }),
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      method: "POST",
    });
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini response did not contain text");
    return text;
  };
};

export const createGeminiClient = ({
  env = process.env,
  retries = 1,
  run,
  timeoutMs = 15_000,
}: GeminiClientOptions = {}) => {
  const runner =
    run ??
    createRestRunner(
      env.GEMINI_API_KEY ??
        env.GOOGLE_AI_API_KEY ??
        (() => {
          throw new Error("GEMINI_API_KEY is required");
        })(),
    );

  const generateText = async (
    kind: GeminiModelKind,
    prompt: string,
    generationConfig?: GeminiGenerationConfig,
    images?: readonly GeminiImagePart[],
  ): Promise<string> => {
    const key = modelEnvKey[kind];
    // structured falls back to the text model when GEMINI_STRUCTURED_MODEL is unset.
    const model = env[key] ?? (kind === "structured" ? env[modelEnvKey.text] : undefined);
    if (!model) throw new Error(`${key} is required`);

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await timeout(runner({ generationConfig, images, model, prompt }), timeoutMs);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

  const generateStructured = async <T>(
    kind: GeminiModelKind,
    prompt: string,
    schema: z.ZodType<T>,
    responseSchema?: object,
    images?: readonly GeminiImagePart[],
  ): Promise<T> => {
    const text = await generateText(
      kind,
      prompt,
      { responseMimeType: "application/json", responseSchema },
      images,
    );
    return schema.parse(JSON.parse(text));
  };

  return { generateStructured, generateText };
};
