/**
 * 着せかえアイテムと成長レベルの定義(クライアント・サーバー共通の純粋データ)。
 */

export type CharacterId =
  | "char_kanoha"
  | "char_fuwari"
  | "char_hinata"
  | "char_ren"
  | "char_riku"
  | "char_mia";

import { EXTRA_ITEMS } from "./catalogExtraItems";
import { BASE_ITEMS } from "./catalogItems";
import type { SlotId } from "./slots";

/** 着せかえの枠。一覧の正本は slots.ts。 */
export type AccessoryCategory = SlotId;

export interface AccessoryItem {
  id: string;
  name: string;
  category: AccessoryCategory;
  icon: string;
  unlockLevel: number;
  description: string;
  previewImage?: string;
}

/** 全アイテム。画面では 枠(category)ごとに、ここに並べた順で出る。 */
export const ACCESSORY_CATALOG: readonly AccessoryItem[] = [...BASE_ITEMS, ...EXTRA_ITEMS];

export interface EquippedAccessories {
  character?: string;
  hat: string;
  glasses: string;
  gloves: string;
  clothes: string;
  hairstyle?: string;
  hair_color?: string;
  shoes?: string;
  shoes_color?: string;
  accessory?: string;
  effect?: string;
  pet?: string;
  motion?: string;
}

export const DEFAULT_EQUIPPED: EquippedAccessories = {
  character: "char_kanoha",
  hat: "hat_none",
  glasses: "glasses_none",
  gloves: "gloves_none",
  clothes: "clothes_tshirt",
  hairstyle: "hair_bun",
  hair_color: "hair_color_brown",
  shoes: "shoes_sneaker",
  shoes_color: "shoes_color_pink",
  accessory: "acc_none",
  effect: "effect_none",
  pet: "pet_none",
  motion: "motion_calm",
};

export const CHARACTER_DEFAULT_HAIRSTYLES: Record<CharacterId, string> = {
  char_kanoha: "hair_bun",
  char_fuwari: "hair_fluffy",
  char_hinata: "hair_bob",
  char_ren: "hair_fluffy",
  char_riku: "hair_fluffy",
  char_mia: "hair_twin_bun",
};

export const CHARACTER_DEFAULT_HAIR_COLORS: Record<CharacterId, string> = {
  char_kanoha: "hair_color_brown",
  char_fuwari: "hair_color_silver",
  char_hinata: "hair_color_brown",
  char_ren: "hair_color_silver",
  char_riku: "hair_color_black",
  char_mia: "hair_color_brown",
};

export interface GrowthLevelInfo {
  level: number;
  stageName: string;
  minCorrect: number;
  maxCorrect: number; // 次のレベルに必要な正解数（最後のレベル(Lv.10)はInfinity）
  title: string;
  rewardDescription: string;
}

export const GROWTH_LEVELS: readonly GrowthLevelInfo[] = [
  {
    level: 1,
    stageName: "タネのめ",
    minCorrect: 0,
    maxCorrect: 5,
    title: "ちいさな めぶき",
    rewardDescription: "たんけんぼう と まるめがね、がくせいふく が つかえるよ",
  },
  {
    level: 2,
    stageName: "ふたば",
    minCorrect: 5,
    maxCorrect: 15,
    title: "げんきな ふたば",
    rewardDescription: "あかいベレーぼう、たんけんベスト、キラキラ・いぬ・ぴょんぴょん が かいほう！",
  },
  {
    level: 3,
    stageName: "よつば",
    minCorrect: 15,
    maxCorrect: 30,
    title: "しあわせの よつば",
    rewardDescription: "ピンクのリボン、ほしのサングラス、ポップパーカー、ハート・うさぎ・ふわふわ が かいほう！",
  },
  {
    level: 4,
    stageName: "つぼみ",
    minCorrect: 30,
    maxCorrect: 50,
    title: "かがやく つぼみ",
    rewardDescription: "まほうのぼうし、きんのグローブ、まほうのローブ、ほしふり・パンダ・ゆらゆら が かいほう！",
  },
  {
    level: 5,
    stageName: "まんかいマスター",
    minCorrect: 50,
    maxCorrect: 80,
    title: "まんかいの がくしゅうマスター",
    rewardDescription: "きんのクラウン、ゆうしゃのよろい、シャボンだま・ことり・むらさきの かみ が かいほう！",
  },
  {
    level: 6,
    stageName: "きらきらのはな",
    minCorrect: 80,
    maxCorrect: 120,
    title: "きらきら かがやく はな",
    rewardDescription: "もりのみどりの かみ、くまのペット、はなびら、ダンスが かいほう！",
  },
  {
    level: 7,
    stageName: "にじいろのはな",
    minCorrect: 120,
    maxCorrect: 170,
    title: "にじいろの はなびら",
    rewardDescription: "ゆきのエフェクトと オレンジのかみが かいほう！",
  },
  {
    level: 8,
    stageName: "ほしのはな",
    minCorrect: 170,
    maxCorrect: 230,
    title: "ほしぞらの はな",
    rewardDescription: "にじのエフェクト、ユニコーン、あかい かみが かいほう！",
  },
  {
    level: 9,
    stageName: "つきのはな",
    minCorrect: 230,
    maxCorrect: 300,
    title: "つきあかりの はな",
    rewardDescription: "くるくるの うごきと まっしろの かみが かいほう！",
  },
  {
    level: 10,
    stageName: "でんせつのマスター",
    minCorrect: 300,
    maxCorrect: Infinity,
    title: "でんせつの がくしゅうマスター",
    rewardDescription: "オーラと ドラゴンが かいほう！ ぜんぶの アイテムを あつめたよ！",
  },
] as const;

export function getCharacterLevel(totalCorrect: number): GrowthLevelInfo {
  for (let i = GROWTH_LEVELS.length - 1; i >= 0; i--) {
    if (totalCorrect >= GROWTH_LEVELS[i].minCorrect) {
      return GROWTH_LEVELS[i];
    }
  }
  return GROWTH_LEVELS[0];
}

export function isAccessoryUnlocked(item: AccessoryItem, totalCorrect: number): boolean {
  const currentLevel = getCharacterLevel(totalCorrect);
  return currentLevel.level >= item.unlockLevel;
}
