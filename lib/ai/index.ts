import { z } from "zod";

import { GRADE_2_ALL_UNITS } from "@/lib/curriculum/subjects";

import { createGeminiClient } from "./gemini";
import { mockAiProvider } from "./mock";
import {
  buildAnalyzeProblemsPrompt,
  buildHandwritingPrompt,
  buildSimilarProblemsPrompt,
} from "./prompts";
import type { AiProvider } from "./provider";
import {
  handwritingResponseSchema,
  hintsResponseSchema,
  parsedProblemsResponseSchema,
  similarProblemsResponseSchema,
} from "./responseSchemas";
import {
  handwritingAnswerSchema,
  hintsSchema,
  similarProblemDraftsSchema,
} from "./schemas";

/**
 * 構造化呼び出しは必ず responseSchema(lib/ai/responseSchemas.ts)を渡す(B8)。
 * analyzeProblems は配列の形だけ確認して生データを返し、1件ずつの Zod 検証は
 * Route Handler 側で行う(B11: 1問の不良で全問を捨てない)。
 */
const createGeminiProvider = (env: Record<string, string | undefined>): AiProvider => {
  const client = createGeminiClient({ env });
  return {
    name: "gemini",
    analyzeProblems: (images) =>
      client.generateStructured(
        "vision",
        buildAnalyzeProblemsPrompt(GRADE_2_ALL_UNITS),
        z.array(z.unknown()),
        parsedProblemsResponseSchema,
        images,
      ),
    recognizeHandwriting: (images, problemText) =>
      client.generateStructured(
        "vision",
        buildHandwritingPrompt(problemText),
        handwritingAnswerSchema,
        handwritingResponseSchema,
        images,
      ),
    generateSimilarProblems: (input) =>
      client.generateStructured(
        "structured",
        buildSimilarProblemsPrompt(input),
        similarProblemDraftsSchema,
        similarProblemsResponseSchema,
      ),
    generateHints: (prompt) =>
      client.generateStructured("structured", prompt, hintsSchema, hintsResponseSchema),
  };
};

const resolveProviderName = (env: Record<string, string | undefined>): string => {
  if (env.AI_PROVIDER_TEXT) return env.AI_PROVIDER_TEXT;
  if (env.NODE_ENV === "production") {
    throw new Error("AI_PROVIDER_TEXT is required in production");
  }
  return "mock";
};

export const getAiProvider = (
  env: Record<string, string | undefined> = process.env,
): AiProvider => {
  const provider = resolveProviderName(env);
  if (provider === "mock") return mockAiProvider;
  if (provider === "gemini") return createGeminiProvider(env);
  throw new Error(`Unsupported AI provider: ${provider}`);
};

export type { AiProvider } from "./provider";
export * from "./schemas";
