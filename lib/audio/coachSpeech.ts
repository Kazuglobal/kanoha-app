"use client";

/**
 * かのはコーチ 音声再生マネージャー (Gemini TTS 専用エンジン)
 * - Google Gemini TTS による自然で愛らしい小学2年生女の子ボイス (Aoede) で再生
 * - Web Speech API (機械的な合成音声) は使用せず、高品質な Gemini 音声を一貫して使用
 * - キャッシュ機能により、定型セリフや褒め言葉はゼロ遅延で即時再生
 * - 発話中は「リップシンク（口パク）」イベントを発行し、キャラクターが生き生きとお喋り！
 */

const ttsAudioCache = new Map<string, string>();

let activeAudio: HTMLAudioElement | null = null;
let isSpeakingState = false;

export function isCoachSpeaking(): boolean {
  return isSpeakingState;
}

export function stopCoachVoice(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  setSpeaking(false);
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

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioContext) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioContext = new AudioCtx();
    }
  }
  if (sharedAudioContext && sharedAudioContext.state === "suspended") {
    void sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

/**
 * Web Audio API を用いた音声データ再生（ブラウザの autoplay 制限を確実に突破するフォールバック）
 */
function playViaWebAudio(audioUrl: string): Promise<boolean> {
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
          try {
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            setSpeaking(true);
            source.onended = () => {
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
 */
function playAudio(audioUrl: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    audio.volume = 1.0;
    activeAudio = audio;

    audio.onplay = () => {
      setSpeaking(true);
    };

    audio.onended = () => {
      setSpeaking(false);
      activeAudio = null;
      resolve();
    };

    audio.onerror = async (err) => {
      console.warn("[CoachVoice] Audio playback error, trying WebAudio fallback:", err);
      activeAudio = null;
      const fallbackSuccess = await playViaWebAudio(audioUrl);
      if (!fallbackSuccess) setSpeaking(false);
      resolve();
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(async (err) => {
        console.warn("[CoachVoice] Audio autoplay prevented, trying WebAudio fallback:", err);
        activeAudio = null;
        const fallbackSuccess = await playViaWebAudio(audioUrl);
        if (!fallbackSuccess) setSpeaking(false);
        resolve();
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
  stopCoachVoice();

  if (!text || typeof window === "undefined") return;

  const cacheKey = `${mood}:${text}`;
  const cachedUrl = ttsAudioCache.get(cacheKey);
  if (cachedUrl) {
    return playAudio(cachedUrl);
  }

  try {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mood, voiceName: "Aoede" }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audioDataUrl) {
        ttsAudioCache.set(cacheKey, data.audioDataUrl);
        return playAudio(data.audioDataUrl);
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
  setSpeaking(true);
  setTimeout(() => {
    setSpeaking(false);
  }, 1200);
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
