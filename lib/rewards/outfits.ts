import { ACCESSORY_CATALOG, DEFAULT_EQUIPPED, getCharacterLevel, type EquippedAccessories } from "./catalog";
import { remainingCorrectForLevel } from "./unlocks";

/**
 * コーデ(テーマ別の着せかえセット)。ワンタップで いくつかの枠をまとめて着せかえる。
 * キャラクター(character)は変えない。セットに無い枠(髪型など)も そのまま。
 */

export interface OutfitPreset {
  readonly id: string;
  /** 名前(ひらがな・カタカナ) */
  readonly name: string;
  readonly icon: string;
  readonly equipped: Readonly<Partial<Omit<EquippedAccessories, "character">>>;
}

export const OUTFIT_PRESETS: readonly OutfitPreset[] = [
  { id: "outfit_casual", name: "おでかけ", icon: "🎒", equipped: { clothes: "clothes_tshirt", hat: "hat_safari", shoes: "shoes_sneaker", accessory: "acc_bag_bear", pet: "pet_cat" } },
  { id: "outfit_school", name: "がっこう", icon: "🏫", equipped: { clothes: "clothes_school", glasses: "glasses_round", hat: "hat_none", shoes: "shoes_sneaker", shoes_color: "shoes_color_white", motion: "motion_calm" } },
  { id: "outfit_explorer", name: "たんけんたい", icon: "🧭", equipped: { clothes: "clothes_safari", hat: "hat_safari", shoes: "shoes_boots", gloves: "gloves_mitten", pet: "pet_dog" } },
  { id: "outfit_sparkle", name: "キラキラガール", icon: "✨", equipped: { clothes: "clothes_school", hair_color: "hair_color_pink", accessory: "acc_pin_star", effect: "effect_sparkle", motion: "motion_bouncy" } },
  { id: "outfit_cafe", name: "おしゃれカフェ", icon: "☕", equipped: { hat: "hat_beret", clothes: "clothes_hoodie", shoes: "shoes_pumps", hair_color: "hair_color_gold", pet: "pet_bunny" } },
  { id: "outfit_star", name: "スターのひ", icon: "⭐", equipped: { glasses: "glasses_star", clothes: "clothes_hoodie", accessory: "acc_heart_earring", effect: "effect_hearts", motion: "motion_float" } },
  { id: "outfit_wizard", name: "まほうつかい", icon: "🧙", equipped: { hat: "hat_wizard", clothes: "clothes_wizard", accessory: "acc_wand", shoes: "shoes_magical", effect: "effect_stars" } },
  { id: "outfit_panda", name: "パンダのおともだち", icon: "🐼", equipped: { pet: "pet_panda", clothes: "clothes_hoodie", gloves: "gloves_mitten", hair_color: "hair_color_blue", motion: "motion_sway" } },
  { id: "outfit_hero", name: "ゆうしゃ", icon: "🛡️", equipped: { clothes: "clothes_hero", shoes: "shoes_hero", hat: "hat_crown", gloves: "gloves_gold", accessory: "acc_wings" } },
  { id: "outfit_forest", name: "もりのようせい", icon: "🍃", equipped: { effect: "effect_petals", hair_color: "hair_color_green", pet: "pet_bear", motion: "motion_dance", clothes: "clothes_hoodie" } },
  { id: "outfit_rainbow", name: "にじいろパーティー", icon: "🌈", equipped: { effect: "effect_rainbow", pet: "pet_unicorn", hair_color: "hair_color_orange", clothes: "clothes_hero", shoes_color: "shoes_color_gold" } },
  { id: "outfit_legend", name: "でんせつのマスター", icon: "👑", equipped: { effect: "effect_aura", pet: "pet_dragon", hat: "hat_crown", clothes: "clothes_hero", motion: "motion_spin" } },
];

const levelOfItem = (itemId: string): number => ACCESSORY_CATALOG.find((item) => item.id === itemId)?.unlockLevel ?? Number.POSITIVE_INFINITY;

/** セットを着るのに要るレベル(中のアイテムでいちばん高いレベル)。 */
export const outfitRequiredLevel = (preset: OutfitPreset): number =>
  Math.max(1, ...Object.values(preset.equipped).map((itemId) => levelOfItem(itemId)));

export const isOutfitUnlocked = (preset: OutfitPreset, totalCorrect: number): boolean =>
  getCharacterLevel(totalCorrect).level >= outfitRequiredLevel(preset);

/** セットが着られるまで あと何もん(正解)か。 */
export const outfitRemainingCorrect = (preset: OutfitPreset, totalCorrect: number): number =>
  remainingCorrectForLevel(outfitRequiredLevel(preset), totalCorrect);

/** いまの装備にセットを重ねた、あたらしい装備(元は変えない)。 */
export const applyOutfit = (base: EquippedAccessories, preset: OutfitPreset): EquippedAccessories => ({ ...base, ...preset.equipped });

/** セットの枠がぜんぶ、いまの装備と同じなら true(着ている)。 */
export const isOutfitWorn = (equipped: EquippedAccessories, preset: OutfitPreset): boolean =>
  Object.entries(preset.equipped).every(([slot, itemId]) => equipped[slot as keyof EquippedAccessories] === itemId);

/** セットの中身を見せる絵文字。ふだんの装備(いつもの ふくなど)と同じものは省く。 */
export const outfitIcons = (preset: OutfitPreset): string[] =>
  Object.entries(preset.equipped)
    .filter(([slot, itemId]) => itemId !== DEFAULT_EQUIPPED[slot as keyof EquippedAccessories])
    .map(([, itemId]) => ACCESSORY_CATALOG.find((item) => item.id === itemId)?.icon)
    .filter((icon): icon is string => Boolean(icon));
