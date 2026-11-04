import { describe, expect, it } from "vitest";

import {
  REPEAT_TARGET,
  answerTalk,
  currentTurnId,
  markHelp,
  nextTalk,
  repeatTalk,
  startTalk,
  talkOutcomes,
  talkScore,
  talkStarsOf,
} from "@/lib/englishTalk/flow";

const ids = ["a", "b"] as const;

describe("english talk flow", () => {
  it("moves through turns when every answer is correct", () => {
    let state = startTalk(ids);
    expect(currentTurnId(state)).toBe("a");
    state = nextTalk(answerTalk(state, true));
    expect(currentTurnId(state)).toBe("b");
    state = nextTalk(answerTalk(state, true));
    expect(state.phase).toBe("done");
    expect(talkScore(state)).toEqual({ firstTry: 2, total: 2 });
  });

  it("teaches the right answer and asks to repeat it before moving on", () => {
    let state = answerTalk(startTalk(ids), false);
    expect(state.phase).toBe("teach");
    for (let i = 1; i < REPEAT_TARGET; i += 1) {
      state = repeatTalk(state, true);
      expect(state.phase).toBe("teach");
      expect(state.repeatCount).toBe(i);
    }
    state = repeatTalk(state, false);
    expect(state.repeatCount).toBe(REPEAT_TARGET - 1);
    state = repeatTalk(state, true);
    expect(state.phase).toBe("correct");
  });

  it("asks a missed turn once more at the end", () => {
    let state = startTalk(ids);
    state = answerTalk(state, false);
    for (let i = 0; i < REPEAT_TARGET; i += 1) state = repeatTalk(state, true);
    state = nextTalk(state);
    expect(currentTurnId(state)).toBe("b");
    state = nextTalk(answerTalk(state, true));
    expect(currentTurnId(state)).toBe("a");
    expect(state.isRetry).toBe(true);
    state = nextTalk(answerTalk(state, false));
    // 2回目もまちがえたら教えるが、3回目は出さない
    expect(state.phase).toBe("teach");
    for (let i = 0; i < REPEAT_TARGET; i += 1) state = repeatTalk(state, true);
    state = nextTalk(state);
    expect(state.phase).toBe("done");
    expect(talkScore(state)).toEqual({ firstTry: 1, total: 2 });
  });

  it("ignores answers outside the matching phase", () => {
    const start = startTalk(ids);
    expect(repeatTalk(start, true)).toBe(start);
    expect(nextTalk(start)).toBe(start);
    const correct = answerTalk(start, true);
    expect(answerTalk(correct, false)).toBe(correct);
  });
});

describe("help and outcomes", () => {
  it("records help on the current turn once, only while asking", () => {
    const start = startTalk(ids);
    const helped = markHelp(start);
    expect(helped.helped).toEqual(["a"]);
    expect(markHelp(helped)).toBe(helped);
    const teach = answerTalk(start, false);
    expect(markHelp(teach)).toBe(teach);
    const done = startTalk([]);
    expect(markHelp(done)).toBe(done);
  });

  it("does not change the original state", () => {
    const start = startTalk(ids);
    markHelp(start);
    expect(start.helped).toEqual([]);
  });

  it("gives each turn clean / help / teach", () => {
    let state = startTalk(["a", "b", "c"]);
    state = nextTalk(answerTalk(state, true)); // a: clean
    state = markHelp(state);
    state = nextTalk(answerTalk(state, true)); // b: help
    state = answerTalk(state, false); // c: missed
    for (let i = 0; i < REPEAT_TARGET; i += 1) state = repeatTalk(state, true);
    state = nextTalk(state);
    state = nextTalk(answerTalk(state, true)); // c again (retry)
    expect(state.phase).toBe("done");
    expect(talkOutcomes(state)).toEqual([
      { turnId: "a", outcome: "clean" },
      { turnId: "b", outcome: "help" },
      { turnId: "c", outcome: "teach" },
    ]);
  });

  it("turns the outcomes into stars", () => {
    let state = startTalk(ids);
    state = nextTalk(answerTalk(state, true));
    state = markHelp(state);
    state = nextTalk(answerTalk(state, true));
    expect(talkStarsOf(state)).toBe(3);

    let missed = startTalk(ids);
    missed = answerTalk(missed, false);
    for (let i = 0; i < REPEAT_TARGET; i += 1) missed = repeatTalk(missed, true);
    missed = nextTalk(missed);
    missed = nextTalk(answerTalk(missed, true));
    missed = nextTalk(answerTalk(missed, true));
    expect(talkStarsOf(missed)).toBe(2);
  });
});
