import "server-only";
import { SUBJECT_CONFIG, type Subject } from "@/lib/curriculum/subjects";
import { BANK_LEVEL, START_LEVEL, clampLevel, type Level, type SkillSummary } from "@/lib/learning/level";
import { hashSeed } from "@/lib/utils/random";
import { GENERATORS, hasGenerator } from "./registry";

/** 1 回のセットの問題数。 */
const DEFAULT_SIZE = 5;
const MAX_SIZE = 20;
/** 同じ小単元は 1 回のセットに 2 問まで。 */
const MAX_PER_SUB_UNIT = 2;
/** 新しい小単元は 1 回のセットに 2 つまで(一度に新しいことを出しすぎない)。 */
const NEW_PER_BATCH = 2;
/** 解放ずみの小単元の この割合が レベル 3 以上なら、次の単元を先に 1 問だけ出す。 */
const PREVIEW_SHARE = 0.7;
const PREVIEW_MIN_SKILLS = 3;

export interface SkillState extends SkillSummary {
  readonly unit: string;
  readonly subUnit: string;
}

/** まだ解いていない問題バンクの問題(生成器のない小単元の問題を出すのに使う)。 */
export interface BankCandidate {
  readonly id: string;
  readonly unit: string;
  readonly subUnit: string;
}

export interface PlanInput {
  readonly subject: Subject;
  /** 履歴のある小単元のようす(無い小単元は new あつかい) */
  readonly states: readonly SkillState[];
  /** ステージマップで解放ずみの単元 */
  readonly unlockedUnits: readonly string[];
  /** まだ解放されていない単元(開く順) */
  readonly lockedUnits: readonly string[];
  readonly bank: readonly BankCandidate[];
  /** 子ども × 日付 などの文字。同じ入力なら同じ計画になる */
  readonly seed: string;
  /** その日の何セット目か(0 から)。セットごとに組み合わせと問題を変える。0 以上の整数でなければ 0 にする */
  readonly seq: number;
  /** 問題数。既定 5、多くても 20 */
  readonly size?: number;
}

export type PlanReason = "practice" | "review" | "stretch" | "preview";

interface PlanItemBase {
  readonly reason: PlanReason;
  readonly unit: string;
  readonly subUnit: string;
  readonly level: Level;
}

export type PlanItem =
  | (PlanItemBase & { readonly kind: "generated"; readonly seed: string })
  | (PlanItemBase & { readonly kind: "bank"; readonly bankId: string });

/** seed をつける前の 1 問ぶん。 */
type Slot = PlanItemBase & { readonly bankId?: string };

interface Candidate {
  readonly unit: string;
  readonly subUnit: string;
  readonly summary: SkillSummary;
  /** 同じ入力なら変わらない並びの手がかり */
  readonly tie: number;
}

interface Buckets {
  readonly review: Candidate[];
  readonly ready: Candidate[];
  readonly fresh: Candidate[];
  readonly steady: Candidate[];
}

const NEW_SUMMARY: SkillSummary = { level: START_LEVEL, up: 0, down: 0, status: "new", attempts: 0, accuracy: 0, lastAt: null };
const keyOf = (item: { unit: string; subUnit: string }): string => `${item.unit}/${item.subUnit}`;
const isStretch = (slot: Slot): boolean => slot.reason === "stretch" || slot.reason === "preview";

function candidatesOf(input: PlanInput): Candidate[] {
  const unlocked = new Set(input.unlockedUnits);
  return GENERATORS.filter((entry) => entry.subject === input.subject && unlocked.has(entry.unit)).map((entry) => ({
    unit: entry.unit,
    subUnit: entry.subUnit,
    summary: input.states.find((state) => state.unit === entry.unit && state.subUnit === entry.subUnit) ?? NEW_SUMMARY,
    tie: hashSeed(`${input.seed}:${keyOf(entry)}`),
  }));
}

/** 並びの先頭から count 個。候補が多いときは、セットごとに ずらして 順番にまわす。 */
function takeRotating<T>(list: readonly T[], count: number, seq: number): T[] {
  if (count <= 0) return [];
  if (list.length <= count) return [...list];
  const start = (seq * count) % list.length;
  return Array.from({ length: count }, (_, index) => list[(start + index) % list.length]);
}

const compareLastAt = (a: Candidate, b: Candidate): number => (a.summary.lastAt ?? 0) - (b.summary.lastAt ?? 0);

function bucketsOf(candidates: readonly Candidate[]): Buckets {
  const of = (status: SkillSummary["status"]) => candidates.filter((candidate) => candidate.summary.status === status);
  return {
    review: of("review").sort((a, b) => a.summary.accuracy - b.summary.accuracy || compareLastAt(a, b) || a.tie - b.tie),
    ready: of("ready").sort((a, b) => b.summary.level - a.summary.level || a.tie - b.tie),
    fresh: of("new").sort((a, b) => a.tie - b.tie),
    steady: of("steady").sort((a, b) => compareLastAt(a, b) || a.tie - b.tie),
  };
}

const asSlot = (candidate: Candidate, reason: PlanReason): Slot => ({
  reason,
  unit: candidate.unit,
  subUnit: candidate.subUnit,
  level:
    reason === "review" ? clampLevel(candidate.summary.level - 1) : reason === "stretch" ? clampLevel(candidate.summary.level + 1) : candidate.summary.level,
});

/**
 * 足りない枠をうめる。まだ使っていない小単元 → 2 問目の順に、なれた小単元・おさらい・
 * (背のびの枠をこえた)できている小単元・新しい小単元の順で。新しい小単元は 2 つまで、足りなければさいごに増やす。
 * できている小単元の余りは、背のびにせず いまのレベルで出す。
 */
function topUp(picks: readonly Slot[], buckets: Buckets, size: number): Slot[] {
  const result = [...picks];
  const freshKeys = new Set(buckets.fresh.map(keyOf));
  const used = (key: string) => result.filter((slot) => keyOf(slot) === key).length;
  const freshUsed = () => new Set(result.map(keyOf).filter((key) => freshKeys.has(key))).size;
  const pools: readonly (readonly [readonly Candidate[], PlanReason])[] = [
    [buckets.steady, "practice"],
    [buckets.review, "review"],
    [buckets.ready, "practice"],
    [buckets.fresh, "practice"],
  ];
  const passes = [
    { limit: 1, freshCap: NEW_PER_BATCH },
    { limit: MAX_PER_SUB_UNIT, freshCap: NEW_PER_BATCH },
    { limit: 1, freshCap: Infinity },
    { limit: MAX_PER_SUB_UNIT, freshCap: Infinity },
  ];
  for (const { limit, freshCap } of passes) {
    for (const [candidates, reason] of pools) {
      for (const candidate of candidates) {
        if (result.length >= size) return result;
        const key = keyOf(candidate);
        if (used(key) >= limit) continue;
        if (freshKeys.has(key) && used(key) === 0 && freshUsed() >= freshCap) continue;
        result.push(asSlot(candidate, reason));
      }
    }
  }
  return result;
}

function chooseGenerated(input: PlanInput, candidates: readonly Candidate[], size: number): Slot[] {
  const buckets = bucketsOf(candidates);
  const quota = Math.min(2, Math.round(size * 0.4));
  const reviews = takeRotating(buckets.review, quota, input.seq);
  const stretches = takeRotating(buckets.ready, quota, input.seq);
  const practiceNeed = size - reviews.length - stretches.length;
  const newOnes = takeRotating(buckets.fresh, Math.min(NEW_PER_BATCH, practiceNeed), input.seq);
  const familiar = takeRotating(buckets.steady, practiceNeed - newOnes.length, input.seq);
  const picks = [
    ...reviews.map((candidate) => asSlot(candidate, "review")),
    ...stretches.map((candidate) => asSlot(candidate, "stretch")),
    // 新しい小単元は、なれた問題のあとに(セットの最初は なれた問題から始めたい)
    ...[...familiar, ...newOnes].map((candidate) => asSlot(candidate, "practice")),
  ];
  return topUp(picks, buckets, size);
}

/** 生成器のない小単元(読解・作文・表とグラフ など)の、まだ解いていないバンク問題。教科の単元だけ、同じ id は 1 つ。 */
function bankPool(input: PlanInput): BankCandidate[] {
  const unlocked = new Set(input.unlockedUnits);
  const ofSubject = new Set(SUBJECT_CONFIG[input.subject].units);
  const unique = new Map(
    input.bank
      .filter((entry) => ofSubject.has(entry.unit) && unlocked.has(entry.unit) && !hasGenerator(entry.unit, entry.subUnit))
      .map((entry) => [entry.id, entry] as const),
  );
  return [...unique.values()].sort((a, b) => hashSeed(`${input.seed}:${a.id}`) - hashSeed(`${input.seed}:${b.id}`));
}

const asBankSlot = (entry: BankCandidate): Slot => ({ reason: "practice", unit: entry.unit, subUnit: entry.subUnit, level: BANK_LEVEL, bankId: entry.id });

const lastIndexOf = (picks: readonly Slot[], test: (slot: Slot) => boolean): number => {
  for (let index = picks.length - 1; index >= 0; index -= 1) if (test(picks[index])) return index;
  return -1;
};

const replaceAt = (picks: readonly Slot[], index: number, slot: Slot): Slot[] => picks.map((item, position) => (position === index ? slot : item));

/**
 * バンク問題の枠。生成器のある問題が足りないとき(または満杯でも 3 問以上のとき)に 1 問。
 * 生成できる問題が 1 つもないときは、バンク問題だけで計画する(同じ小単元が 2 問をこえてもよい。出す問題がなくなるよりよい)。
 */
function withBank(input: PlanInput, picks: readonly Slot[], size: number): Slot[] {
  const pool = bankPool(input);
  if (pool.length === 0 || size <= 0) return [...picks];
  if (picks.length === 0) return takeRotating(pool, size, input.seq).map(asBankSlot);
  const chosen = asBankSlot(pool[input.seq % pool.length]);
  if (picks.length < size) return [...picks, chosen];
  if (size < 3) return [...picks];
  const slot = lastIndexOf(picks, (item) => item.reason === "practice" && item.bankId === undefined);
  return slot >= 0 ? replaceAt(picks, slot, chosen) : [...picks];
}

/** 先に出す次の単元: まだ開いていない単元のうち、生成器のある 最初の単元の最初の小単元。 */
function nextLockedSkill(input: PlanInput): { unit: string; subUnit: string } | undefined {
  for (const unit of input.lockedUnits) {
    const entry = GENERATORS.find((candidate) => candidate.subject === input.subject && candidate.unit === unit);
    if (entry) return { unit: entry.unit, subUnit: entry.subUnit };
  }
  return undefined;
}

function previewWanted(candidates: readonly Candidate[]): boolean {
  const practiced = candidates.filter((candidate) => candidate.summary.attempts > 0);
  if (practiced.length < PREVIEW_MIN_SKILLS) return false;
  return practiced.filter((candidate) => candidate.summary.level >= 3).length / candidates.length >= PREVIEW_SHARE;
}

function withPreview(input: PlanInput, candidates: readonly Candidate[], picks: readonly Slot[]): Slot[] {
  const next = nextLockedSkill(input);
  const slot = lastIndexOf(picks, (item) => item.reason === "practice" && item.bankId === undefined);
  if (!next || slot < 0 || !previewWanted(candidates)) return [...picks];
  return replaceAt(picks, slot, { reason: "preview", unit: next.unit, subUnit: next.subUnit, level: 1 });
}

/** 並べかた: なれた問題で始め、おさらいと背のびを交互に、おわりは背のびにしない(できた気持ちで終わる)。 */
function arrange(picks: readonly Slot[]): Slot[] {
  const practice = picks.filter((slot) => slot.reason === "practice");
  const reviews = picks.filter((slot) => slot.reason === "review");
  const stretches = picks.filter(isStretch);
  const middle: Slot[] = [];
  for (let index = 0; index < Math.max(reviews.length, stretches.length); index += 1) {
    if (reviews[index]) middle.push(reviews[index]);
    if (stretches[index]) middle.push(stretches[index]);
  }
  const [first, ...rest] = practice;
  const ordered = [...(first ? [first] : []), ...middle, ...rest];
  const last = ordered[ordered.length - 1];
  if (!last || !isStretch(last)) return ordered;
  const easier = lastIndexOf(ordered, (slot) => !isStretch(slot));
  return easier > 0 ? [...ordered.filter((_, index) => index !== easier), ordered[easier]] : ordered;
}

function finalize(input: PlanInput, picks: readonly Slot[]): PlanItem[] {
  return picks.map((slot, index): PlanItem => {
    const base = { reason: slot.reason, unit: slot.unit, subUnit: slot.subUnit, level: slot.level };
    return slot.bankId === undefined
      ? { ...base, kind: "generated", seed: `${input.seed}:${input.seq}:${index}` }
      : { ...base, kind: "bank", bankId: slot.bankId };
  });
}

const sanitizedSeq = (seq: number): number => (Number.isSafeInteger(seq) && seq >= 0 ? seq : 0);
const sanitizedSize = (size: number | undefined): number =>
  size === undefined || !Number.isFinite(size) ? DEFAULT_SIZE : Math.min(MAX_SIZE, Math.max(0, Math.floor(size)));

/**
 * 子どもの進み具合から、次の 1 セット(既定 5 問)を決める。
 * おさらい 2・背のび 2・ふつう 1 を中心に、読解など生成器のない小単元はバンク問題を 1 問。
 * 同じ入力なら同じ計画(乱数も時計も使わない)。seq が 0 以上の整数でないときは 0、size は 0〜20 に丸める。
 */
export function planBatch(rawInput: PlanInput): readonly PlanItem[] {
  const input = { ...rawInput, seq: sanitizedSeq(rawInput.seq) };
  const size = sanitizedSize(rawInput.size);
  const candidates = candidatesOf(input);
  const generated = candidates.length > 0 && size > 0 ? chooseGenerated(input, candidates, size) : [];
  const withBankSlot = withBank(input, generated, size);
  const withNext = withPreview(input, candidates, withBankSlot);
  return finalize(input, arrange(withNext).slice(0, size));
}
