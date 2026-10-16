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
  synth.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = lang === "en-US" ? 0.85 : 0.95;
    const prefix = lang === "en-US" ? "en" : "ja";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (voice) utterance.voice = voice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      emit("kanoha-coach-speaking-end");
      resolve();
    };
    // ブラウザの speechSynthesis が onend を発火しないケースへの安全タイマー
    const maxWaitMs = Math.max(2500, text.length * 140);
    const safetyTimer = window.setTimeout(finish, maxWaitMs);
    utterance.onstart = () => emit("kanoha-coach-speaking-start");
    utterance.onend = () => {
      window.clearTimeout(safetyTimer);
      finish();
    };
    utterance.onerror = () => {
      window.clearTimeout(safetyTimer);
      finish();
    };
    synth.speak(utterance);
  });
}

/** かのはちゃんが英語のセリフを話す(Gemini TTS → だめならブラウザ読み上げ)。 */
export async function speakTalkEnglish(text: string, mood: Mood = "happy"): Promise<void> {
  if (typeof window === "undefined") return;
  emit("kanoha-coach-speaking-start");
  try {
    const played = await speakVoice(text, { mood, lang: "en" });
    if (!played) await speakWithBrowser(text, "en-US");
  } finally {
    emit("kanoha-coach-speaking-end");
  }
}

/** 英語が分からないときの日本語の聞きなおし(かのはちゃんの日本語ボイス)。 */
export async function speakTalkJapanese(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  emit("kanoha-coach-speaking-start");
  try {
    const played = await speakVoice(text, { mood: "think" });
    if (!played) await speakWithBrowser(text, "ja-JP");
  } finally {
    emit("kanoha-coach-speaking-end");
  }
}

export function stopTalkSpeech(): void {
  stopCoachVoice();
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
    emit("kanoha-coach-speaking-end");
  }
}
