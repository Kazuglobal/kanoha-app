import { normalizeSpokenEnglish } from "@/lib/englishTalk/judge";

/** ブラウザの Web Speech API(SpeechRecognition)のうち、マイク部品が使う部分の型。 */

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

export interface SpeechRecognitionResultItem extends ArrayLike<SpeechRecognitionAlternative> {
  isFinal?: boolean;
}

export interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultItem>;
}

export type RealtimeSpeechRecognitionConstructor = new () => {
  lang: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop?: () => void;
  abort?: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

/**
 * まだ文の途中で後ろに単語が続く可能性が高いプレフィックス。
 * これだけの段階で isFinal になっても即座にマイクを切らず、少し待って続きの言葉を待つ。
 */
const INCOMPLETE_PREFIXES = new Set([
  "hello",
  "hi",
  "hey",
  "my",
  "my name",
  "my name is",
  "name",
  "name is",
  "i",
  "im",
  "i am",
  "im a",
  "i am a",
  "it",
  "its",
  "it is",
  "its a",
  "its an",
  "it is a",
  "it is an",
  "this",
  "this is",
  "this is a",
  "i like",
  "i want",
  "yes i",
  "no i",
]);

export function isIncompleteUtterance(rawText: string): boolean {
  const norm = normalizeSpokenEnglish(rawText);
  if (!norm) return true;
  return INCOMPLETE_PREFIXES.has(norm);
}

/** 録音をサーバーで文字にできないときの案内(ボタンで答えられる) */
export const SERVER_STT_UNAVAILABLE_HINT = "マイクが つかえないよ。ボタンで こたえてね";

/** マイクの使用がゆるされていないときの案内(おとなに頼む) */
export const MIC_PERMISSION_HINT = "マイクが つかえないよ。おうちの ひとに マイクを ゆるして もらってね。ボタンでも こたえられるよ";

/** 録音をサーバーで文字にしているあいだ、画面に出す言葉 */
export const LISTENING_TRANSCRIPT = "こえを ききとっています...";

/** 録音(VAD)の時間の上限: 誰も話さない待ち時間 / 1回の発話の長さ(ミリ秒) */
export const MAX_SILENT_WAIT_MS = 10_000;
export const MAX_UTTERANCE_MS = 15_000;
