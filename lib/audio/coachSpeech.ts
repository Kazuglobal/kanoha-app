"use client";

/**
 * かのはコーチ 音声再生マネージャー (Gemini TTS + Web Speech API ハイブリッド)
 * - Gemini API キー設定時: Gemini 2.0 Flash の高品質ネイティブオーディオをストリーミング再生
 * - 未設定・オフライン時: ブラウザの Web Speech API (キュートな日本語ピッチ) で即時再生
 * - 発話中は「リップシンク（口パク）」イベントを発行し、キャラクターが生き生きとお喋り！
 */

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
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
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
 * Web Speech API を用いた高速フォールバック音声
 */
function speakWithWebSpeech(text: string, mood: "happy" | "celebrate" | "think" = "happy"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[✦★✨💖♪]/g, ""); // 記号除去
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // 日本語の明るい可愛い声に設定
    utterance.lang = "ja-JP";
    utterance.pitch = mood === "celebrate" ? 1.35 : mood === "think" ? 1.15 : 1.25;
    utterance.rate = mood === "celebrate" ? 1.1 : 1.0;
    utterance.volume = 1.0;

    // 音声一覧から女性の日本語ボイスを優先選択
    const voices = window.speechSynthesis.getVoices();
    const jaVoice =
      voices.find((v) => v.lang === "ja-JP" && (v.name.includes("Kyoko") || v.name.includes("Nanami") || v.name.includes("Otoya") || v.name.includes("Natural") || v.name.includes("Female"))) ||
      voices.find((v) => v.lang === "ja-JP") ||
      null;
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
      resolve();
    };

    utterance.onerror = () => {
      setSpeaking(false);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * かのはちゃんの応援ボイスを再生するメイン関数
 */
export async function speakCoachVoice(
  text: string,
  mood: "happy" | "celebrate" | "think" = "happy"
): Promise<void> {
  stopCoachVoice();

  if (!text || typeof window === "undefined") return;

  // 1. まず Gemini TTS API エンドポイントを試行
  try {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mood }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audioDataUrl) {
        // Gemini TTS オーディオの再生
        return new Promise((resolve) => {
          const audio = new Audio(data.audioDataUrl);
          activeAudio = audio;

          audio.onplay = () => {
            setSpeaking(true);
          };

          audio.onended = () => {
            setSpeaking(false);
            activeAudio = null;
            resolve();
          };

          audio.onerror = () => {
            console.warn("[CoachVoice] Audio playback failed, falling back to Web Speech");
            activeAudio = null;
            speakWithWebSpeech(text, mood).then(resolve);
          };

          audio.play().catch((err) => {
            console.warn("[CoachVoice] Autoplay blocked, falling back to Web Speech:", err);
            speakWithWebSpeech(text, mood).then(resolve);
          });
        });
      }
    }
  } catch (err) {
    console.warn("[CoachVoice] Fetch error, using Web Speech fallback:", err);
  }

  // 2. Gemini TTS が未設定 / 失敗時は即座に Web Speech API で発声
  return speakWithWebSpeech(text, mood);
}
