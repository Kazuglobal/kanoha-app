import { describe, expect, it } from "vitest";

import { pickPhrase, TALK_ENCOURAGE } from "@/lib/englishTalk/feedback";

describe("english talk feedback", () => {
  it("rotates encouragement so the same words do not repeat back to back", () => {
    const picked = [0, 1, 2, 3].map((count) => pickPhrase(TALK_ENCOURAGE, count));
    expect(picked[0]).not.toBe(picked[1]);
    expect(picked[3]).toBe(picked[0]);
  });

  it("never scolds and is voiced as an encouraging (think) phrase", () => {
    for (const phrase of TALK_ENCOURAGE) {
      expect(phrase).toMatch(/おしい|だいじょうぶ/);
      expect(phrase).not.toMatch(/ちがう|だめ|ざんねん/);
    }
  });
});
