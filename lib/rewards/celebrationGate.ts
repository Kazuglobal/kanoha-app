/**
 * お祝いモーダル(レベルアップ・5円ゲット)を出してよいかのゲート。
 * 問題を解いている途中はモーダルで集中を切らさないよう、学習フローが閉じておき、
 * 5問が終わった画面(またはページを離れたとき)に開ける。
 */
export const CELEBRATION_GATE_EVENT = "kanoha-celebration-gate";

let deferred = false;

export const areCelebrationsDeferred = (): boolean => deferred;

export function setCelebrationsDeferred(value: boolean): void {
  if (deferred === value) return;
  deferred = value;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<boolean>(CELEBRATION_GATE_EVENT, { detail: value }));
  }
}
