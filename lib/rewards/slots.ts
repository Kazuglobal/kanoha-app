/**
 * 着せかえの「枠」(スロット)の一覧。クライアント・サーバー共通の純粋データで、ここが唯一の正本。
 * カタログの型・復元(rewardLogic)・API の入力検査・着せかえ画面のタブは、すべてここから作る。
 * effect / pet / うごき(motion)は キャラクターの絵のどこにも当てはめず、キャラクターの周りに出す・動きにするだけの枠。
 */

export const SLOT_IDS = [
  "character",
  "clothes",
  "hairstyle",
  "hair_color",
  "shoes",
  "shoes_color",
  "hat",
  "glasses",
  "gloves",
  "accessory",
  "effect",
  "pet",
  "motion",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export interface SlotInfo {
  readonly id: SlotId;
  /** 着せかえ画面のタブの名前(ひらがな・カタカナ) */
  readonly label: string;
  readonly icon: string;
}

const SLOT_DETAILS: Readonly<Record<SlotId, Omit<SlotInfo, "id">>> = {
  character: { label: "キャラ", icon: "🌟" },
  clothes: { label: "ふく", icon: "👕" },
  hairstyle: { label: "かみがた", icon: "👧" },
  hair_color: { label: "かみのいろ", icon: "🎨" },
  shoes: { label: "くつ", icon: "👟" },
  shoes_color: { label: "くつのいろ", icon: "🌈" },
  hat: { label: "ぼうし", icon: "🎩" },
  glasses: { label: "めがね", icon: "👓" },
  gloves: { label: "てぶくろ", icon: "🧤" },
  accessory: { label: "アクセ", icon: "✨" },
  effect: { label: "エフェクト", icon: "🎇" },
  pet: { label: "ペット", icon: "🐾" },
  motion: { label: "うごき", icon: "💫" },
};

/** 画面に出す順(SLOT_IDS と同じ順)。 */
export const SLOT_REGISTRY: readonly SlotInfo[] = SLOT_IDS.map((id) => ({ id, ...SLOT_DETAILS[id] }));
