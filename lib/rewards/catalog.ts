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

export type AccessoryCategory =
  | "character"
  | "clothes"
  | "hairstyle"
  | "hair_color"
  | "shoes"
  | "shoes_color"
  | "hat"
  | "glasses"
  | "gloves"
  | "accessory";

export interface AccessoryItem {
  id: string;
  name: string;
  category: AccessoryCategory;
  icon: string;
  unlockLevel: number;
  description: string;
  previewImage?: string;
}

export const ACCESSORY_CATALOG: readonly AccessoryItem[] = [
  // キャラクター (Character)
  {
    id: "char_kanoha",
    name: "さゆき",
    category: "character",
    icon: "🎀",
    unlockLevel: 1,
    description: "げんきいっぱい！おだんごヘアの女の子",
    previewImage: "/images/character/kanoha-ref-happy.png",
  },
  {
    id: "char_fuwari",
    name: "ふわり",
    category: "character",
    icon: "🌸",
    unlockLevel: 1,
    description: "ふわふわシルバーヘアとお花のピンがチャームポイント",
    previewImage: "/images/character/chars/fuwari-base.png",
  },
  {
    id: "char_hinata",
    name: "ひなた",
    category: "character",
    icon: "🌻",
    unlockLevel: 1,
    description: "さらさらボブとあたたかい笑顔の女の子",
    previewImage: "/images/character/chars/hinata-base.png",
  },
  {
    id: "char_ren",
    name: "レン",
    category: "character",
    icon: "⚡",
    unlockLevel: 1,
    description: "クールなシルバーヘアのおしゃれマスター",
    previewImage: "/images/character/chars/ren-base.png",
  },
  {
    id: "char_riku",
    name: "リク",
    category: "character",
    icon: "🏀",
    unlockLevel: 1,
    description: "走るの大好き！スポーティな男の子",
    previewImage: "/images/character/chars/riku-base.png",
  },
  {
    id: "char_mia",
    name: "ミア",
    category: "character",
    icon: "📚",
    unlockLevel: 1,
    description: "ふわふわツインおだんごと丸メガネの女の子",
    previewImage: "/images/character/chars/mia-base.png",
  },

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

  // かみがた (Hairstyle)
  {
    id: "hair_bun",
    name: "おだんごアップ",
    category: "hairstyle",
    icon: "👧",
    unlockLevel: 1,
    description: "いつもの ふんわり おだんごヘア",
  },
  {
    id: "hair_bob",
    name: "さらさらボブ",
    category: "hairstyle",
    icon: "💇‍♀️",
    unlockLevel: 1,
    description: "すずしげな ボブカット",
  },
  {
    id: "hair_twintail",
    name: "ふわふわツインテール",
    category: "hairstyle",
    icon: "🎀",
    unlockLevel: 2,
    description: "ぴょんぴょん ゆれる ツインテール",
  },
  {
    id: "hair_pony",
    name: "すっきりポニーテール",
    category: "hairstyle",
    icon: "🐎",
    unlockLevel: 3,
    description: "げんきいっぱいな ポニーテール",
  },
  {
    id: "hair_long_wave",
    name: "プリンセスウェーブ",
    category: "hairstyle",
    icon: "✨",
    unlockLevel: 4,
    description: "おひめさま みたいなおしゃれヘア",
  },

  // かみのいろ (Hair Color)
  {
    id: "hair_color_brown",
    name: "ナチュラルブラウン",
    category: "hair_color",
    icon: "🟤",
    unlockLevel: 1,
    description: "いつもの やさしい ちゃいろ",
  },
  {
    id: "hair_color_black",
    name: "つややかブラック",
    category: "hair_color",
    icon: "⚫",
    unlockLevel: 1,
    description: "きりっと 落ち着いた くろかみ",
  },
  {
    id: "hair_color_pink",
    name: "ミルキーピンク",
    category: "hair_color",
    icon: "🌸",
    unlockLevel: 2,
    description: "かわいい パステルピンク",
  },
  {
    id: "hair_color_gold",
    name: "シャインゴールド",
    category: "hair_color",
    icon: "🟡",
    unlockLevel: 3,
    description: "きらきら あかるい きんぱつ",
  },
  {
    id: "hair_color_blue",
    name: "アクアブルー",
    category: "hair_color",
    icon: "💎",
    unlockLevel: 4,
    description: "すきとおる まほうの みずいろ",
  },

  // くつ (Shoes)
  {
    id: "shoes_sneaker",
    name: "くまちゃんスニーカー",
    category: "shoes",
    icon: "👟",
    unlockLevel: 1,
    description: "あるきやすい おきにいりスニーカー",
  },
  {
    id: "shoes_boots",
    name: "たんけんブーツ",
    category: "shoes",
    icon: "🥾",
    unlockLevel: 2,
    description: "しっかり ふみだせる レザーブーツ",
  },
  {
    id: "shoes_pumps",
    name: "リボンパンプス",
    category: "shoes",
    icon: "👠",
    unlockLevel: 3,
    description: "ちょっぴり おとなっぽい パンプス",
  },
  {
    id: "shoes_magical",
    name: "まほうのシューズ",
    category: "shoes",
    icon: "✨",
    unlockLevel: 4,
    description: "ふわふわ うかぶ まほうの くつ",
  },
  {
    id: "shoes_hero",
    name: "ゆうしゃのブーツ",
    category: "shoes",
    icon: "🛡️",
    unlockLevel: 5,
    description: "おうごんの ゆうしゃの ブーツ！",
  },

  // くつのいろ (Shoes Color)
  {
    id: "shoes_color_pink",
    name: "ストロベリーピンク",
    category: "shoes_color",
    icon: "🌸",
    unlockLevel: 1,
    description: "かわいい ピンクカラー",
  },
  {
    id: "shoes_color_white",
    name: "スノーホワイト",
    category: "shoes_color",
    icon: "⚪",
    unlockLevel: 1,
    description: "すっきり 清潔な しろ",
  },
  {
    id: "shoes_color_brown",
    name: "チョコブラウン",
    category: "shoes_color",
    icon: "🟤",
    unlockLevel: 2,
    description: "おしゃれな ブラウンレザー",
  },
  {
    id: "shoes_color_blue",
    name: "スカイブルー",
    category: "shoes_color",
    icon: "🔵",
    unlockLevel: 3,
    description: "あざやかな あおいろ",
  },
  {
    id: "shoes_color_gold",
    name: "きんいろ",
    category: "shoes_color",
    icon: "⭐",
    unlockLevel: 4,
    description: "かがやく ゴールド",
  },

  // その他アクセサリー (Accessory)
  {
    id: "acc_none",
    name: "なし",
    category: "accessory",
    icon: "🌱",
    unlockLevel: 1,
    description: "いつもの すっきりスタイル",
  },
  {
    id: "acc_bag_bear",
    name: "くまちゃんポシェット",
    category: "accessory",
    icon: "👜",
    unlockLevel: 1,
    description: "かわいい くまの おでかけバッグ",
  },
  {
    id: "acc_pin_star",
    name: "ほしのヘアピン",
    category: "accessory",
    icon: "⭐",
    unlockLevel: 2,
    description: "まえがみに ピカッと ほしの ピン",
  },
  {
    id: "acc_heart_earring",
    name: "ハートのイヤリング",
    category: "accessory",
    icon: "💖",
    unlockLevel: 3,
    description: "ゆらゆら ゆれる ピンクの ハート",
  },
  {
    id: "acc_wand",
    name: "まほうのステッキ",
    category: "accessory",
    icon: "🪄",
    unlockLevel: 4,
    description: "きらきら ひかる まほうの ステッキ！",
  },
  {
    id: "acc_wings",
    name: "てんしのつばさ",
    category: "accessory",
    icon: "🪽",
    unlockLevel: 5,
    description: "せなかに ひろがる ふわふわ つばさ！",
  },
] as const;

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
