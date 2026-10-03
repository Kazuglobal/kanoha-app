import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESSORY_CATALOG,
  equipAccessory,
  getCharacterLevel,
  getEquippedAccessories,
  getLastEquippedCategory,
  isAccessoryUnlocked,
} from "@/lib/rewards/characterGrowthStore";
import { recordCorrectAnswer } from "@/lib/rewards/rewardStore";

describe("characterGrowthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("getCharacterLevel", () => {
    it("returns level 1 (タネのめ) for 0 - 4 correct answers", () => {
      expect(getCharacterLevel(0).level).toBe(1);
      expect(getCharacterLevel(4).level).toBe(1);
    });

    it("returns level 2 (ふたば) for 5 - 14 correct answers", () => {
      expect(getCharacterLevel(5).level).toBe(2);
      expect(getCharacterLevel(14).level).toBe(2);
    });

    it("returns level 3 (よつば) for 15 - 29 correct answers", () => {
      expect(getCharacterLevel(15).level).toBe(3);
      expect(getCharacterLevel(29).level).toBe(3);
    });

    it("returns level 4 (つぼみ) for 30 - 49 correct answers", () => {
      expect(getCharacterLevel(30).level).toBe(4);
      expect(getCharacterLevel(49).level).toBe(4);
    });

    it("returns level 5 (まんかいマスター) for 50+ correct answers", () => {
      expect(getCharacterLevel(50).level).toBe(5);
      expect(getCharacterLevel(100).level).toBe(5);
    });
  });

  describe("isAccessoryUnlocked", () => {
    it("unlocks level 1 items immediately", () => {
      const safariHat = ACCESSORY_CATALOG.find((item) => item.id === "hat_safari")!;
      expect(isAccessoryUnlocked(safariHat, 0)).toBe(true);
    });

    it("locks higher level items until required correct answers are met", () => {
      const beretHat = ACCESSORY_CATALOG.find((item) => item.id === "hat_beret")!; // Lv.2 (min 5 correct)
      const crownHat = ACCESSORY_CATALOG.find((item) => item.id === "hat_crown")!; // Lv.5 (min 50 correct)
      const heroClothes = ACCESSORY_CATALOG.find((item) => item.id === "clothes_hero")!; // Lv.5 (min 50 correct)

      expect(isAccessoryUnlocked(beretHat, 4)).toBe(false);
      expect(isAccessoryUnlocked(beretHat, 5)).toBe(true);

      expect(isAccessoryUnlocked(crownHat, 49)).toBe(false);
      expect(isAccessoryUnlocked(crownHat, 50)).toBe(true);

      expect(isAccessoryUnlocked(heroClothes, 49)).toBe(false);
      expect(isAccessoryUnlocked(heroClothes, 50)).toBe(true);
    });
  });

  describe("equipAccessory & getEquippedAccessories", () => {
    it("returns default accessories initially", () => {
      const equipped = getEquippedAccessories();
      expect(equipped.hat).toBe("hat_none");
      expect(equipped.glasses).toBe("glasses_none");
      expect(equipped.gloves).toBe("gloves_none");
      expect(equipped.clothes).toBe("clothes_tshirt");
    });

    it("updates and saves equipped accessory and clothes", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const updated = equipAccessory("hat", "hat_beret");

      expect(updated.hat).toBe("hat_beret");
      expect(getEquippedAccessories().hat).toBe("hat_beret");
      expect(getLastEquippedCategory()).toBe("hat");

      const updatedClothes = equipAccessory("clothes", "clothes_school");
      expect(updatedClothes.clothes).toBe("clothes_school");
      expect(getEquippedAccessories().clothes).toBe("clothes_school");
      expect(getLastEquippedCategory()).toBe("clothes");

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "kanoha-accessory-update" })
      );
    });
  });

  describe("level-up event on recordCorrectAnswer", () => {
    it("dispatches kanoha-level-up event when reaching 5th correct answer", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      // 4問正解
      for (let i = 0; i < 4; i++) {
        recordCorrectAnswer();
      }

      // 5問目正解で Lv.1 → Lv.2 へ進化！
      const result5 = recordCorrectAnswer();
      expect(result5.leveledUp).toBe(true);
      expect(result5.newLevel.level).toBe(2);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "kanoha-level-up" })
      );
    });
  });
});
