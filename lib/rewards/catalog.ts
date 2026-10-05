/**
 * 着せかえアイテムと成長レベルの定義(クライアント・サーバー共通の純粋データ)。
 */

export type AccessoryCategory = "hat" | "glasses" | "gloves" | "clothes";

export interface AccessoryItem {
  id: string;
  name: string;
  category: AccessoryCategory;
  icon: string;
  unlockLevel: number;
  description: string;
}

export const ACCESSORY_CATALOG: readonly AccessoryItem[] = [
  // ぼうし (Hat)
  {
    id: "hat_none",
    name: "なし",
    category: "hat",
    icon: "🌱",
    unlockLevel: 1,
    description: "すずしげな ヘアスタイルだよ",
  },
  {
    id: "hat_safari",
    name: "たんけんぼう",
    category: "hat",
    icon: "🧭",
    unlockLevel: 1,
    description: "ぼうけんに ぴったりの ぼうし",
  },
  {
    id: "hat_beret",
    name: "あかいベレーぼう",
    category: "hat",
    icon: "🎨",
    unlockLevel: 2,
    description: "おしゃれないろの ベレーぼう",
  },
  {
    id: "hat_ribbon",
    name: "ピンクのリボン",
    category: "hat",
    icon: "🎀",
    unlockLevel: 3,
    description: "ふんわり おおきな リボン",
  },
  {
    id: "hat_wizard",
    name: "まほうのぼうし",
    category: "hat",
    icon: "🧙‍♂️",
    unlockLevel: 4,
    description: "ほしが ひかる まほうの ぼうし",
  },
  {
    id: "hat_crown",
    name: "きんのクラウン",
    category: "hat",
    icon: "👑",
    unlockLevel: 5,
    description: "がくしゅうマスターの おうかん！",
  },

  // めがね (Glasses)
  {
    id: "glasses_none",
    name: "なし",
    category: "glasses",
    icon: "👀",
    unlockLevel: 1,
    description: "いつもの かわいい おめめ",
  },
  {
    id: "glasses_round",
    name: "まるめがね",
    category: "glasses",
    icon: "👓",
    unlockLevel: 1,
    description: "はかせ みたいに かしこそう！",
  },
  {
    id: "glasses_star",
    name: "ほしのサングラス",
    category: "glasses",
    icon: "⭐",
    unlockLevel: 3,
    description: "きらきら げんきな サングラス",
  },

  // てぶくろ (Gloves)
  {
    id: "gloves_none",
    name: "なし",
    category: "gloves",
    icon: "✋",
    unlockLevel: 1,
    description: "いつもの かわいい おてて",
  },
  {
    id: "gloves_mitten",
    name: "しろいミトン",
    category: "gloves",
    icon: "🧤",
    unlockLevel: 1,
    description: "もこもこ あたたかい てぶくろ",
  },
  {
    id: "gloves_gold",
    name: "きんのグローブ",
    category: "gloves",
    icon: "✨",
    unlockLevel: 4,
    description: "かがやく ゆうしゃの グローブ",
  },

  // ふく (Clothes)
  {
    id: "clothes_tshirt",
    name: "いつものくまパーカー",
    category: "clothes",
    icon: "🧸",
    unlockLevel: 1,
    description: "くまのワッペンと ピンクのスカート",
  },
  {
    id: "clothes_school",
    name: "がくせいふく",
    category: "clothes",
    icon: "🎒",
    unlockLevel: 1,
    description: "きりっと かっこいい がくせいふく",
  },
  {
    id: "clothes_safari",
    name: "たんけんベスト",
    category: "clothes",
    icon: "🏕️",
    unlockLevel: 2,
    description: "ポケットいっぱいの たんけんベスト",
  },
  {
    id: "clothes_hoodie",
    name: "ポップパーカー",
    category: "clothes",
    icon: "🧥",
    unlockLevel: 3,
    description: "ふんわり あたたかい カラフルパーカー",
  },
  {
    id: "clothes_wizard",
    name: "まほうのローブ",
    category: "clothes",
    icon: "🔮",
    unlockLevel: 4,
    description: "ほしが ひかる まほうの ローブ",
  },
  {
    id: "clothes_hero",
    name: "ゆうしゃのよろい",
    category: "clothes",
    icon: "🛡️",
    unlockLevel: 5,
    description: "きんいろに かがやく ゆうしゃの よろい！",
  },
] as const;

export interface EquippedAccessories {
  hat: string;
  glasses: string;
  gloves: string;
  clothes: string;
}

export const DEFAULT_EQUIPPED: EquippedAccessories = {
  hat: "hat_none",
  glasses: "glasses_none",
  gloves: "gloves_none",
  clothes: "clothes_tshirt",
};

export interface GrowthLevelInfo {
  level: number;
  stageName: string;
  minCorrect: number;
  maxCorrect: number; // 次のレベルに必要な正解数（Lv.5はInfinity）
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
    rewardDescription: "あかいベレーぼう と たんけんベスト が かいほう！",
  },
  {
    level: 3,
    stageName: "よつば",
    minCorrect: 15,
    maxCorrect: 30,
    title: "しあわせの よつば",
    rewardDescription: "ピンクのリボン、ほしのサングラス、ポップパーカー が かいほう！",
  },
  {
    level: 4,
    stageName: "つぼみ",
    minCorrect: 30,
    maxCorrect: 50,
    title: "かがやく つぼみ",
    rewardDescription: "まほうのぼうし、きんのグローブ、まほうのローブ が かいほう！",
  },
  {
    level: 5,
    stageName: "まんかいマスター",
    minCorrect: 50,
    maxCorrect: Infinity,
    title: "まんかいの がくしゅうマスター",
    rewardDescription: "きんのクラウン と ゆうしゃのよろい が かいほう！",
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
