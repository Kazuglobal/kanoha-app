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

    audio.onerror = (err) => {
      console.warn("[CoachVoice] Audio playback error:", err);
      setSpeaking(false);
      activeAudio = null;
      resolve();
    };

    audio.play().catch((err) => {
      console.warn("[CoachVoice] Audio autoplay prevented:", err);
      setSpeaking(false);
      activeAudio = null;
      resolve();
    });
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
