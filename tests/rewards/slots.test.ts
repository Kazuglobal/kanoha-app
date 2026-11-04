import { describe, expect, it } from "vitest";
import { ACCESSORY_CATALOG, DEFAULT_EQUIPPED } from "@/lib/rewards/catalog";
import { CATEGORIES, normalizeEquipped } from "@/lib/rewards/rewardLogic";
import { SLOT_IDS, SLOT_REGISTRY, type SlotId } from "@/lib/rewards/slots";

describe("着せかえの枠(スロット)の一覧は 1 か所", () => {
  it("これまでの 10 枠に、エフェクト・ペット・うごき が加わる(重ならない)", () => {
    expect([...SLOT_IDS].sort()).toEqual(
      ["accessory", "character", "clothes", "effect", "glasses", "gloves", "hair_color", "hairstyle", "hat", "motion", "pet", "shoes", "shoes_color"].sort(),
    );
    expect(new Set(SLOT_IDS).size).toBe(SLOT_IDS.length);
  });

  it("画面の並び(SLOT_REGISTRY)は 枠ぜんぶを 1 回ずつ、SLOT_IDS と同じ順で持ち、名前と絵文字がある", () => {
    expect(SLOT_REGISTRY.map((slot) => slot.id)).toEqual([...SLOT_IDS]);
    for (const slot of SLOT_REGISTRY) {
      expect(slot.label.length, slot.id).toBeGreaterThan(0);
      expect(slot.icon.length, slot.id).toBeGreaterThan(0);
    }
  });

  it("カタログ・復元(rewardLogic)・既定の装備は、すべて同じ枠の一覧に合っている", () => {
    expect([...CATEGORIES]).toEqual([...SLOT_IDS]);
    const slots = new Set<string>(SLOT_IDS);
    for (const item of ACCESSORY_CATALOG) expect(slots.has(item.category), item.id).toBe(true);
    for (const slot of Object.keys(DEFAULT_EQUIPPED)) expect(slots.has(slot), slot).toBe(true);
  });

  it("どの枠にも、はずした状態(なし)かふつうの状態の アイテムがあり、既定の装備はそれを指す", () => {
    for (const slot of SLOT_IDS as readonly SlotId[]) {
      expect(ACCESSORY_CATALOG.some((item) => item.category === slot), slot).toBe(true);
      const equipped = DEFAULT_EQUIPPED[slot];
      if (equipped) expect(ACCESSORY_CATALOG.find((item) => item.id === equipped)?.category, slot).toBe(slot);
    }
  });

  it("古い保存(新しい枠が無い)を読んでも、新しい枠は 既定で補われる", () => {
    const old = { character: "char_ren", hat: "hat_wizard", glasses: "glasses_none", gloves: "gloves_none", clothes: "clothes_hoodie" };
    const restored = normalizeEquipped(old);
    expect(restored).toMatchObject({ character: "char_ren", hat: "hat_wizard", clothes: "clothes_hoodie" });
    expect(restored.effect).toBe(DEFAULT_EQUIPPED.effect);
    expect(restored.pet).toBe(DEFAULT_EQUIPPED.pet);
    expect(restored.motion).toBe(DEFAULT_EQUIPPED.motion);
  });

  it("枠ちがいのアイテム(effect に hat のもの)や 知らないアイテムは 既定にもどす", () => {
    const restored = normalizeEquipped({ effect: "hat_crown", pet: "no_such_pet", motion: "effect_sparkle" });
    expect(restored.effect).toBe(DEFAULT_EQUIPPED.effect);
    expect(restored.pet).toBe(DEFAULT_EQUIPPED.pet);
    expect(restored.motion).toBe(DEFAULT_EQUIPPED.motion);
  });
});
