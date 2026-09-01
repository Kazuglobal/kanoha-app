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
});
