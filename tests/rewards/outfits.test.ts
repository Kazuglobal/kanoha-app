import { describe, expect, it } from "vitest";
import { ACCESSORY_CATALOG, DEFAULT_EQUIPPED, GROWTH_LEVELS } from "@/lib/rewards/catalog";
import {
  OUTFIT_PRESETS,
  applyOutfit,
  isOutfitUnlocked,
  isOutfitWorn,
  outfitIcons,
  outfitRemainingCorrect,
  outfitRequiredLevel,
} from "@/lib/rewards/outfits";
import { normalizeEquipped } from "@/lib/rewards/rewardLogic";
import { remainingCorrectForItem, remainingCorrectForLevel } from "@/lib/rewards/unlocks";

const KANJI = /\p{Script=Han}/u;

describe("コーデ(テーマ別の着せかえセット)", () => {
  it("12 セットあり、id は重ならず、名前と絵文字がある(名前は ひらがな・カタカナだけ)", () => {
    expect(OUTFIT_PRESETS).toHaveLength(12);
    expect(new Set(OUTFIT_PRESETS.map((preset) => preset.id)).size).toBe(12);
    for (const preset of OUTFIT_PRESETS) {
      expect(preset.name.length, preset.id).toBeGreaterThan(0);
      expect(preset.icon.length, preset.id).toBeGreaterThan(0);
      expect(KANJI.test(preset.name), preset.id).toBe(false);
    }
  });

  it("セットの中身は ぜんぶ カタログにあり、その枠のアイテム。キャラクター(character)は変えない", () => {
    for (const preset of OUTFIT_PRESETS) {
      const entries = Object.entries(preset.equipped);
      expect(entries.length, preset.id).toBeGreaterThanOrEqual(3);
      for (const [slot, itemId] of entries) {
        expect(slot, preset.id).not.toBe("character");
        expect(ACCESSORY_CATALOG.find((item) => item.id === itemId)?.category, `${preset.id}:${slot}`).toBe(slot);
      }
    }
  });

  it("必要なレベルは セットの中でいちばん高いアイテムのレベル。最初から着られるセットがあり、高いレベルまで広がる", () => {
    const levels = OUTFIT_PRESETS.map(outfitRequiredLevel);
    for (const preset of OUTFIT_PRESETS) {
      const expected = Math.max(...Object.values(preset.equipped).map((id) => ACCESSORY_CATALOG.find((item) => item.id === id)!.unlockLevel));
      expect(outfitRequiredLevel(preset), preset.id).toBe(expected);
    }
    expect(levels.filter((level) => level <= 2).length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(8);
  });

  it("着せる: いまの装備に重ねる(キャラクター・髪型などセットに無い枠は そのまま)。元の装備は変えない", () => {
    const base = { ...DEFAULT_EQUIPPED, character: "char_ren", hairstyle: "hair_bob" };
    const frozen = JSON.stringify(base);
    const preset = OUTFIT_PRESETS[0];
    const result = applyOutfit(base, preset);
    expect(JSON.stringify(base)).toBe(frozen);
    expect(result.character).toBe("char_ren");
    for (const [slot, itemId] of Object.entries(preset.equipped)) expect(result[slot as keyof typeof result], slot).toBe(itemId);
    expect(normalizeEquipped(result)).toEqual(result);
  });

  it("着ている判定: セットの枠がぜんぶ同じ。ひとつでも違えば着ていない", () => {
    const preset = OUTFIT_PRESETS[0];
    const worn = applyOutfit(DEFAULT_EQUIPPED, preset);
    expect(isOutfitWorn(worn, preset)).toBe(true);
    expect(isOutfitWorn(DEFAULT_EQUIPPED, preset)).toBe(false);
    const [slot] = Object.keys(preset.equipped);
    expect(isOutfitWorn({ ...worn, [slot]: "something_else" }, preset)).toBe(false);
  });

  it("見せる絵文字: ふだんの装備と同じものは省き、ぜんぶカタログの絵文字", () => {
    for (const preset of OUTFIT_PRESETS) {
      const icons = outfitIcons(preset);
      expect(icons.length, preset.id).toBeGreaterThanOrEqual(1);
      expect(icons.length, preset.id).toBeLessThanOrEqual(Object.keys(preset.equipped).length);
    }
    const casual = OUTFIT_PRESETS.find((preset) => preset.id === "outfit_casual")!;
    expect(outfitIcons(casual)).toEqual(["🧭", "👜", "🐱"]); // ふく・くつは いつもと同じなので出さない
  });

  it("解放: 必要なレベルの最初の正解数になったら着られる。それまでは「あと何もん」", () => {
    const locked = OUTFIT_PRESETS.find((preset) => outfitRequiredLevel(preset) === 4)!;
    const need = GROWTH_LEVELS[3].minCorrect;
    expect(isOutfitUnlocked(locked, need - 1)).toBe(false);
    expect(outfitRemainingCorrect(locked, need - 1)).toBe(1);
    expect(isOutfitUnlocked(locked, need)).toBe(true);
    expect(outfitRemainingCorrect(locked, need)).toBe(0);
  });
});

describe("remainingCorrectForLevel / ForItem: あと何もんで かいほうされるか", () => {
  it("レベルの最初の正解数までの差(すでに届いていれば 0)", () => {
    expect(remainingCorrectForLevel(1, 0)).toBe(0);
    expect(remainingCorrectForLevel(2, 0)).toBe(5);
    expect(remainingCorrectForLevel(2, 4)).toBe(1);
    expect(remainingCorrectForLevel(2, 5)).toBe(0);
    expect(remainingCorrectForLevel(10, 100)).toBe(200);
    expect(remainingCorrectForLevel(10, 999)).toBe(0);
  });

  it("範囲の外のレベルは 1〜10 に丸める", () => {
    expect(remainingCorrectForLevel(0, 0)).toBe(0);
    expect(remainingCorrectForLevel(99, 0)).toBe(300);
  });

  it("アイテムは そのアイテムのレベルで数える", () => {
    const crown = ACCESSORY_CATALOG.find((item) => item.id === "hat_crown")!;
    expect(remainingCorrectForItem(crown, 20)).toBe(30);
    expect(remainingCorrectForItem(crown, 50)).toBe(0);
  });
});
