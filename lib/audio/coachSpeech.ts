"use client";

/**
 * かのはコーチ 音声再生マネージャー (Gemini TTS 専用エンジン)
 * - Google Gemini TTS による自然で愛らしい小学2年生女の子ボイス (Aoede) で再生
 * - Web Speech API (機械的な合成音声) は使用せず、高品質な Gemini 音声を一貫して使用
 * - キャッシュ機能により、定型セリフや褒め言葉はゼロ遅延で即時再生
 * - 発話中は「リップシンク（口パク）」イベントを発行し、キャラクターが生き生きとお喋り！
 */

import { getSharedAudioContext, installAudioUnlock } from "./audioUnlock";

installAudioUnlock();

const ttsAudioCache = new Map<string, string>();

let activeAudio: HTMLAudioElement | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let isSpeakingState = false;
/** 再生リクエストの世代番号。新しい発話や停止で進み、古い発話は鳴らさない */
let playbackToken = 0;
/** 再生中の発話を待っている呼び出し元(止めたときも待ちを解く) */
let settlePending: (() => void) | null = null;

export function isCoachSpeaking(): boolean {
  return isSpeakingState;
}

export function stopCoachVoice(): void {
  playbackToken += 1;
  if (activeAudio) {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeSource) {
    activeSource.onended = null;
    try {
      activeSource.stop();
    } catch {
      // already stopped
    }
    activeSource = null;
  }
  const settle = settlePending;
  settlePending = null;
  settle?.();
  setSpeaking(false);
}

function isCurrent(token: number): boolean {
  return token === playbackToken;
}

function setSpeaking(speaking: boolean) {
  isSpeakingState = speaking;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(speaking ? "kanoha-coach-speaking-start" : "kanoha-coach-speaking-end")
    );
  }
}

/**
 * 定番の褒め言葉・称賛フレーズ（ランダムに選ばれ、子どものやる気を引き出します）
 */
export const PRAISE_PHRASES = [
  "やったね！大正解！すごいっ！",
  "大正解！そのちょうしだよ！",
  "やったぁ！よくできたね！すごいっ！",
  "すごいすごい！大正解！",
  "ばっちり正解！かっこいい！",
] as const;

/**
 * 優しい励ましフレーズ（間違えても安心させる声かけ）
 */
export const ENCOURAGE_PHRASES = [
  "おしい！もういっかい かんがえてみよう！",
  "だいじょうぶ！ゆっくり かんがえてみてね！",
  "あきらめないで、もういちど チャレンジしよう！",
] as const;

/**
 * Web Audio API を用いた音声データ再生（ブラウザの autoplay 制限を確実に突破するフォールバック）
 */
function playViaWebAudio(audioUrl: string, token: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return resolve(false);

      const base64Index = audioUrl.indexOf(";base64,");
      if (base64Index === -1) return resolve(false);
      const base64 = audioUrl.slice(base64Index + 8);
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      ctx.decodeAudioData(
        bytes.buffer.slice(0),
        (audioBuffer) => {
          // デコード中に別の発話・停止があれば鳴らさない
          if (!isCurrent(token)) return resolve(true);
          try {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            activeSource = source;

            setSpeaking(true);
            source.onended = () => {
              if (activeSource === source) activeSource = null;
              setSpeaking(false);
              resolve(true);
            };
            source.start(0);
          } catch {
            setSpeaking(false);
            resolve(false);
          }
        },
        () => {
          setSpeaking(false);
          resolve(false);
        }
      );
    } catch {
      setSpeaking(false);
      resolve(false);
    }
  });
}

/**
 * オーディオ要素を再生する共通ヘルパー
 * - play() の reject と onerror は両方発火しうるので、フォールバックは1回だけ実行する
 */
function playAudio(audioUrl: string, token: number): Promise<void> {
  return new Promise((done) => {
    if (!isCurrent(token)) return done();
    const resolve = () => {
      if (settlePending === resolve) settlePending = null;
      done();
    };
    settlePending = resolve;
    const audio = new Audio(audioUrl);
    audio.volume = 1.0;
    activeAudio = audio;
    let fellBack = false;

    const fallBack = async () => {
      if (fellBack) return;
      fellBack = true;
      audio.onended = null;
      audio.onerror = null;
      if (activeAudio === audio) activeAudio = null;
      const ok = isCurrent(token) && (await playViaWebAudio(audioUrl, token));
      if (!ok && isCurrent(token)) setSpeaking(false);
      resolve();
    };

    audio.onplay = () => {
      setSpeaking(true);
    };

    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      setSpeaking(false);
      resolve();
    };

    audio.onerror = () => {
      console.warn("[CoachVoice] Audio playback error, trying WebAudio fallback");
      void fallBack();
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        console.warn("[CoachVoice] Audio autoplay prevented, trying WebAudio fallback");
        void fallBack();
      });
    } else {
      resolve();
    }
  });
}

/**
 * かのはちゃんの応援ボイスを Gemini TTS で再生するメイン関数
 * ※ 機械音声（Web Speech API）は使用せず、Gemini TTS の高品質ボイスのみを使用します。
 */
export async function speakCoachVoice(
  text: string,
  mood: "happy" | "celebrate" | "think" = "happy"
): Promise<void> {
  await speakVoice(text, { mood });
}

/**
 * Gemini TTS で再生し、鳴らせたかどうかを返す(英会話れんしゅうは lang: "en")。
 * false のときは呼び出し側がブラウザの読み上げなどにフォールバックできる。
 */
export async function speakVoice(
  text: string,
  { mood = "happy", lang = "ja" }: { mood?: "happy" | "celebrate" | "think"; lang?: "ja" | "en" } = {}
): Promise<boolean> {
  stopCoachVoice();
  const token = playbackToken;

  if (!text || typeof window === "undefined") return false;

  const cacheKey = lang === "ja" ? `${mood}:${text}` : `${lang}:${mood}:${text}`;
  const cachedUrl = ttsAudioCache.get(cacheKey);
  if (cachedUrl) {
    await playAudio(cachedUrl, token);
    return true;
  }

  try {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        lang === "ja" ? { text, mood, voiceName: "Aoede" } : { text, mood, voiceName: "Aoede", lang }
      ),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audioDataUrl) {
        ttsAudioCache.set(cacheKey, data.audioDataUrl);
        // 取得を待つ間に別の発話・停止があれば、古い音声は鳴らさない
        await playAudio(data.audioDataUrl, token);
        return true;
      }
      console.warn("[CoachVoice] TTS API returned non-success:", data.error);
    } else {
      console.warn("[CoachVoice] TTS endpoint HTTP status:", res.status);
    }
  } catch (err) {
    console.warn("[CoachVoice] TTS fetch failed:", err);
  }

  // 音声通信が万一不通の場合でも、ロボット機械音声は鳴らさず、
  // リップシンク（口パクアニメーション）のみを短時間自然に行います
  if (!isCurrent(token)) return false;
  setSpeaking(true);
  setTimeout(() => {
    if (isCurrent(token)) setSpeaking(false);
  }, 1200);
  return false;
}

/**
 * 正解時に「やったね！大正解！すごいっ！」などの温かい称賛ボイスを即時再生
 */
export async function playPraiseVoice(customPhrase?: string): Promise<string> {
  const phrase =
    customPhrase ?? PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("kanoha-coach-praise", {
        detail: { message: phrase, mood: "celebrate" },
      })
    );
  }
  await speakCoachVoice(phrase, "celebrate");
  return phrase;
}

/**
 * 不正解時に「おしい！もういっかい かんがえてみよう！」などの励ましボイスを再生
 */
export async function playEncourageVoice(customPhrase?: string): Promise<string> {
  const phrase =
    customPhrase ?? ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)];
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("kanoha-coach-praise", {
        detail: { message: phrase, mood: "think" },
      })
    );
  }
  await speakCoachVoice(phrase, "think");
  return phrase;
}

/**
 * 学習開始時に主要な称賛・励ましボイスをバックグラウンドで事前ロード（正解時に0ms即時再生）
 */
export function preloadCoachVoices(phrases?: readonly string[]): void {
  if (typeof window === "undefined") return;
  if (!phrases && process.env.NODE_ENV === "test") return;
  const targetPhrases = phrases ?? [PRAISE_PHRASES[0], PRAISE_PHRASES[1], ENCOURAGE_PHRASES[0]];
  for (const text of targetPhrases) {
    const mood = text.includes("おしい") || text.includes("だいじょうぶ") ? "think" : "celebrate";
    const cacheKey = `${mood}:${text}`;
    if (!ttsAudioCache.has(cacheKey)) {
      fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mood, voiceName: "Aoede" }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data.audioDataUrl) {
            ttsAudioCache.set(cacheKey, data.audioDataUrl);
          }
        })
        .catch(() => {
          // ignore preload failures
        });
    }
  }
}
