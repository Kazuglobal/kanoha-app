"use client";

/**
 * モバイル(iOS Safari / Android Chrome)の自動再生制限を解除する共有オーディオ基盤。
 * - AudioContext は1つだけ作り、最初のタップ/タッチ(ユーザー操作の最中)で resume + 無音再生して解錠する
 * - 声は fetch 待ちのあとに鳴らすため、操作の外で new Audio().play() すると iOS では拒否される。
 <audio> 要素と AudioContext を使い回すことで、あとから鳴らしても聞こえる
 * - iOS のマナーモード(消音スイッチ)でも鳴るよう audioSession を "playback" にする
 */

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let sharedContext: AudioContext | null = null;
let installed = false;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedContext = new AudioCtx();
    sharedContext.onstatechange = () => {
      // iOS は電話や別アプリ復帰で "interrupted" になるので、戻ったら再開する
      if ((sharedContext?.state as string) === "interrupted") void sharedContext?.resume();
    };
  }
  if (sharedContext.state !== "running") {
    void sharedContext.resume().catch(() => undefined);
  }
  return sharedContext;
}

function setPlaybackSession() {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session) session.type = "playback";
  } catch {
    // 未対応ブラウザは無視
  }
}

function unlock() {
  setPlaybackSession();
  const ctx = getSharedAudioContext();
  if (ctx) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // 解錠できなくても次の操作で再試行する
    }
  }
}

/** 最初のユーザー操作でオーディオを解錠するリスナーを1回だけ登録する */
export function installAudioUnlock(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const events = ["touchstart", "touchend", "pointerdown", "click", "keydown"] as const;
  const handler = () => {
    unlock();
    // 実際に running になるまでは外さず、次の操作でも再試行する
    if (sharedContext?.state === "running") {
      for (const name of events) window.removeEventListener(name, handler, true);
    }
  };
  for (const name of events) window.addEventListener(name, handler, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && sharedContext && sharedContext.state !== "running") {
      void sharedContext.resume().catch(() => undefined);
    }
  });
}
