/**
 * 子どものいまのレベルを、正誤の記録(出来事)から決める純粋関数。
 * DB も時計も読まない。呼び出し側が出来事と「いま」を渡すので、同じ入力なら同じ結果になる。
 *
 * - 続けて 3 回できたら 1 つ上げる。続けて 2 回まちがえたら 1 つ下げる(レベル 1〜5)
 * - 背のびした問題(いまより上)のまちがいでは下げない
 * - 答えのヒントを見てからの正解は、まちがいとして数える(自力でできたとは言えないため)
 * - 直近の正答率が低い・久しぶりの小単元は、おさらい(review)に回す
 */

export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

export const MIN_LEVEL: Level = 1;
export const MAX_LEVEL: Level = 5;
export const START_LEVEL: Level = 2;
/** 問題バンクの問題(いちばんふつうの難しさ)を、レベルに直すときの値 */
export const BANK_LEVEL: Level = 2;

/** この回数、続けて(いまのレベル以上で)できたら 1 つ上げる */
const UP_STREAK = 3;
/** この回数、続けて(いまのレベル以下で)まちがえたら 1 つ下げる */
const DOWN_STREAK = 2;
/** 続けてできた回数がこれ以上なら、背のびの問題を出してよい */
const READY_STREAK = 2;
const STALE_MS = 21 * 86_400_000;
/** 正答率は、最後のこの回数で見る */
const RECENT_WINDOW = 10;
/** 直近の正答率がこれより低く、解いた回数がこれ以上なら「苦手」として、おさらいに回す */
const WEAK_ACCURACY = 0.6;
const WEAK_MIN_ATTEMPTS = 4;

export interface LevelEvent {
  /** その問題のレベル(生成した問題はそのレベル、バンクは 2、AI の難易度は `levelFromDifficulty`) */
  readonly level: number;
  readonly correct: boolean;
  /** 答え(または答えが書かれた「ときかた」)のヒントを見たあとに答えた */
  readonly usedAnswerHint: boolean;
  /** 答えた時刻(エポックミリ秒) */
  readonly at: number;
}

export interface LevelProgress {
  readonly level: Level;
  /** いまのレベル以上で、続けてできた回数 */
  readonly up: number;
  /** いまのレベル以下で、続けてまちがえた回数 */
  readonly down: number;
}

export type SkillStatus = "new" | "review" | "ready" | "steady";

export interface SkillSummary extends LevelProgress {
  readonly status: SkillStatus;
  readonly attempts: number;
  /** 最後の 10 回のうち、できた割合(0〜1)。1 回も解いていなければ 0 */
  readonly accuracy: number;
  readonly lastAt: number | null;
}

export interface SkillContext {
  /** いまの時刻(エポックミリ秒)。久しぶりかどうかの判定に使う */
  readonly now: number;
}

/** 1〜5 に丸める。数でない値(NaN など)は開始レベル。 */
export const clampLevel = (value: number): Level =>
  Number.isFinite(value) ? (Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(value))) as Level) : START_LEVEL;

export type Difficulty = "basic" | "standard" | "advanced";

/** アップロード問題・AI の類題の難易度を、レベルに直す。 */
export const levelFromDifficulty = (difficulty: Difficulty): Level =>
  difficulty === "basic" ? 1 : difficulty === "advanced" ? 4 : 2;

const isSuccess = (event: LevelEvent): boolean => event.correct && !event.usedAnswerHint;

const moveTo = (level: number): LevelProgress => ({ level: clampLevel(level), up: 0, down: 0 });

function step(progress: LevelProgress, event: LevelEvent): LevelProgress {
  if (isSuccess(event)) {
    // かんたんな問題の正解は、まちがいの連続を止めるだけ
    if (event.level < progress.level) return { ...progress, down: 0 };
    const up = progress.up + 1;
    return up >= UP_STREAK ? moveTo(progress.level + 1) : { level: progress.level, up, down: 0 };
  }
  // 背のびした問題のまちがいは、レベルを下げる材料にしない
  if (event.level > progress.level) return { ...progress, up: 0 };
  const down = progress.down + 1;
  return down >= DOWN_STREAK ? moveTo(progress.level - 1) : { level: progress.level, up: 0, down };
}

/** 時刻の古い順。同じ時刻のときもレベル・正誤・ヒントで順を決める(入力の並びに左右されない)。 */
const compareEvents = (a: LevelEvent, b: LevelEvent): number =>
  a.at - b.at ||
  a.level - b.level ||
  Number(a.correct) - Number(b.correct) ||
  Number(a.usedAnswerHint) - Number(b.usedAnswerHint);

const byTime = (events: readonly LevelEvent[]): LevelEvent[] => [...events].sort(compareEvents);

const foldOrdered = (ordered: readonly LevelEvent[], start: Level): LevelProgress =>
  ordered.reduce(step, { level: start, up: 0, down: 0 });

/** 出来事(古い順でなくてもよい)を古いほうから順に畳み込んで、いまのレベルと連続回数を返す。 */
export const foldLevel = (events: readonly LevelEvent[], start: Level = START_LEVEL): LevelProgress =>
  foldOrdered(byTime(events), start);

function statusOf(
  progress: LevelProgress,
  attempts: number,
  accuracy: number,
  lastAt: number | null,
  context: SkillContext,
): SkillStatus {
  if (attempts === 0) return "new";
  const weak = attempts >= WEAK_MIN_ATTEMPTS && accuracy < WEAK_ACCURACY;
  if (progress.down > 0 || weak) return "review";
  // 久しぶりのときは、背のびさせずに おさらいから
  if (lastAt !== null && context.now - lastAt >= STALE_MS) return "review";
  if (progress.up >= READY_STREAK && progress.level < MAX_LEVEL) return "ready";
  return "steady";
}

/** 小単元ひとつぶんの出来事から、レベル・ようす(new/review/ready/steady)・正答率をまとめる。 */
export function summarizeSkill(events: readonly LevelEvent[], context: SkillContext): SkillSummary {
  const ordered = byTime(events);
  const progress = foldOrdered(ordered, START_LEVEL);
  const recent = ordered.slice(-RECENT_WINDOW);
  const accuracy = recent.length === 0 ? 0 : recent.filter(isSuccess).length / recent.length;
  const lastAt = ordered.length > 0 ? ordered[ordered.length - 1].at : null;
  return {
    ...progress,
    status: statusOf(progress, ordered.length, accuracy, lastAt, context),
    attempts: ordered.length,
    accuracy,
    lastAt,
  };
}
