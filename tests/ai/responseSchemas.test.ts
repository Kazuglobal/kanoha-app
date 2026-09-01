import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  handwritingResponseSchema,
  hintsResponseSchema,
  parsedProblemResponseSchema,
  parsedProblemsResponseSchema,
  similarProblemResponseSchema,
  similarProblemsResponseSchema,
} from "@/lib/ai/responseSchemas";
import {
  difficultySchema,
  handwritingAnswerSchema,
  hintsSchema,
  parsedProblemSchema,
  similarProblemSchema,
} from "@/lib/ai/schemas";
import { GRADE_2_MATH_UNITS } from "@/lib/curriculum/grade2Math";
import { MISTAKE_TYPE_IDS } from "@/lib/curriculum/mistakeTypes";

type SchemaLike = {
  properties?: Record<string, Record<string, unknown>>;
  required?: string[];
  items?: unknown;
  minItems?: number;
  maxItems?: number;
};

const propertyKeys = (schema: unknown): string[] =>
  Object.keys((schema as SchemaLike).properties ?? {}).sort();

const requiredKeys = (schema: unknown): string[] =>
  [...((schema as SchemaLike).required ?? [])].sort();

/** superRefine 等でラップされていても Zod の shape に到達する。 */
const shapeOf = (schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> => {
  const candidate = schema as unknown as {
    shape?: Record<string, z.ZodTypeAny>;
    innerType?: () => z.ZodTypeAny;
  };
  if (candidate.shape) return candidate.shape;
  if (candidate.innerType) return shapeOf(candidate.innerType());
  throw new Error("schema has no object shape");
};

const zodKeys = (schema: z.ZodTypeAny): string[] => Object.keys(shapeOf(schema)).sort();

const zodRequiredKeys = (schema: z.ZodTypeAny): string[] =>
  Object.entries(shapeOf(schema))
    .filter(([, value]) => !value.isOptional())
    .map(([key]) => key)
    .sort();

describe("Gemini responseSchema definitions", () => {
  it.each([
    ["hints", hintsResponseSchema, hintsSchema],
    ["parsed problem", parsedProblemResponseSchema, parsedProblemSchema],
    ["similar problem", similarProblemResponseSchema, similarProblemSchema],
    ["handwriting", handwritingResponseSchema, handwritingAnswerSchema],
  ] as const)("%s: property keys equal the Zod shape keys", (_name, jsonSchema, zodSchema) => {
    expect(propertyKeys(jsonSchema)).toEqual(zodKeys(zodSchema));
  });

  it.each([
    ["hints", hintsResponseSchema, hintsSchema],
    ["parsed problem", parsedProblemResponseSchema, parsedProblemSchema],
    ["similar problem", similarProblemResponseSchema, similarProblemSchema],
    ["handwriting", handwritingResponseSchema, handwritingAnswerSchema],
  ] as const)("%s: required keys equal the non-optional Zod keys", (_name, jsonSchema, zodSchema) => {
    expect(requiredKeys(jsonSchema)).toEqual(zodRequiredKeys(zodSchema));
  });

  it("generates unit / mistakeType / difficulty enums from the curriculum constants", () => {
    const properties = (parsedProblemResponseSchema as SchemaLike).properties!;
    expect(properties.unit.enum).toEqual([...GRADE_2_MATH_UNITS]);
    expect(properties.mistakeType.enum).toEqual([...MISTAKE_TYPE_IDS]);
    expect(properties.difficulty.enum).toEqual([...difficultySchema.options]);
    const similarProperties = (similarProblemResponseSchema as SchemaLike).properties!;
    expect(similarProperties.unit.enum).toEqual([...GRADE_2_MATH_UNITS]);
    expect(similarProperties.difficulty.enum).toEqual([...difficultySchema.options]);
  });

  it("wraps the item schemas in arrays (similar problems are exactly five)", () => {
    expect((parsedProblemsResponseSchema as SchemaLike).items).toBe(parsedProblemResponseSchema);
    const similar = similarProblemsResponseSchema as SchemaLike;
    expect(similar.items).toBe(similarProblemResponseSchema);
    expect(similar.minItems).toBe(5);
    expect(similar.maxItems).toBe(5);
  });

  it("marks recommendedVisualTemplate as nullable but required", () => {
    const properties = (parsedProblemResponseSchema as SchemaLike).properties!;
    expect(properties.recommendedVisualTemplate.nullable).toBe(true);
    expect(requiredKeys(parsedProblemResponseSchema)).toContain("recommendedVisualTemplate");
  });
});
