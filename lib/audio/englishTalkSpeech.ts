"use client";

import { speakVoice, stopCoachVoice } from "./coachSpeech";

type Mood = "happy" | "celebrate" | "think";

const emit = (name: "kanoha-coach-speaking-start" | "kanoha-coach-speaking-end") => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(name));
  }
};

/** Gemini TTS が使えない端末向け: ブラウザの読み上げ(en-US / ja-JP)。口パクのイベントも出す。 */
function speakWithBrowser(text: string, lang: "en-US" | "ja-JP" = "en-US"): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
  try {
    synth.cancel();
  } catch {
    // ignore cancel errors
  }
  return new Promise((resolve) => {
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

    const cleanup = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      emit("kanoha-coach-speaking-end");
      resolve();
    };

    // ブラウザの speechSynthesis が onend を発火しないケースや音声エンジン未搭載環境への安全対策
    const maxWaitMs = Math.min(3400, Math.max(1500, text.length * 90));
    const safetyTimer = window.setTimeout(finish, maxWaitMs);

    utterance.onstart = () => {
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
      if (startedAt > 0 && !synth.speaking && !synth.pending && Date.now() - startedAt > 250) {
        window.clearTimeout(safetyTimer);
        finish();
      }
    }, 180);

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
  emit("kanoha-coach-speaking-start");
  try {
    const played = await speakVoice(text, { mood, lang: "en", silentFallback: true });
    if (!played) await speakWithBrowser(text, "en-US");
  } finally {
    emit("kanoha-coach-speaking-end");
  }
}

/** 英語が分からないときの日本語の聞きなおし(かのはちゃんの日本語ボイス)。 */
export async function speakTalkJapanese(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  stopCoachVoice();
  emit("kanoha-coach-speaking-start");
  try {
    const played = await speakVoice(text, { mood: "think", silentFallback: true });
    if (!played) await speakWithBrowser(text, "ja-JP");
  } finally {
    emit("kanoha-coach-speaking-end");
  }
}

export function stopTalkSpeech(): void {
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
