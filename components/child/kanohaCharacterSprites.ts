import type {
  AccessoryCategory,
  CharacterId,
  EquippedAccessories,
} from "@/lib/rewards/characterGrowthStore";

/**
 * かのはキャラクターのスプライト表・クリップ・衣装の解決(表示に使う純粋な定数と関数)。
 * 描画コンポーネントは KanohaCharacter.tsx。
 */

export type Mood = "happy" | "think" | "celebrate";


export const SPRITES = {
  happy: "/images/character/kanoha-ref-happy.png",
  think: "/images/character/kanoha-ref-think.png",
  celebrate: "/images/character/kanoha-ref-celebrate.png",
  school: "/images/character/kanoha-ref-school.png",
  hoodie: "/images/character/kanoha-ref-hoodie.png",
  safari: "/images/character/kanoha-ref-safari.png",
  wizard: "/images/character/kanoha-ref-wizard.png",
  hero: "/images/character/kanoha-ref-hero.png",
  glassesRound: "/images/character/kanoha-ref-glasses-round.png",
  glassesStar: "/images/character/kanoha-ref-glasses-star.png",
  beret: "/images/character/kanoha-ref-beret.png",
  mittens: "/images/character/kanoha-ref-mittens.png",
  glovesGold: "/images/character/kanoha-ref-gloves-gold.png",
  hatBeret: "/images/character/kanoha-hat-beret.png",
  hatSafari: "/images/character/kanoha-hat-safari.png",
  hatWizard: "/images/character/kanoha-hat-wizard.png",
  hatCrown: "/images/character/kanoha-hat-crown.png",
} as const;

// 手袋領域のみを厳密に切り出し（上端 y=0% の透明領域を経由し、両手首のもこもこボアカフスを100%保持しつつ茶髪の毛先や胴体を除外）
export const GLOVES_CLIP =
  "polygon(18% 0%, 18% 36%, 32% 36%, 35% 39.5%, 41.5% 39.8%, 41.5% 49%, 33% 50.5%, 18% 50.5%, 18% 0%, 69.5% 0%, 69.5% 56%, 89.5% 56%, 89.5% 68%, 69.5% 68%, 69.5% 0%)";

// 膝下の靴下・靴・ブーツ領域（左足のふくらはぎを斜めに避けつつ元の靴を100%差し替える）
export const SHOE_REGION_CLIP =
  "polygon(24% 79.5%, 35% 78%, 49.5% 82.5%, 49.5% 85.5%, 76% 85.5%, 76% 100%, 24% 100%)";

// 靴カラー変更時は白い靴下や素足の肌を変色させず、靴本体のみを着色するポリゴン
export const SHOE_LEATHER_CLIP =
  "polygon(25% 81%, 35.5% 81%, 45.5% 85.5%, 45.5% 98%, 25% 98%, 25% 81%, 48.5% 88.5%, 65.5% 88%, 73% 99.5%, 48.5% 99.5%, 48.5% 88.5%)";

export const SHOES_COLOR_FILTERS: Record<string, string> = {
  shoes_color_pink: "none",
  shoes_color_white: "brightness(2.4) contrast(0.9) saturate(0.1)",
  shoes_color_brown: "sepia(0.95) hue-rotate(-25deg) brightness(0.65) contrast(1.2)",
  shoes_color_blue: "hue-rotate(185deg) saturate(2.8) brightness(1.15)",
  shoes_color_gold: "hue-rotate(25deg) saturate(4) brightness(1.3)",
};

export const SHOES_SPRITES: Record<string, string> = {
  shoes_sneaker: SPRITES.happy,
  shoes_boots: SPRITES.safari,
  shoes_pumps: SPRITES.school,
  shoes_magical: SPRITES.wizard,
  shoes_hero: SPRITES.hero,
};

export const NATIVE_OUTFIT_SHOES: Record<string, string> = {
  clothes_casual: "shoes_sneaker",
  clothes_tshirt: "shoes_sneaker",
  clothes_hoodie: "shoes_sneaker",
  clothes_school: "shoes_pumps",
  clothes_safari: "shoes_boots",
  clothes_wizard: "shoes_magical",
  clothes_hero: "shoes_hero",
};

export function buildBaseClipPath({
  clipTopHead,
  clipGloves,
  clipLeftHand,
  clipShoes,
}: {
  clipTopHead: boolean;
  clipGloves: boolean;
  clipLeftHand?: boolean;
  clipShoes: boolean;
}): string | undefined {
  if (!clipTopHead && !clipGloves && !clipLeftHand && !clipShoes) {
    return undefined;
  }

  const points: string[] = [];

  // 1. 上辺 (x: 0% -> 100%, 頭頂部のお団子・リボン・茶髪のみを中央で確実にクリップ除去し、左右の腕・手には一切干渉させない)
  if (clipTopHead) {
    points.push(
      "0% 0%",
      "12% 0%",
      "12% 35.2%",
      "34.5% 35.2%",
      "32.5% 33.5%",
      "32.5% 28%",
      "33.5% 23%",
      "36% 21.8%",
      "41% 21.2%",
      "61% 21.2%",
      "66.5% 22.8%",
      "68% 26%",
      "70.5% 26.5%",
      "70.5% 32.5%",
      "66.5% 34.5%",
      "66.5% 38%",
      "96% 38%",
      "96% 0%",
      "100% 0%",
    );
  } else {
    points.push("0% 0%", "100% 0%");
  }

  // 2. 右辺 (y: 0% -> 100%, 手袋着用時は右側の素手 y:56%..68% を切り抜く)
  if (clipGloves) {
    points.push(
      "100% 56%",
      "69.5% 56%",
      "69.5% 68%",
      "100% 68%",
      "100% 100%",
    );
  } else {
    points.push("100% 100%");
  }

  // 3. 下辺 (x: 100% -> 0%, 靴オーバーレイ時は元の靴をふくらはぎに沿って切り抜く)
  if (clipShoes) {
    points.push(
      "76% 100%",
      "76% 85.5%",
      "49.5% 85.5%",
      "49.5% 82.5%",
      "35% 78%",
      "24% 79.5%",
      "24% 100%",
      "0% 100%",
    );
  } else {
    points.push("0% 100%");
  }

  // 4. 左辺 (y: 100% -> 0%, 手袋または魔法のステッキ着用時は左側の素手を切り抜く)
  if (clipGloves || clipLeftHand) {
    points.push(
      "0% 50.5%",
      "33% 50.5%",
      "41.5% 49%",
      "41.5% 39.8%",
      "35% 39.5%",
      "32% 36%",
      "0% 36%",
    );
  }

  return `polygon(${points.join(", ")})`;
}

export type OutfitVariant = "base" | "school" | "safari" | "hoodie" | "wizard" | "hero";

export const NEW_CHARACTER_SPRITES: Record<Exclude<CharacterId, "char_kanoha">, Record<OutfitVariant, string>> = {
  char_fuwari: {
    base: "/images/character/chars/fuwari-base.png",
    school: "/images/character/chars/fuwari-school.png",
    safari: "/images/character/chars/fuwari-safari.png",
    hoodie: "/images/character/chars/fuwari-hoodie.png",
    wizard: "/images/character/chars/fuwari-wizard.png",
    hero: "/images/character/chars/fuwari-hero.png",
  },
  char_hinata: {
    base: "/images/character/chars/hinata-base.png",
    school: "/images/character/chars/hinata-school.png",
    safari: "/images/character/chars/hinata-safari.png",
    hoodie: "/images/character/chars/hinata-hoodie.png",
    wizard: "/images/character/chars/hinata-wizard.png",
    hero: "/images/character/chars/hinata-hero.png",
  },
  char_ren: {
    base: "/images/character/chars/ren-base.png",
    school: "/images/character/chars/ren-school.png",
    safari: "/images/character/chars/ren-safari.png",
    hoodie: "/images/character/chars/ren-hoodie.png",
    wizard: "/images/character/chars/ren-wizard.png",
    hero: "/images/character/chars/ren-hero.png",
  },
  char_riku: {
    base: "/images/character/chars/riku-base.png",
    school: "/images/character/chars/riku-school.png",
    safari: "/images/character/chars/riku-safari.png",
    hoodie: "/images/character/chars/riku-hoodie.png",
    wizard: "/images/character/chars/riku-wizard.png",
    hero: "/images/character/chars/riku-hero.png",
  },
  char_mia: {
    base: "/images/character/chars/mia-base.png",
    school: "/images/character/chars/mia-school.png",
    safari: "/images/character/chars/mia-safari.png",
    hoodie: "/images/character/chars/mia-hoodie.png",
    wizard: "/images/character/chars/mia-wizard.png",
    hero: "/images/character/chars/mia-hero.png",
  },
};

export const CHARACTER_DISPLAY_NAMES: Record<CharacterId, string> = {
  char_kanoha: "かのはちゃん",
  char_fuwari: "ふわりちゃん",
  char_hinata: "ひなたちゃん",
  char_ren: "レンくん",
  char_riku: "リクくん",
  char_mia: "ミアちゃん",
};

export interface CharacterAnchorMeta {
  ribbonTop: string;
  ribbonLeft: string;
  headRegionClip: string;
  bodyWithoutHeadClip: string;
  shoesClip: string;
  glovesClip?: string;
  hasBakedWingsInHero: boolean;
  pinTransform: string;
  earringTransform: string;
  wandTransform: string;
  bagTransform: string;
  wingsTransform: string;
  baseHairToneFilter?: string;
  hairstyleTransform?: string;
}

export const CHARACTER_ANCHORS: Record<Exclude<CharacterId, "char_kanoha">, CharacterAnchorMeta> = {
  char_fuwari: {
    ribbonTop: "6%",
    ribbonLeft: "49%",
    headRegionClip: "polygon(0% 0%, 74% 0%, 74% 25%, 67% 29.8%, 34% 29.8%, 34% 25.5%, 0% 25.5%)",
    bodyWithoutHeadClip:
      "polygon(0% 25.5%, 34% 25.5%, 34% 29.8%, 67% 29.8%, 74% 25%, 74% 0%, 100% 0%, 100% 100%, 0% 100%)",
    shoesClip: "polygon(26% 74%, 42% 74%, 42% 88%, 58% 85%, 58% 99.5%, 26% 99.5%)",
    glovesClip:
      "polygon(16% 0%, 16% 25.5%, 34.5% 25.5%, 34.5% 38.5%, 16% 38.5%, 16% 0%, 66% 0%, 66% 49%, 86% 49%, 86% 62%, 66% 62%, 66% 0%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(0%, -5%)",
    earringTransform: "translate(-1%, -7%) scale(0.88)",
    wandTransform: "translate(-2%, -10%) scale(0.9)",
    bagTransform: "translate(-2%, -10%) scale(0.9)",
    wingsTransform: "translate(0%, -8%) scale(0.95)",
    baseHairToneFilter: "none",
  },
  char_hinata: {
    ribbonTop: "5%",
    ribbonLeft: "50%",
    headRegionClip: "polygon(0% 0%, 100% 0%, 100% 32.2%, 72% 32.2%, 25% 32.2%, 25% 18%, 0% 18%)",
    bodyWithoutHeadClip:
      "polygon(0% 18%, 25% 18%, 25% 32.2%, 72% 32.2%, 100% 32.2%, 100% 100%, 0% 100%)",
    shoesClip: "polygon(36% 81%, 69% 81%, 69% 99.5%, 36% 99.5%)",
    glovesClip:
      "polygon(27% 0%, 27% 34%, 42% 34%, 42% 46%, 27% 46%, 27% 0%, 65% 0%, 65% 48%, 82% 48%, 82% 61%, 65% 61%, 65% 0%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(0%, -4%)",
    earringTransform: "translate(-2%, -5%) scale(0.88)",
    wandTransform: "translate(-2%, -6%) scale(0.9)",
    bagTransform: "translate(2%, -8%) scale(0.9)",
    wingsTransform: "translate(0%, -6%) scale(0.95)",
    baseHairToneFilter: "sepia(0.85) hue-rotate(352deg) saturate(2.1) brightness(0.95)",
    hairstyleTransform: "translate(1%, 0%) scale(0.98)",
  },
  char_ren: {
    ribbonTop: "4%",
    ribbonLeft: "46%",
    headRegionClip: "polygon(0% 0%, 100% 0%, 100% 17%, 76% 17%, 70% 24%, 24% 24%, 24% 17%, 0% 17%)",
    bodyWithoutHeadClip:
      "polygon(0% 17%, 24% 17%, 24% 24%, 70% 24%, 76% 17%, 100% 17%, 100% 100%, 0% 100%)",
    shoesClip: "polygon(23% 87%, 77% 87%, 77% 99.8%, 23% 99.8%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(-6%, -9%) scale(0.85)",
    earringTransform: "translate(-3%, -16%) scale(0.75)",
    wandTransform: "translate(2%, -8%) scale(0.88)",
    bagTransform: "translate(2%, -10%) scale(0.88)",
    wingsTransform: "translate(-1%, -12%) scale(0.95)",
    baseHairToneFilter: "none",
    hairstyleTransform: "translate(-3%, -2%) scale(0.94)",
  },
  char_riku: {
    ribbonTop: "5%",
    ribbonLeft: "55%",
    headRegionClip: "polygon(24% 0%, 100% 0%, 100% 25%, 74% 29.2%, 34% 29.2%, 24% 21%)",
    bodyWithoutHeadClip:
      "polygon(0% 0%, 24% 0%, 24% 21%, 34% 29.2%, 74% 29.2%, 100% 25%, 100% 100%, 0% 100%)",
    shoesClip: "polygon(24% 68%, 39% 68%, 39% 84%, 67% 82%, 67% 99.5%, 24% 99.5%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(1%, -8%) scale(0.85)",
    earringTransform: "translate(4%, -10%) scale(0.82)",
    wandTransform: "translate(-2%, -10%) scale(0.88)",
    bagTransform: "translate(-1%, -12%) scale(0.88)",
    wingsTransform: "translate(2%, -10%) scale(0.95)",
    baseHairToneFilter: "saturate(0.3) brightness(0.45) contrast(1.25)",
    hairstyleTransform: "translate(4%, -1%) scale(0.95)",
  },
  char_mia: {
    ribbonTop: "4%",
    ribbonLeft: "48%",
    headRegionClip: "polygon(0% 0%, 100% 0%, 100% 20%, 72% 25.5%, 28% 25.5%, 24% 20%, 0% 20%)",
    bodyWithoutHeadClip:
      "polygon(0% 20%, 24% 20%, 28% 25.5%, 72% 25.5%, 100% 20%, 100% 100%, 0% 100%)",
    shoesClip: "polygon(38% 85%, 62% 85%, 62% 99.5%, 38% 99.5%)",
    hasBakedWingsInHero: true,
    pinTransform: "translate(-3%, -8%) scale(0.85)",
    earringTransform: "translate(-2%, -13%) scale(0.78)",
    wandTransform: "translate(4%, -10%) scale(0.88)",
    bagTransform: "translate(2%, -11%) scale(0.88)",
    wingsTransform: "translate(-1%, -11%) scale(0.95)",
    baseHairToneFilter: "sepia(0.75) hue-rotate(345deg) saturate(1.8) brightness(0.88)",
    hairstyleTransform: "translate(-1%, -2%) scale(0.94)",
  },
};

export const NEW_CHAR_HAT_TO_VARIANT: Record<string, OutfitVariant> = {
  hat_none: "base",
  hat_ribbon: "base",
  hat_safari: "safari",
  hat_beret: "hoodie",
  hat_wizard: "wizard",
  hat_crown: "hero",
};

export const NEW_CHAR_SHOES_TO_VARIANT: Record<string, OutfitVariant> = {
  shoes_sneaker: "base",
  shoes_pumps: "school",
  shoes_boots: "safari",
  shoes_magical: "wizard",
  shoes_hero: "hero",
};

export const NATIVE_VARIANT_SHOES: Record<OutfitVariant, OutfitVariant> = {
  base: "base",
  hoodie: "base",
  school: "school",
  safari: "safari",
  wizard: "wizard",
  hero: "hero",
};

export function resolveNewCharacterVariant(
  accessories: EquippedAccessories,
  previewCategory?: AccessoryCategory,
): OutfitVariant {
  // 1. 服（clothes）が明示的に選ばれている場合は常に服の選択を最優先（前の服やアクセサリが残るのを完全に防止）
  switch (accessories.clothes) {
    case "clothes_school":
      return "school";
    case "clothes_safari":
      return "safari";
    case "clothes_hoodie":
      return "hoodie";
    case "clothes_wizard":
      return "wizard";
    case "clothes_hero":
      return "hero";
    case "clothes_tshirt":
    case "clothes_casual":
      return "base";
    default:
      break;
  }

  // 2. モーダルでタブプレビュー中の場合
  if (previewCategory === "hat") {
    if (accessories.hat === "hat_safari") return "safari";
    if (accessories.hat === "hat_beret") return "hoodie";
    if (accessories.hat === "hat_wizard") return "wizard";
    if (accessories.hat === "hat_crown") return "hero";
  } else if (previewCategory === "shoes") {
    if (accessories.shoes === "shoes_pumps") return "school";
    if (accessories.shoes === "shoes_boots") return "safari";
    if (accessories.shoes === "shoes_magical") return "wizard";
    if (accessories.shoes === "shoes_hero") return "hero";
    if (accessories.shoes === "shoes_sneaker") return "base";
  } else if (previewCategory === "gloves") {
    if (accessories.gloves === "gloves_mitten") return "hoodie";
    if (accessories.gloves === "gloves_gold") return "hero";
  }

  return "base";
}

export function getKanohaSprite(
  mood: Mood,
  accessories: EquippedAccessories,
  previewCategory?: AccessoryCategory,
): string {
  const charId = (accessories.character ?? "char_kanoha") as CharacterId;
  if (charId !== "char_kanoha" && charId in NEW_CHARACTER_SPRITES) {
    const variant = resolveNewCharacterVariant(accessories, previewCategory);
    return NEW_CHARACTER_SPRITES[charId][variant];
  }

  switch (accessories.clothes) {
    case "clothes_school":
      return SPRITES.school;
    case "clothes_safari":
      return SPRITES.safari;
    case "clothes_hoodie":
      return SPRITES.hoodie;
    case "clothes_wizard":
      return SPRITES.wizard;
    case "clothes_hero":
      return SPRITES.hero;
    default:
      return SPRITES[mood];
  }
}
