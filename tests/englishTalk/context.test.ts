import { describe, expect, it } from "vitest";
import { TALK_SCENES } from "@/lib/curriculum/englishTalkScenes";
import { adaptTurn, detectChosenFruit, FRUIT_IDS } from "@/lib/englishTalk/context";

const shopHowMany = TALK_SCENES.find(({ id }) => id === "shop")!.turns.find(({ id }) => id === "shop-how-many")!;
const park = TALK_SCENES.find(({ id }) => id === "park")!.turns[0];

describe("adaptTurn", () => {
  it("おみせで りんご 以外を えらんだら、2ターン目の しつもんをその くだものに かえる", () => {
    const adapted = adaptTurn(shopHowMany, { fruit: "banana" });
    expect(adapted.prompt).toBe("How many bananas?");
    expect(adapted.promptJa).toBe("バナナは いくつ ほしいですか？");
    expect(adapted.visual).toBe("🍌🍌🍌");
  });

  it("りんごのとき・えらんでいないとき・ほかのターンは そのまま", () => {
    expect(adaptTurn(shopHowMany, { fruit: "apple" })).toBe(shopHowMany);
    expect(adaptTurn(shopHowMany, {})).toBe(shopHowMany);
    expect(adaptTurn(shopHowMany, undefined)).toBe(shopHowMany);
    expect(adaptTurn(park, { fruit: "banana" })).toBe(park);
  });

  it("元のターンを書きかえない", () => {
    const before = JSON.stringify(shopHowMany);
    adaptTurn(shopHowMany, { fruit: "grape" });
    expect(JSON.stringify(shopHowMany)).toBe(before);
  });
});

describe("detectChosenFruit", () => {
  it("英語・カタカナ・日本語の くだもの名を見つける", () => {
    expect(detectChosenFruit("Bananas, please.")?.plural).toBe("bananas");
    expect(detectChosenFruit("バナナ")?.emoji).toBe("🍌");
    expect(detectChosenFruit("いちご please")?.singular).toBe("strawberry");
    expect(detectChosenFruit("I'm fine.")).toBeNull();
  });

  it("見つけた くだものは FRUIT_IDS の中にある", () => {
    for (const text of ["apple", "banana", "orange", "melon", "grape", "strawberry", "peach"]) {
      expect(FRUIT_IDS).toContain(detectChosenFruit(text)?.singular);
    }
  });
});
