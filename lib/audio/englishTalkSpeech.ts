"use client";

import { speakVoice, stopCoachVoice } from "./coachSpeech";

type Mood = "happy" | "celebrate" | "think";

const emit = (name: "kanoha-coach-speaking-start" | "kanoha-coach-speaking-end") => {
  window.dispatchEvent(new CustomEvent(name));
};

/** Gemini TTS が使えない端末向け: ブラウザの読み上げ(en-US)。口パクのイベントも出す。 */
function speakWithBrowser(text: string): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
  synth.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.8;
    const voice = synth.getVoices().find(({ lang }) => lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    const finish = () => {
      emit("kanoha-coach-speaking-end");
      resolve();
    };
    utterance.onstart = () => emit("kanoha-coach-speaking-start");
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  });
}

/** かのはちゃんが英語のセリフを話す(Gemini TTS → だめならブラウザ読み上げ)。 */
export async function speakTalkEnglish(text: string, mood: Mood = "happy"): Promise<void> {
  if (typeof window === "undefined") return;
  const played = await speakVoice(text, { mood, lang: "en" });
  if (!played) await speakWithBrowser(text);
}

/** 英語が分からないときの日本語の聞きなおし(かのはちゃんの日本語ボイス)。 */
export async function speakTalkJapanese(text: string): Promise<void> {
  if (typeof window === "undefined") return;
  await speakVoice(text, { mood: "think" });
}

export function stopTalkSpeech(): void {
  stopCoachVoice();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
