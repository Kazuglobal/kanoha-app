import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GENERATED_DAILY_REWARD_CAP,
  DEFAULT_PRACTICE_MAX_SETS_PER_DAY,
  DEFAULT_TALK_DAILY_REWARD_CAP,
  generatedDailyRewardCap,
  practiceGenerationEnabled,
  practiceMaxSetsPerDay,
  talkDailyRewardCap,
} from "@/lib/utils/flags";

afterEach(() => vi.unstubAllEnvs());

describe("1日の上限(環境変数。呼び出すたびに読む)", () => {
  it("英会話は 5、新しい問題の5円は 10、あたらしい もんだいのセットは 3 が既定", () => {
    expect([DEFAULT_TALK_DAILY_REWARD_CAP, DEFAULT_GENERATED_DAILY_REWARD_CAP, DEFAULT_PRACTICE_MAX_SETS_PER_DAY]).toEqual([5, 10, 3]);
    expect(talkDailyRewardCap()).toBe(5);
    expect(generatedDailyRewardCap()).toBe(10);
    expect(practiceMaxSetsPerDay()).toBe(3);
  });

  it("環境変数で変えられる。0 も本当の値(5円を出さない・セットを作らない)", () => {
    vi.stubEnv("GENERATED_DAILY_REWARD_CAP", "4");
    vi.stubEnv("PRACTICE_MAX_SETS_PER_DAY", "0");
    expect(generatedDailyRewardCap()).toBe(4);
    expect(practiceMaxSetsPerDay()).toBe(0);
  });

  it("数でない・負の値や小数は、安全な値にする", () => {
    vi.stubEnv("GENERATED_DAILY_REWARD_CAP", "-1");
    vi.stubEnv("PRACTICE_MAX_SETS_PER_DAY", "2.9");
    expect(generatedDailyRewardCap()).toBe(10);
    expect(practiceMaxSetsPerDay()).toBe(2);
  });
});

describe("practiceGenerationEnabled(FEATURE_PRACTICE_GENERATION)", () => {
  it("未設定・空なら使える(テンプレートの生成は費用がかからない)", () => {
    expect(practiceGenerationEnabled()).toBe(true);
    vi.stubEnv("FEATURE_PRACTICE_GENERATION", "  ");
    expect(practiceGenerationEnabled()).toBe(true);
  });

  it.each(["0", "false", "FALSE", " off ", "no", "disabled"])("%j は止める", (value) => {
    vi.stubEnv("FEATURE_PRACTICE_GENERATION", value);
    expect(practiceGenerationEnabled()).toBe(false);
  });

  it.each(["1", "true", "on", "yes"])("%j は使う", (value) => {
    vi.stubEnv("FEATURE_PRACTICE_GENERATION", value);
    expect(practiceGenerationEnabled()).toBe(true);
  });
});
