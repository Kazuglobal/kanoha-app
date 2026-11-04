import { talkStars, type TalkOutcome } from "./score";

/**
 * 英会話れんしゅうの進行(純粋関数)。
 * ask → 正解なら correct / まちがえたら teach(正しい言い方を REPEAT_TARGET 回まねする)→ correct → 次へ。
 * まちがえた質問は、シーンの最後にもう1回だけ出す。
 * ヘルプ(日本語・4択)を使ったターンは helped に残し、★の計算(clean / help / teach)に使う。
 */

export const REPEAT_TARGET = 2;

/** まねして言うが、続けてこの回数 合わなかったら、「いえたよ！」でも進められるようにする(行き止まりにしない)。 */
export const SELF_REPORT_AFTER_MISSES = 2;

export type TalkPhase = "ask" | "teach" | "correct" | "done";

export interface TalkState {
  readonly queue: readonly string[];
  /** 場面のターン ID(出す順)。キューは進むと減るので、結果をまとめるために残す */
  readonly order: readonly string[];
  readonly phase: TalkPhase;
  readonly repeatCount: number;
  readonly total: number;
  readonly firstTryCorrect: readonly string[];
  readonly missed: readonly string[];
  readonly helped: readonly string[];
  readonly retried: readonly string[];
  readonly isRetry: boolean;
}

export const startTalk = (turnIds: readonly string[]): TalkState => ({
  queue: [...turnIds],
  order: [...turnIds],
  phase: turnIds.length > 0 ? "ask" : "done",
  repeatCount: 0,
  total: turnIds.length,
  firstTryCorrect: [],
  missed: [],
  helped: [],
  retried: [],
  isRetry: false,
});

export const currentTurnId = (state: TalkState): string | undefined => state.queue[0];

export const answerTalk = (state: TalkState, correct: boolean): TalkState => {
  const id = currentTurnId(state);
  if (state.phase !== "ask" || !id) return state;
  if (correct) {
    const firstTry = !state.isRetry && !state.missed.includes(id);
    return {
      ...state,
      phase: "correct",
      firstTryCorrect: firstTry ? [...state.firstTryCorrect, id] : state.firstTryCorrect,
    };
  }
  return {
    ...state,
    phase: "teach",
    repeatCount: 0,
    missed: state.missed.includes(id) ? state.missed : [...state.missed, id],
  };
};

export const repeatTalk = (state: TalkState, ok: boolean): TalkState => {
  if (state.phase !== "teach" || !ok) return state;
  const repeatCount = state.repeatCount + 1;
  return { ...state, repeatCount, phase: repeatCount >= REPEAT_TARGET ? "correct" : "teach" };
};

export const nextTalk = (state: TalkState): TalkState => {
  const id = currentTurnId(state);
  if (state.phase !== "correct" || !id) return state;
  const shouldRetry = state.missed.includes(id) && !state.retried.includes(id);
  const rest = state.queue.slice(1);
  const queue = shouldRetry ? [...rest, id] : rest;
  const retried = shouldRetry ? [...state.retried, id] : state.retried;
  const nextId = queue[0];
  return {
    ...state,
    queue,
    retried,
    repeatCount: 0,
    phase: nextId ? "ask" : "done",
    isRetry: Boolean(nextId && retried.includes(nextId)),
  };
};

/** ヘルプ(日本語・4択)を使ったことを、いまのターンに記録する(答えるまえのときだけ。同じターンは1回)。 */
export const markHelp = (state: TalkState): TalkState => {
  const id = currentTurnId(state);
  if (state.phase !== "ask" || !id || state.helped.includes(id)) return state;
  return { ...state, helped: [...state.helped, id] };
};

export const talkScore = (state: TalkState) => ({
  firstTry: state.firstTryCorrect.length,
  total: state.total,
});

/** ターンごとの結果。まちがえて おてほんを見た → teach、ヘルプを使った → help、それ以外 → clean。 */
export const talkOutcomes = (state: TalkState): readonly { turnId: string; outcome: TalkOutcome }[] =>
  state.order.map((turnId) => ({
    turnId,
    outcome: state.missed.includes(turnId) ? "teach" : state.helped.includes(turnId) ? "help" : "clean",
  }));

export const talkStarsOf = (state: TalkState): 1 | 2 | 3 =>
  talkStars(talkOutcomes(state).map(({ outcome }) => outcome));
