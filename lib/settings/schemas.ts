import { z } from "zod";

export const appSettingsInput = z.object({
  explanationLevel: z.enum(["very_easy", "easy", "standard"]),
  dailyLimitMinutes: z.number().int().min(1).max(60),
  enableAudio: z.boolean(),
  enableVoiceAnswer: z.boolean(),
});

export type AppSettingsInput = z.infer<typeof appSettingsInput>;
