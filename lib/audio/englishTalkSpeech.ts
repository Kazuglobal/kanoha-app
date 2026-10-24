"use client";

import { preloadVoice, speakVoice, stopCoachVoice } from "./coachSpeech";

type Mood = "happy" | "celebrate" | "think";

const emit = (name: "kanoha-coach-speaking-start" | "kanoha-coach-speaking-end") => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(name));
  }
};

let talkSpeechGen = 0;

/** Gemini TTS が使えない端末向け: ブラウザの読み上げ(en-US / ja-JP)。口パクのイベントも出す。 */
function speakWithBrowser(text: string, lang: "en-US" | "ja-JP" = "en-US", gen = talkSpeechGen): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
  try {
    synth.cancel();
  } catch {
    // ignore cancel errors
  }
  return new Promise((resolve) => {
    if (gen !== talkSpeechGen) return resolve();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang === "en-US" ? 0.88 : 0.96;
    const prefix = lang === "en-US" ? "en" : "ja";
    const voices = synth.getVoices?.() ?? [];
    const voice = voices.find((v) => v.lang?.toLowerCase().startsWith(prefix));
    if (voice) utterance.voice = voice;

    let settled = false;
    let startedAt = 0;
    let pollTimer: number | null = null;
    let startCheckTimer: number | null = null;

    const cleanup = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      if (startCheckTimer !== null) {
        window.clearTimeout(startCheckTimer);
        startCheckTimer = null;
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (gen === talkSpeechGen) {
        emit("kanoha-coach-speaking-end");
      }
      resolve();
    };

    // ブラウザの speechSynthesis が onend を発火しないケースや音声エンジン未搭載環境への安全対策
    const maxWaitMs = Math.min(2800, Math.max(1200, text.length * 80));
    const safetyTimer = window.setTimeout(finish, maxWaitMs);

    // 600ms 経っても onstart も speaking も始まらない場合は即座に終了してマイクを解放する
    startCheckTimer = window.setTimeout(() => {
      if (!settled && startedAt === 0 && !synth.speaking && !synth.pending) {
        window.clearTimeout(safetyTimer);
        finish();
      }
    }, 600);

    utterance.onstart = () => {
      if (gen !== talkSpeechGen) {
        window.clearTimeout(safetyTimer);
        finish();
        return;
      }
      startedAt = Date.now();
      emit("kanoha-coach-speaking-start");
    };
    utterance.onend = () => {
      window.clearTimeout(safetyTimer);
      finish();
    };
    utterance.onerror = () => {
      window.clearTimeout(safetyTimer);
      finish();
    };

    // Windows Chrome 等で onend が発火しないバグ対策: speaking 状態を監視して話し終えたら即解放する
    pollTimer = window.setInterval(() => {
      if (settled) return;
      if (gen !== talkSpeechGen) {
        window.clearTimeout(safetyTimer);
        finish();
        return;
      }
      if (startedAt > 0 && !synth.speaking && !synth.pending && Date.now() - startedAt > 200) {
        window.clearTimeout(safetyTimer);
        finish();
      }
    }, 150);

    try {
      synth.speak(utterance);
    } catch {
      window.clearTimeout(safetyTimer);
      finish();
    }
  });
}

/** かのはちゃんが英語のセリフを話す(Gemini TTS → だめならブラウザ読み上げ)。 */
export async function speakTalkEnglish(text: string, mood: Mood = "happy"): Promise<void> {
  if (typeof window === "undefined") return;
  stopCoachVoice();
  talkSpeechGen += 1;
  const gen = talkSpeechGen;
  emit("kanoha-coach-speaking-start");
  try {
    const played = await speakVoice(text, { mood, lang: "en", silentFallback: true });
    if (gen !== talkSpeechGen) return;
    if (!played) await speakWithBrowser(text, "en-US", gen);
  } finally {
    if (gen === talkSpeechGen) {
      emit("kanoha-coach-speaking-end");
    }
  }
}

/** 英語が分からないときの日本語の聞きなおし(かのはちゃんの日本語ボイス)。 */
export async function speakTalkJapanese(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  stopCoachVoice();
  talkSpeechGen += 1;
  const gen = talkSpeechGen;
  emit("kanoha-coach-speaking-start");
  try {
    const played = await speakVoice(text, { mood: "think", silentFallback: true });
    if (gen !== talkSpeechGen) return;
    if (!played) await speakWithBrowser(text, "ja-JP", gen);
  } finally {
    if (gen === talkSpeechGen) {
      emit("kanoha-coach-speaking-end");
    }
  }
}

export function stopTalkSpeech(): void {
  talkSpeechGen += 1;
  stopCoachVoice();
  if (typeof window !== "undefined") {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    emit("kanoha-coach-speaking-end");
  }
}


/** シーン開始時に英語の質問セリフと褒め言葉をバックグラウンドで事前ロードし、再生遅延をゼロにする。 */
export function preloadTalkSceneSpeech(prompts: readonly string[]): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") return;
  for (const prompt of prompts) {
    preloadVoice(prompt, { mood: "happy", lang: "en" });
  }
  preloadVoice("Great job!", { mood: "celebrate", lang: "en" });
}
