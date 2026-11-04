import { describe, expect, it } from "vitest";
import { buildTranscribePrompt } from "@/lib/ai/prompts";

describe("buildTranscribePrompt", () => {
  it("英語は出題の文脈(質問)だけを渡し、お手本の答えを渡さない(書き起こしがお手本に寄らないように)", () => {
    const prompt = buildTranscribePrompt({ prompt: "What color is the ball?" }, "en-US");
    expect(prompt).toContain('"What color is the ball?"');
    expect(prompt).not.toMatch(/example answer/i);
    expect(prompt).not.toMatch(/expected/i);
  });

  it("日本語で話したときは訳さず、聞こえたとおり書かせる(「いぬ」が dog にならないように)", () => {
    expect(buildTranscribePrompt({ prompt: "What's this?" }, "en-US")).toMatch(/never translate/i);
  });

  it("文脈がなくても組み立てられる", () => {
    expect(buildTranscribePrompt(undefined, "en-US")).toContain("Transcribe");
  });

  it("日本語の書き起こしは、出題の文脈を使わない", () => {
    const prompt = buildTranscribePrompt({ prompt: "ignored" }, "ja-JP");
    expect(prompt).toContain("Japanese");
    expect(prompt).not.toContain("ignored");
  });
});
