import { z } from "zod";

/**
 * 学習の途中経過を sessionStorage に保存・復元する(W6)。
 * - タブを閉じれば消える(答え・ヒント本文・個人情報は保存しない)。
 * - 類題は id / 問題文 / 選択肢だけを持つ(正解はサーバーが判定する。D2)。
 */

const storedSimilarSchema = z.object({
  id: z.string().min(1),
  question: z.string(),
  choices: z.array(z.string()).nullable(),
  listenText: z.string().max(200).optional(),
});

const progressSchema = z.object({
  sessionId: z.string().min(1),
  problemId: z.string().min(1),
  practiceIndex: z.number().int().min(0).nullable(),
  score: z.number().int().min(0),
  revealedCount: z.number().int().min(0).max(4),
  similar: z.array(storedSimilarSchema).nullable(),
});

export type StoredSimilarProblem = z.infer<typeof storedSimilarSchema>;
export type LearningProgress = z.infer<typeof progressSchema>;

const keyFor = (problemId: string) => `kanoha:progress:${problemId}`;

/** JSON 文字列を検証して LearningProgress にする純粋関数。壊れていたら null。 */
export function parseProgress(raw: string | null, problemId: string): LearningProgress | null {
  if (!raw) return null;
  try {
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.problemId !== problemId) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** 保存済みの途中経過を読む。無い・壊れている・storage 不可のときは null。 */
export function readProgress(problemId: string): LearningProgress | null {
  try {
    return parseProgress(storage()?.getItem(keyFor(problemId)) ?? null, problemId);
  } catch {
    return null;
  }
}

/** 途中経過を保存する。容量超過などの失敗は握りつぶす(学習は続行できる)。 */
export function writeProgress(progress: LearningProgress): void {
  try {
    storage()?.setItem(keyFor(progress.problemId), JSON.stringify(progress));
  } catch {
    // 保存できなくても学習は続けられる。
  }
}

/** 学習が終わったら途中経過を消す。 */
export function clearProgress(problemId: string): void {
  try {
    storage()?.removeItem(keyFor(problemId));
  } catch {
    // 消せなくても次回の parse で problemId 不一致・上書きにより無害。
  }
}
