import { describe, expect, it } from "vitest";
import { TALK_SCENES, getTalkTurn } from "@/lib/curriculum/englishTalkScenes";

const allTurns = TALK_SCENES.flatMap((scene) => scene.turns);

describe("englishTalkScenes data", () => {
  it("ターン ID はぜんぶ違い、場面の ID で始まる", () => {
    expect(new Set(allTurns.map(({ id }) => id)).size).toBe(allTurns.length);
    for (const scene of TALK_SCENES) {
      for (const turn of scene.turns) expect(turn.id.startsWith(`${scene.id}-`), turn.id).toBe(true);
    }
  });

  it("どのターンも 4 択で、選択肢はぜんぶ違い、先頭がお手本の答え", () => {
    for (const turn of allTurns) {
      expect(turn.choices, turn.id).toHaveLength(4);
      expect(new Set(turn.choices).size, turn.id).toBe(4);
      expect(turn.choices[0], turn.id).toBe(turn.modelAnswer);
    }
  });

  it("名前を聞くターンは、AI に子どもの答えを送らず、本名を言わない「なりきり」の言い方にする", () => {
    const name = getTalkTurn("greeting", "greeting-name");
    expect(name?.aiJudge).toBeFalsy();
    expect(name?.promptJa).toContain("なりきって");
    expect(name?.answerHintJa).toContain("ほんとうの なまえは いわない");
  });

  it("AI で判定してよいのは、答えが決まっていない問い(すきなもの・ほしいもの)だけ", () => {
    expect(allTurns.filter(({ aiJudge }) => aiJudge).map(({ id }) => id).sort()).toEqual(["shop-want", "zoo-like"]);
  });

  it("英語のセリフにカタカナの読みがなを付けない", () => {
    for (const turn of allTurns) {
      expect(turn.prompt, turn.id).not.toMatch(/[ァ-ヶ]/);
      expect(turn.modelAnswer, turn.id).not.toMatch(/[ァ-ヶ]/);
      for (const choice of turn.choices) expect(choice, turn.id).not.toMatch(/[ァ-ヶ]/);
    }
  });
});
