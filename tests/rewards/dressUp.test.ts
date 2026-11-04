import { describe, expect, it } from "vitest";
import {
  CHARACTER_DEFAULT_HAIRSTYLES,
  CHARACTER_DEFAULT_HAIR_COLORS,
  DEFAULT_EQUIPPED,
} from "@/lib/rewards/catalog";
import { currentCharacterId, diffEquipped, equipAfterTap, resetToDefaults, slotDefault } from "@/lib/rewards/dressUp";

describe("currentCharacterId", () => {
  it("falls back to Kanoha for a missing or unknown character", () => {
    expect(currentCharacterId({ ...DEFAULT_EQUIPPED, character: undefined })).toBe("char_kanoha");
    expect(currentCharacterId({ ...DEFAULT_EQUIPPED, character: "char_unknown" })).toBe("char_kanoha");
    expect(currentCharacterId({ ...DEFAULT_EQUIPPED, character: "char_ren" })).toBe("char_ren");
  });
});

describe("slotDefault", () => {
  it("uses the current character's own hairstyle and hair colour", () => {
    const fuwari = { ...DEFAULT_EQUIPPED, character: "char_fuwari" };
    expect(slotDefault("hairstyle", fuwari)).toBe(CHARACTER_DEFAULT_HAIRSTYLES.char_fuwari);
    expect(slotDefault("hair_color", fuwari)).toBe(CHARACTER_DEFAULT_HAIR_COLORS.char_fuwari);
  });

  it("uses the shared default for every other slot, including the new ones", () => {
    expect(slotDefault("hat", DEFAULT_EQUIPPED)).toBe("hat_none");
    expect(slotDefault("effect", DEFAULT_EQUIPPED)).toBe("effect_none");
    expect(slotDefault("pet", DEFAULT_EQUIPPED)).toBe("pet_none");
    expect(slotDefault("motion", DEFAULT_EQUIPPED)).toBe("motion_calm");
  });
});

describe("equipAfterTap", () => {
  it("puts the tapped item on without touching the input", () => {
    const before = { ...DEFAULT_EQUIPPED };
    const after = equipAfterTap(before, "hat", "hat_safari");
    expect(after).toEqual({ ...DEFAULT_EQUIPPED, hat: "hat_safari" });
    expect(before).toEqual(DEFAULT_EQUIPPED);
  });

  it("takes the item off (back to the default) when the worn one is tapped again", () => {
    const worn = { ...DEFAULT_EQUIPPED, pet: "pet_cat" };
    expect(equipAfterTap(worn, "pet", "pet_cat").pet).toBe("pet_none");
  });

  it("treats an unset slot as its default when deciding whether it is worn", () => {
    const unset = { ...DEFAULT_EQUIPPED, hat: undefined } as unknown as typeof DEFAULT_EQUIPPED;
    expect(equipAfterTap(unset, "hat", "hat_none").hat).toBe("hat_none");
  });

  it("gives the new character its own hairstyle and hair colour, and keeps the other slots", () => {
    const worn = { ...DEFAULT_EQUIPPED, hat: "hat_safari", effect: "effect_sparkle", hair_color: "hair_color_pink" };
    const after = equipAfterTap(worn, "character", "char_fuwari");
    expect(after).toMatchObject({
      character: "char_fuwari",
      hairstyle: CHARACTER_DEFAULT_HAIRSTYLES.char_fuwari,
      hair_color: CHARACTER_DEFAULT_HAIR_COLORS.char_fuwari,
      hat: "hat_safari",
      effect: "effect_sparkle",
    });
  });

  it("goes back to Kanoha (and her hair) when the current character is tapped again", () => {
    const fuwari = equipAfterTap(DEFAULT_EQUIPPED, "character", "char_fuwari");
    const back = equipAfterTap(fuwari, "character", "char_fuwari");
    expect(back).toMatchObject({
      character: "char_kanoha",
      hairstyle: CHARACTER_DEFAULT_HAIRSTYLES.char_kanoha,
      hair_color: CHARACTER_DEFAULT_HAIR_COLORS.char_kanoha,
    });
  });
});

describe("resetToDefaults", () => {
  it("clears every slot, including effect, pet and motion, but stays the same character", () => {
    const dressed = {
      ...DEFAULT_EQUIPPED,
      character: "char_hinata",
      hat: "hat_crown",
      effect: "effect_aura",
      pet: "pet_dragon",
      motion: "motion_spin",
      hairstyle: "hair_twintail",
    };
    expect(resetToDefaults(dressed)).toEqual({
      ...DEFAULT_EQUIPPED,
      character: "char_hinata",
      hairstyle: CHARACTER_DEFAULT_HAIRSTYLES.char_hinata,
      hair_color: CHARACTER_DEFAULT_HAIR_COLORS.char_hinata,
    });
  });
});

describe("diffEquipped", () => {
  it("returns only the slots that changed, with their new values", () => {
    const before = { ...DEFAULT_EQUIPPED, hat: "hat_safari" };
    const after = { ...before, hat: "hat_none", pet: "pet_cat", effect: "effect_sparkle" };
    expect(diffEquipped(before, after)).toEqual({ hat: "hat_none", pet: "pet_cat", effect: "effect_sparkle" });
  });

  it("is empty when nothing changed, and does not touch its inputs", () => {
    const before = { ...DEFAULT_EQUIPPED };
    const frozen = JSON.stringify(before);
    expect(diffEquipped(before, { ...DEFAULT_EQUIPPED })).toEqual({});
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it("ignores a slot the new set leaves unset (there is nothing to send for it)", () => {
    const after = { ...DEFAULT_EQUIPPED, pet: undefined };
    expect(diffEquipped({ ...DEFAULT_EQUIPPED, pet: "pet_cat" }, after)).toEqual({});
  });

  it("covers a character switch: the character and her own hair, nothing else", () => {
    const after = equipAfterTap(DEFAULT_EQUIPPED, "character", "char_ren");
    expect(Object.keys(diffEquipped(DEFAULT_EQUIPPED, after)).sort()).toEqual(["character", "hair_color", "hairstyle"]);
  });
});
