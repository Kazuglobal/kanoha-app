import { describe, expect, it } from "vitest";
import { HAIR_COLOR_FILTERS } from "@/components/child/CharacterAccessories";
import { SHOES_COLOR_FILTERS } from "@/components/child/kanohaCharacterSprites";
import { ACCESSORY_CATALOG, DEFAULT_EQUIPPED, GROWTH_LEVELS, getCharacterLevel, isAccessoryUnlocked } from "@/lib/rewards/catalog";

const KANJI = /\p{Script=Han}/u;

describe("カタログの決まり(レベル 1〜10)", () => {
  it("アイテムの id は重ならず、名前・説明・絵文字がある", () => {
    const ids = ACCESSORY_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ACCESSORY_CATALOG) {
      expect(item.name.length, item.id).toBeGreaterThan(0);
      expect(item.description.length, item.id).toBeGreaterThan(0);
      expect(item.icon.length, item.id).toBeGreaterThan(0);
    }
  });

  it("かいほうレベルは 1〜10 の整数。レベル 2〜10 は それぞれ 1 つ以上の あたらしい アイテムが かいほうされる", () => {
    for (const item of ACCESSORY_CATALOG) {
      expect(Number.isInteger(item.unlockLevel) && item.unlockLevel >= 1 && item.unlockLevel <= 10, item.id).toBe(true);
    }
    for (let level = 2; level <= 10; level += 1) {
      expect(ACCESSORY_CATALOG.some((item) => item.unlockLevel === level), `Lv${level}`).toBe(true);
    }
  });

  it("いまの装備(既定)は 正解数 0 でも使える", () => {
    for (const itemId of Object.values(DEFAULT_EQUIPPED)) {
      const item = ACCESSORY_CATALOG.find((entry) => entry.id === itemId)!;
      expect(isAccessoryUnlocked(item, 0), itemId).toBe(true);
    }
  });

  it("成長レベルは 10 まで。しきい値は つながっていて、最後は上限なし", () => {
    expect(GROWTH_LEVELS).toHaveLength(10);
    GROWTH_LEVELS.forEach((info, index) => {
      expect(info.level).toBe(index + 1);
      if (index > 0) expect(info.minCorrect).toBe(GROWTH_LEVELS[index - 1].maxCorrect);
      expect(info.stageName.length).toBeGreaterThan(0);
    });
    expect(GROWTH_LEVELS[0].minCorrect).toBe(0);
    expect(GROWTH_LEVELS[9].maxCorrect).toBe(Infinity);
  });

  it("正解数とレベル: これまでの 5 段階は そのまま、80 問で 6、300 問で 10", () => {
    expect([0, 4, 5, 14, 15, 29, 30, 49, 50].map((n) => getCharacterLevel(n).level)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect([79, 80, 119, 120, 169, 170, 229, 230, 299, 300, 5000].map((n) => getCharacterLevel(n).level)).toEqual([5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
  });

  it("髪色・くつの色は ぜんぶ 色のフィルターがある(カタログにあって 色が変わらない、ということがない)", () => {
    for (const item of ACCESSORY_CATALOG.filter((entry) => entry.category === "hair_color")) expect(HAIR_COLOR_FILTERS[item.id], item.id).toBeDefined();
    for (const item of ACCESSORY_CATALOG.filter((entry) => entry.category === "shoes_color")) expect(SHOES_COLOR_FILTERS[item.id], item.id).toBeDefined();
  });

  it("ぜんぶのアイテムと成長レベルの名前・説明は ひらがな・カタカナだけ(着せかえ画面に ルビなしで出る)", () => {
    expect(ACCESSORY_CATALOG.length).toBeGreaterThanOrEqual(80);
    for (const item of ACCESSORY_CATALOG) {
      expect(KANJI.test(item.name), `${item.id} name`).toBe(false);
      expect(KANJI.test(item.description), `${item.id} description`).toBe(false);
    }
    for (const info of GROWTH_LEVELS) {
      for (const text of [info.stageName, info.title, info.rewardDescription]) expect(KANJI.test(text), `Lv${info.level} ${text}`).toBe(false);
    }
  });

  it("レベルアップの おしらせ(rewardDescription)に、そのレベルで かいほうされる あたらしい枠のアイテムが 名前で出てくる(Lv.2〜5)", () => {
    for (const info of GROWTH_LEVELS.slice(1, 5)) {
      const fresh = ACCESSORY_CATALOG.filter((item) => item.unlockLevel === info.level && ["effect", "pet", "motion"].includes(item.category));
      expect(fresh.length, `Lv${info.level}`).toBeGreaterThan(0);
      expect(
        fresh.some((item) => info.rewardDescription.includes(item.name)),
        `Lv${info.level}: ${info.rewardDescription}`,
      ).toBe(true);
    }
  });

  it("エフェクト・ペット・うごきは それぞれ 5 つ以上あり、高いレベルまで広がっている", () => {
    for (const slot of ["effect", "pet", "motion"] as const) {
      const items = ACCESSORY_CATALOG.filter((item) => item.category === slot);
      expect(items.length, slot).toBeGreaterThanOrEqual(5);
      expect(Math.max(...items.map((item) => item.unlockLevel)), slot).toBeGreaterThanOrEqual(8);
    }
  });
});
