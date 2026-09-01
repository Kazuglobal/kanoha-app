import { z } from "zod";

import { GRADE_2_MATH_UNITS } from "@/lib/curriculum/grade2Math";

import { createGeminiClient } from "./gemini";
import { mockAiProvider } from "./mock";
import {
  buildAnalyzeProblemsPrompt,
  buildHandwritingPrompt,
  buildSimilarProblemsPrompt,
} from "./prompts";
import type { AiProvider } from "./provider";
import {
  handwritingAnswerSchema,
  parsedProblemSchema,
  similarProblemDraftsSchema,
} from "./schemas";

const createGeminiProvider = (env: Record<string, string | undefined>): AiProvider => {
  const client = createGeminiClient({ env });
  return {
    name: "gemini",
    analyzeProblems: (images) =>
      client.generateStructured(
        "vision",
        buildAnalyzeProblemsPrompt(GRADE_2_MATH_UNITS),
        z.array(parsedProblemSchema),
        undefined,
        images,
      ),
    recognizeHandwriting: (images, problemText) =>
      client.generateStructured(
        "vision",
        buildHandwritingPrompt(problemText),
        handwritingAnswerSchema,
        undefined,
        images,
      ),
    generateSimilarProblems: (input) =>
      client.generateStructured(
        "text",
        buildSimilarProblemsPrompt(input),
        similarProblemDraftsSchema,
      ),
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
