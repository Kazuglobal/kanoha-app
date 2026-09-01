import { z } from "zod";

export const childProfileInput = z.object({
  nickname: z.string().trim().min(1).max(40),
  grade: z.number().int().min(1).max(6),
  readingMode: z.enum(["kanji_with_ruby", "hiragana"]).default("kanji_with_ruby"),
});

export type ChildProfileInput = z.infer<typeof childProfileInput>;

