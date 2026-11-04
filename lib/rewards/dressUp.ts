import {
  CHARACTER_DEFAULT_HAIRSTYLES,
  CHARACTER_DEFAULT_HAIR_COLORS,
  DEFAULT_EQUIPPED,
  type AccessoryCategory,
  type CharacterId,
  type EquippedAccessories,
} from "./catalog";
import { SLOT_IDS } from "./slots";

/**
 * 着せかえ画面の「タップしたら装備がどうなるか」(クライアント・サーバー共通の純粋関数)。
 */

const FALLBACK_CHARACTER: CharacterId = "char_kanoha";

const isCharacterId = (id: unknown): id is CharacterId => typeof id === "string" && id in CHARACTER_DEFAULT_HAIRSTYLES;

/** 着せかえ中のキャラクター(知らない ID や未設定は かのは)。 */
export const currentCharacterId = (equipped: EquippedAccessories): CharacterId =>
  isCharacterId(equipped.character) ? equipped.character : FALLBACK_CHARACTER;

/** その枠の「いつもの」。髪型・髪色は、いまのキャラクターの標準。 */
export function slotDefault(slot: AccessoryCategory, equipped: EquippedAccessories): string {
  const character = currentCharacterId(equipped);
  if (slot === "hairstyle") return CHARACTER_DEFAULT_HAIRSTYLES[character];
  if (slot === "hair_color") return CHARACTER_DEFAULT_HAIR_COLORS[character];
  return DEFAULT_EQUIPPED[slot] ?? "";
}

/**
 * アイテムをタップしたあとの装備。着ているものをもう一度タップしたら「いつもの」に戻す。
 * キャラクターを替えたときは、髪型・髪色もそのキャラクターの標準にする。元の装備は変えない。
 */
export function equipAfterTap(current: EquippedAccessories, slot: AccessoryCategory, itemId: string): EquippedAccessories {
  const fallback = slotDefault(slot, current);
  const next = { ...current, [slot]: (current[slot] ?? fallback) === itemId ? fallback : itemId };
  if (slot !== "character") return next;
  const character = currentCharacterId(next);
  return { ...next, hairstyle: CHARACTER_DEFAULT_HAIRSTYLES[character], hair_color: CHARACTER_DEFAULT_HAIR_COLORS[character] };
}

/** 変わった枠だけ(あとの値)。同じなら空。元の装備は変えない。サーバーへは、この変えた分だけを送る。 */
export function diffEquipped(before: EquippedAccessories, after: EquippedAccessories): Partial<EquippedAccessories> {
  return SLOT_IDS.reduce<Partial<EquippedAccessories>>((changes, slot) => {
    const next = after[slot];
    return next !== undefined && before[slot] !== next ? { ...changes, [slot]: next } : changes;
  }, {});
}

/** 「いつもの ふく」: キャラクターはそのまま、ほかの枠を全部「いつもの」にする。 */
export function resetToDefaults(current: EquippedAccessories): EquippedAccessories {
  const character = currentCharacterId(current);
  return {
    ...DEFAULT_EQUIPPED,
    character,
    hairstyle: CHARACTER_DEFAULT_HAIRSTYLES[character],
    hair_color: CHARACTER_DEFAULT_HAIR_COLORS[character],
  };
}
