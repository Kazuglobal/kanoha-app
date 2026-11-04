import { ACCESSORY_CATALOG, DEFAULT_EQUIPPED } from "@/lib/rewards/catalog";

/**
 * キャラクターのまわりに出すもの(エフェクト・ペット)と、待機中のうごきの定義。
 * どれも絵ファイルを読まず、絵文字と SVG で描く。配置は番号から決まる(乱数を使わない)ので、サーバーとブラウザで同じ描画になる。
 */

/** full=ホームなど / subtle=問題を解いている間(気が散らないよう控えめ) */
export type Intensity = "full" | "subtle";

export const MOTION_NAMES = ["calm", "bouncy", "float", "sway", "dance", "spin"] as const;
export type MotionName = (typeof MOTION_NAMES)[number];

/** 待機中のうごき。知らない ID は「しずか」。問題を解いている間は、いつも「しずか」。 */
export function resolveMotion(motionId: string | undefined, intensity: Intensity): MotionName {
  if (intensity === "subtle") return "calm";
  const name = motionId?.replace(/^motion_/, "") ?? "";
  return (MOTION_NAMES as readonly string[]).includes(name) ? (name as MotionName) : "calm";
}

export interface Particle {
  /** 1024×1536 の枠の中の位置と大きさ */
  x: number;
  y: number;
  size: number;
  /** アニメーションの待ち時間・1周の秒数 */
  delay: number;
  duration: number;
}

export type EffectShape = "glyph" | "bubble" | "orbit" | "aura";
export type EffectMotion = "twinkle" | "rise" | "fall";

export interface EffectSpec {
  /** data-effect に出す名前 */
  name: string;
  shape: EffectShape;
  /** glyph のときの絵文字(カタログのアイコン) */
  glyph: string | null;
  motion: EffectMotion;
  particles: readonly Particle[];
}

interface EffectRecipe {
  name: string;
  shape: EffectShape;
  motion: EffectMotion;
  count: number;
  /** 粒の高さの範囲(上へのぼる粒は下から、降る粒は上から始める) */
  yFrom: number;
  yTo: number;
}

const EFFECT_RECIPES: Readonly<Record<string, EffectRecipe>> = {
  effect_sparkle: { name: "sparkle", shape: "glyph", motion: "twinkle", count: 9, yFrom: 150, yTo: 1350 },
  effect_hearts: { name: "hearts", shape: "glyph", motion: "rise", count: 7, yFrom: 800, yTo: 1350 },
  effect_stars: { name: "stars", shape: "glyph", motion: "fall", count: 8, yFrom: 100, yTo: 700 },
  effect_bubbles: { name: "bubbles", shape: "bubble", motion: "rise", count: 9, yFrom: 800, yTo: 1350 },
  effect_petals: { name: "petals", shape: "glyph", motion: "fall", count: 8, yFrom: 100, yTo: 700 },
  effect_snow: { name: "snow", shape: "glyph", motion: "fall", count: 10, yFrom: 100, yTo: 700 },
  effect_rainbow: { name: "rainbow", shape: "orbit", motion: "twinkle", count: 0, yFrom: 0, yTo: 1 },
  effect_aura: { name: "aura", shape: "aura", motion: "twinkle", count: 0, yFrom: 0, yTo: 1 },
};

const spreadParticles = ({ count, yFrom, yTo }: EffectRecipe, seed: number): Particle[] =>
  Array.from({ length: count }, (_, i) => ({
    x: 100 + ((i * 331 + seed * 97) % 820),
    y: yFrom + ((i * 457 + seed * 61) % (yTo - yFrom)),
    size: 56 + ((i * 23 + seed * 13) % 36),
    delay: ((i * 5 + seed) % 9) * 0.5,
    duration: 3 + ((i * 3 + seed) % 5) * 0.6,
  }));

/** 顔のあたり(1024×1536 の枠の中)。「動きを減らす」で粒が止まったとき、ここにある粒は出さない。 */
export const isOnFace = (x: number, y: number): boolean => x >= 250 && x <= 790 && y >= 100 && y <= 720;

const iconOf = (itemId: string): string | null => ACCESSORY_CATALOG.find((item) => item.id === itemId)?.icon ?? null;

/** エフェクトの描き方。「なし」・未設定・知らない ID は null(何も描かない)。 */
export function effectSpec(effectId: string | undefined): EffectSpec | null {
  const recipe = effectId ? EFFECT_RECIPES[effectId] : undefined;
  if (!recipe || !effectId) return null;
  return {
    name: recipe.name,
    shape: recipe.shape,
    glyph: recipe.shape === "glyph" ? iconOf(effectId) : null,
    motion: recipe.motion,
    particles: spreadParticles(recipe, effectId.length),
  };
}

/** ペットの絵文字(カタログのアイコン)。「なし」・未設定・知らない ID は null。 */
export function petIcon(petId: string | undefined): string | null {
  if (!petId || petId === DEFAULT_EQUIPPED.pet) return null;
  return ACCESSORY_CATALOG.find((item) => item.id === petId && item.category === "pet")?.icon ?? null;
}
