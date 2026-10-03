"use client";

/**
 * かのはコーチ 音声再生マネージャー (Gemini TTS + Web Speech API ハイブリッド)
 * - Gemini API キー設定時: Gemini 2.0 Flash の高品質ネイティブオーディオをストリーミング再生
 * - 未設定・オフライン時: ブラウザの Web Speech API (キュートな日本語ピッチ) で即時再生
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
 * オーディオ要素を再生する共通ヘルパー
 */
function playAudio(audioUrl: string, text: string, mood: "happy" | "celebrate" | "think"): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
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

/**
 * Web Speech API を用いた高速フォールバック音声（より自然で可愛い女の子のトーンに調整）
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

    // 小学2年生の女の子「かのはちゃん」に合わせた愛らしいトーン
    utterance.lang = "ja-JP";
    utterance.pitch = mood === "celebrate" ? 1.4 : mood === "think" ? 1.2 : 1.32;
    utterance.rate = mood === "celebrate" ? 1.08 : 1.02;
    utterance.volume = 1.0;

    // 音声一覧から女性の自然な日本語ボイスを優先選択
    const voices = window.speechSynthesis.getVoices();
    const jaVoice =
      voices.find((v) => v.lang.startsWith("ja") && (v.name.includes("Nanami") || v.name.includes("Google 日本語") || v.name.includes("Kyoko") || v.name.includes("Natural") || v.name.includes("Otoya") || v.name.includes("Ayumi") || v.name.includes("Female") || v.name.includes("Siri"))) ||
      voices.find((v) => v.lang.startsWith("ja")) ||
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

  const cacheKey = `${mood}:${text}`;

  // 1. キャッシュ済みの Gemini 音声があれば即座に無遅延＆APIコスト0で再生
  const cachedUrl = ttsAudioCache.get(cacheKey);
  if (cachedUrl) {
    return playAudio(cachedUrl, text, mood);
  }

  // 2. Gemini TTS API エンドポイントを試行（女の子の明るく澄んだ少女声 "Aoede" を指定）
  try {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mood, voiceName: "Aoede" }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audioDataUrl) {
        // キャッシュに保存（次回以降は即時再生）
        ttsAudioCache.set(cacheKey, data.audioDataUrl);
        return playAudio(data.audioDataUrl, text, mood);
      }
    }
  } catch (err) {
    console.warn("[CoachVoice] Fetch error, using Web Speech fallback:", err);
  }

  // 3. Gemini TTS が未設定 / 失敗時はチューニング済み Web Speech API で発声
  return speakWithWebSpeech(text, mood);
}

