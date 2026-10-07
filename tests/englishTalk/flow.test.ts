import { describe, expect, it } from "vitest";

import {
  MAX_TURN_MISSES,
  REPEAT_TARGET,
  answerTalk,
  currentTurnId,
  nextTalk,
  repeatTalk,
  startTalk,
  talkScore,
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

  it("teaches the right answer, has the child repeat it, then asks the same question again", () => {
    let state = answerTalk(startTalk(ids), false);
    expect(state.phase).toBe("teach");
    expect(state.turnMisses).toBe(1);
    for (let i = 1; i < REPEAT_TARGET; i += 1) {
      state = repeatTalk(state, true);
      expect(state.phase).toBe("teach");
      expect(state.repeatCount).toBe(i);
    }
    state = repeatTalk(state, false);
    expect(state.repeatCount).toBe(REPEAT_TARGET - 1);
    state = repeatTalk(state, true);
    // まねできたら、おなじ質問をすぐにもう1回きく
    expect(state.phase).toBe("ask");
    expect(currentTurnId(state)).toBe("a");
    expect(state.isRetry).toBe(true);
    state = answerTalk(state, true);
    expect(state.phase).toBe("correct");
    expect(talkScore(state).firstTry).toBe(0);
  });

  it("moves on after missing the same question MAX_TURN_MISSES times", () => {
    let state = startTalk(ids);
    for (let miss = 1; miss <= MAX_TURN_MISSES; miss += 1) {
      state = answerTalk(state, false);
      for (let i = 0; i < REPEAT_TARGET; i += 1) state = repeatTalk(state, true);
    }
    expect(state.phase).toBe("correct");
    state = nextTalk(state);
    expect(currentTurnId(state)).toBe("b");
    expect(state.turnMisses).toBe(0);
  });

  it("asks a missed turn once more at the end", () => {
    let state = startTalk(ids);
    state = answerTalk(state, false);
    for (let i = 0; i < REPEAT_TARGET; i += 1) state = repeatTalk(state, true);
    state = nextTalk(answerTalk(state, true));
    expect(currentTurnId(state)).toBe("b");
    state = nextTalk(answerTalk(state, true));
    expect(currentTurnId(state)).toBe("a");
    expect(state.isRetry).toBe(true);
    state = nextTalk(answerTalk(state, true));
    // 最後の聞きなおしは1回だけ
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
