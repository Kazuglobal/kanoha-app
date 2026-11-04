import { describe, expect, it } from "vitest";
import {
  BANK_LEVEL,
  clampLevel,
  difficultyFromLevel,
  foldLevel,
  levelFromDifficulty,
  summarizeSkill,
  type LevelEvent,
} from "@/lib/learning/level";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 3, 0, 0);

/** 古い順に at を振った出来事を作る。 */
const events = (...specs: ReadonlyArray<readonly [level: number, ok: boolean, usedAnswerHint?: boolean]>): LevelEvent[] =>
  specs.map(([level, correct, usedAnswerHint = false], index) => ({
    level,
    correct,
    usedAnswerHint,
    at: NOW - (specs.length - index) * 1000,
  }));

describe("foldLevel: 出来事からレベルを決める", () => {
  it("出来事がなければ開始レベル 2", () => {
    expect(foldLevel([])).toEqual({ level: 2, up: 0, down: 0 });
  });

  it("いまのレベル以上で 3 回続けて正解すると 1 つ上がり、数えなおす", () => {
    expect(foldLevel(events([2, true], [2, true], [2, true]))).toEqual({ level: 3, up: 0, down: 0 });
    expect(foldLevel(events([2, true], [2, true]))).toEqual({ level: 2, up: 2, down: 0 });
  });

  it("背のびした問題(いまのレベルより上)の正解も、上がるほうに数える", () => {
    expect(foldLevel(events([2, true], [3, true], [3, true])).level).toBe(3);
  });

  it("かんたんな問題(いまのレベルより下)の正解は、上がるほうに数えない", () => {
    expect(foldLevel(events([1, true], [1, true], [1, true])).level).toBe(2);
  });

  it("かんたんな問題の正解は、まちがいの連続を止める", () => {
    expect(foldLevel(events([2, false], [1, true], [2, false]))).toEqual({ level: 2, up: 0, down: 1 });
  });

  it("いまのレベル以下で 2 回続けてまちがえると 1 つ下がる", () => {
    expect(foldLevel(events([2, false], [2, false]))).toEqual({ level: 1, up: 0, down: 0 });
    // 3 に上がったあとで 2 回まちがえたら、2 にもどる
    expect(foldLevel(events([3, true], [3, true], [3, true], [3, false], [3, false])).level).toBe(2);
  });

  it("下のレベルの問題をまちがえても、いまのレベルのまちがいとして数える", () => {
    expect(foldLevel(events([1, false], [1, false])).level).toBe(1);
    expect(foldLevel(events([2, true], [2, true], [2, true], [2, false], [1, false])).level).toBe(2);
  });

  it("背のびした問題のまちがいでは下げない。続けて正解した数だけ戻す", () => {
    const result = foldLevel(events([2, true], [2, true], [4, false]));
    expect(result).toEqual({ level: 2, up: 0, down: 0 });
  });

  it("まちがいは、続けて正解した数を 0 に戻す", () => {
    expect(foldLevel(events([2, true], [2, true], [2, false], [2, true])).up).toBe(1);
  });

  it("答えのヒントを見てからの正解は、まちがいとして数える", () => {
    expect(foldLevel(events([2, true, true], [2, true, true]))).toEqual({ level: 1, up: 0, down: 0 });
    expect(foldLevel(events([2, true], [2, true], [2, true, true])).level).toBe(2);
  });

  it("レベルは 1〜5 の外に出ない", () => {
    const climb = Array.from({ length: 30 }, () => [5, true] as const);
    expect(foldLevel(events(...climb)).level).toBe(5);
    const fall = Array.from({ length: 30 }, () => [1, false] as const);
    expect(foldLevel(events(...fall)).level).toBe(1);
    expect(foldLevel(events(...fall), 2).down).toBeLessThanOrEqual(1);
  });

  it("レベルが変わったあとは、新しいレベルで数えなおす", () => {
    // 2 → 3 に上がったあと、レベル 2 の問題の正解は上がるほうに数えない
    expect(foldLevel(events([2, true], [2, true], [2, true], [2, true], [2, true], [2, true])).level).toBe(3);
    // 3 に上がったあと、3 の正解 3 回でさらに 4
    expect(foldLevel(events([2, true], [2, true], [2, true], [3, true], [3, true], [3, true])).level).toBe(4);
  });

  it("入力の並びが前後していても、時刻の古い順に畳み込む", () => {
    const ordered = events([2, true], [2, true], [2, true]);
    expect(foldLevel([...ordered].reverse())).toEqual(foldLevel(ordered));
  });

  it("入力の配列を書きかえない", () => {
    const input = events([2, false], [2, true]);
    const copy = JSON.parse(JSON.stringify(input));
    foldLevel(input);
    expect(input).toEqual(copy);
  });

  it("開始レベルを指定できる", () => {
    expect(foldLevel([], 4)).toEqual({ level: 4, up: 0, down: 0 });
  });
});

describe("summarizeSkill: 小単元のようすをまとめる", () => {
  const ctx = { now: NOW };

  it("履歴がなければ new", () => {
    expect(summarizeSkill([], ctx)).toMatchObject({ status: "new", attempts: 0, accuracy: 0, lastAt: null, level: 2 });
  });

  it("まちがいが続いている(down > 0)と review", () => {
    expect(summarizeSkill(events([2, true], [2, false]), ctx).status).toBe("review");
  });

  it("直近の正答率が低い(4 回以上で 6 割未満)と、続けてまちがえていなくても review", () => {
    // 背のびの問題(レベル 3)のまちがいは「続けてまちがえた」に数えないが、正答率は下がる
    const history = events([3, false], [3, false], [3, false], [3, true]);
    expect(summarizeSkill(history, ctx)).toMatchObject({ status: "review", down: 0, accuracy: 0.25 });
  });

  it("解いた回数が 4 回に満たないうちは、苦手とは決めない。6 割ちょうどは苦手にしない", () => {
    expect(summarizeSkill(events([3, false], [3, false], [3, false]), ctx).status).toBe("steady");
    const sixOfTen = events(...Array.from({ length: 10 }, (_, index) => [3, index < 6] as const));
    expect(summarizeSkill(sixOfTen, ctx).accuracy).toBe(0.6);
    expect(summarizeSkill(sixOfTen, ctx).status).not.toBe("review");
  });

  it("おさらいで続けて正解すれば、苦手から抜けて、またレベルを上げられる(おさらいに閉じこめない)", () => {
    // 2 回続けてまちがえてレベル 1 に下がり、そこから正解を重ねる
    const history = events([2, false], [2, false], [1, true], [1, true], [1, true], [1, true]);
    expect(summarizeSkill(history, ctx)).toMatchObject({ level: 2, status: "steady" });
    const more = [...history, ...events([2, true], [2, true], [2, true]).map((event, index) => ({ ...event, at: NOW + index }))];
    expect(summarizeSkill(more, ctx).level).toBe(3);
  });

  it("続けて 2 回できていれば ready", () => {
    expect(summarizeSkill(events([2, true], [2, true]), ctx).status).toBe("ready");
  });

  it("まちがえたあとに 1 回できたら、まちがいの連続は止まり steady", () => {
    expect(summarizeSkill(events([2, false], [2, true]), ctx).status).toBe("steady");
    expect(summarizeSkill(events([3, true], [1, true]), ctx).status).toBe("steady");
  });

  it("最後に解いてから 21 日以上あいたら review(20 日なら steady)", () => {
    const old = (days: number): LevelEvent[] => [{ level: 2, correct: true, usedAnswerHint: false, at: NOW - days * DAY }];
    expect(summarizeSkill(old(20), ctx).status).toBe("steady");
    expect(summarizeSkill(old(21), ctx).status).toBe("review");
  });

  it("あいだがあいたら、ready よりも review を優先する(久しぶりに背のびさせない)", () => {
    const stale = [
      { level: 2, correct: true, usedAnswerHint: false, at: NOW - 30 * DAY },
      { level: 2, correct: true, usedAnswerHint: false, at: NOW - 30 * DAY + 1000 },
    ];
    expect(summarizeSkill(stale, ctx).status).toBe("review");
  });

  it("最後の 10 回の正答率と、最後に解いた時刻を返す", () => {
    const history = events(...Array.from({ length: 12 }, (_, index) => [2, index >= 4] as const));
    const summary = summarizeSkill(history, ctx);
    expect(summary.attempts).toBe(12);
    expect(summary.accuracy).toBe(0.8);
    expect(summary.lastAt).toBe(history[history.length - 1].at);
  });

  it("答えのヒントを使った正解は、正答率に数えない", () => {
    expect(summarizeSkill(events([2, true, true], [2, true]), ctx).accuracy).toBe(0.5);
  });

  it("いちばん高いレベルでは、ready にしない(背のび先がない)", () => {
    // 2 → 3 → 4 → 5 に 9 回で上がり、あと 2 回続けて正解(up = 2)
    const top = events(...Array.from({ length: 11 }, () => [5, true] as const));
    expect(summarizeSkill(top, ctx)).toMatchObject({ level: 5, up: 2, status: "steady" });
  });
});

describe("同じ時刻・おかしな値", () => {
  it("同じ時刻の出来事は、入力の並びに関係なく同じ結果になる", () => {
    const base = [
      { level: 2, correct: false, usedAnswerHint: false, at: NOW },
      { level: 2, correct: true, usedAnswerHint: false, at: NOW },
      { level: 2, correct: false, usedAnswerHint: false, at: NOW },
    ];
    const expected = foldLevel(base);
    for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      expect(foldLevel(order.map((index) => base[index]))).toEqual(expected);
    }
  });

  it("clampLevel: 1〜5 に丸め、数でない値は開始レベル", () => {
    expect(clampLevel(Number.NaN)).toBe(2);
    expect(clampLevel(Number.POSITIVE_INFINITY)).toBe(2);
    expect(clampLevel(7)).toBe(5);
    expect(clampLevel(-3)).toBe(1);
    expect(clampLevel(2.6)).toBe(3);
  });

  it("summarizeSkill の level / up / down は foldLevel と同じ", () => {
    const history = events([2, true], [2, false], [3, true], [1, true], [2, false], [2, true, true], [4, true], [2, true]);
    const { level, up, down } = summarizeSkill(history, { now: NOW });
    expect({ level, up, down }).toEqual(foldLevel(history));
  });

  it("レベルがおかしい出来事(0 や 9)が混ざっても、レベルは 1〜5 の中", () => {
    const weird = events([0, false], [0, false], [9, true], [9, true], [9, true], [9, true], [9, true], [9, true]);
    const { level } = foldLevel(weird);
    expect(level >= 1 && level <= 5).toBe(true);
  });
});

describe("レベルの換算", () => {
  it("問題バンクの問題は 2、AI/アップロードの難易度は basic=1 standard=2 advanced=4", () => {
    expect(BANK_LEVEL).toBe(2);
    expect(levelFromDifficulty("basic")).toBe(1);
    expect(levelFromDifficulty("standard")).toBe(2);
    expect(levelFromDifficulty("advanced")).toBe(4);
  });
});

describe("difficultyFromLevel: 生成した問題の難易度の目印", () => {
  it("1 は basic、2〜3 は standard、4〜5 は advanced", () => {
    expect([1, 2, 3, 4, 5].map((level) => difficultyFromLevel(level))).toEqual(["basic", "standard", "standard", "advanced", "advanced"]);
  });

  it("範囲の外や数でない値は、丸めたレベルで決める", () => {
    expect(difficultyFromLevel(0)).toBe("basic");
    expect(difficultyFromLevel(9)).toBe("advanced");
    expect(difficultyFromLevel(Number.NaN)).toBe("standard");
  });
});
