import { z } from "zod";

export const uuid = z.string().uuid();
export const childIdSchema = z.object({ childId: uuid });
export const explanationLevel = z.enum(["very_easy", "easy", "standard"]);
export const difficulty = z.enum(["basic", "standard", "advanced"]);
export const sourceType = z.enum([
  "school_print",
  "tablet_screenshot",
  "textbook",
  "other",
]);
