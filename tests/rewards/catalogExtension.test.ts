import { describe, expect, it } from "vitest";
import {
  ACCESSORY_CATALOG,
  type AccessoryCategory,
} from "@/lib/rewards/catalog";
import {
  canEquip,
  normalizeEquipped,
  CATEGORIES,
} from "@/lib/rewards/rewardLogic";

describe("Accessory Catalog and Dress-Up Extensions", () => {
  it("includes all 9 categories in CATEGORIES array", () => {
    const expectedCategories: AccessoryCategory[] = [
      "clothes",
      "hairstyle",
      "hair_color",
      "shoes",
      "shoes_color",
      "hat",
      "glasses",
      "gloves",
      "accessory",
    ];
    for (const cat of expectedCategories) {
      expect(CATEGORIES).toContain(cat);
    }
  });

  it("contains items for hairstyles, hair colors, shoes, shoes colors, and accessories", () => {
    const hairstyles = ACCESSORY_CATALOG.filter((i) => i.category === "hairstyle");
    const hairColors = ACCESSORY_CATALOG.filter((i) => i.category === "hair_color");
    const shoes = ACCESSORY_CATALOG.filter((i) => i.category === "shoes");
    const shoesColors = ACCESSORY_CATALOG.filter((i) => i.category === "shoes_color");
    const accessories = ACCESSORY_CATALOG.filter((i) => i.category === "accessory");

    expect(hairstyles.length).toBe(10);
    expect(hairstyles.every((h) => h.unlockLevel === 1)).toBe(true);
    expect(hairColors.length).toBeGreaterThanOrEqual(5);
    expect(shoes.length).toBeGreaterThanOrEqual(5);
    expect(shoesColors.length).toBeGreaterThanOrEqual(5);
    expect(accessories.length).toBeGreaterThanOrEqual(5);
  });

  it("allows equipping unlocked items in newly added categories", () => {
    // レベル4(100問正解)相当
    const totalCorrect = 100;

    // hair_bun は Lv.1 なので装備可能
    expect(canEquip("hairstyle", "hair_bun", totalCorrect)).toBe(true);
    // hair_color_pink は Lv.2 なので装備可能
    expect(canEquip("hair_color", "hair_color_pink", totalCorrect)).toBe(true);
    // shoes_boots は Lv.2 なので装備可能
    expect(canEquip("shoes", "shoes_boots", totalCorrect)).toBe(true);
    // acc_wand は Lv.4 なので装備可能
    expect(canEquip("accessory", "acc_wand", totalCorrect)).toBe(true);
    // acc_wings は Lv.5 (150問) なので未開放
    expect(canEquip("accessory", "acc_wings", 30)).toBe(false);
  });

  it("normalizes equipped accessories preserving new categories", () => {
    const input = {
      clothes: "clothes_school",
      hat: "hat_beret",
      glasses: "glasses_round",
      gloves: "gloves_mitten",
      hairstyle: "hair_twintail",
      hair_color: "hair_color_pink",
      shoes: "shoes_boots",
      shoes_color: "shoes_color_white",
      accessory: "acc_bag_bear",
    };

    const normalized = normalizeEquipped(input);
    expect(normalized.hairstyle).toBe("hair_twintail");
    expect(normalized.hair_color).toBe("hair_color_pink");
    expect(normalized.shoes).toBe("shoes_boots");
    expect(normalized.shoes_color).toBe("shoes_color_white");
    expect(normalized.accessory).toBe("acc_bag_bear");
  });
});
