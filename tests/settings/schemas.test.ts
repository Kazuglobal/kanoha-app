import { describe, expect, it } from "vitest";
import { appSettingsInput } from "@/lib/settings/schemas";

describe("appSettingsInput", () => {
  it("accepts supported learning preferences", () => {
    expect(appSettingsInput.safeParse({
      explanationLevel: "very_easy",
      dailyLimitMinutes: 20,
      enableAudio: false,
      enableVoiceAnswer: true,
    }).success).toBe(true);
  });

  it("rejects unsupported daily limits", () => {
    expect(appSettingsInput.safeParse({
      explanationLevel: "easy",
      dailyLimitMinutes: 0,
      enableAudio: true,
      enableVoiceAnswer: true,
    }).success).toBe(false);
  });

  it("caps the daily limit at 60 minutes", () => {
    const base = { explanationLevel: "easy", enableAudio: true, enableVoiceAnswer: true };
    expect(appSettingsInput.safeParse({ ...base, dailyLimitMinutes: 60 }).success).toBe(true);
    expect(appSettingsInput.safeParse({ ...base, dailyLimitMinutes: 61 }).success).toBe(false);
  });
});
