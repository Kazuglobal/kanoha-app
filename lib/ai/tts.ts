/**
 * Gemini TTS (Multimodal Audio Output) 連携モジュール
 * Google Gemini 2.0 Flash のネイティブ音声出力 (AUDIO モダリティ) を使用して、
 * 「かのはちゃん」の温かく愛らしい応援ボイスを生成します。
 */

export interface GeminiTtsOptions {
  text: string;
  mood?: "happy" | "celebrate" | "think";
  voiceName?: "Aoede" | "Kore" | "Puck" | "Fenrir" | "Charon";
  /** en は英会話れんしゅう用(ゆっくり・はっきりした英語で読む) */
  lang?: "ja" | "en";
}

export interface GeminiTtsResult {
  success: boolean;
  audioDataUrl?: string;
  error?: string;
  fallback?: boolean;
}

/**
 * 16-bit PCM バイト列の音圧を安全にブースト（ピーク正規化）するヘルパー
 * Google Gemini API の native audio は会話基準（約 -18 dBFS）で合成されるため、
 * スマホやタブレット、ノートPC等の小型スピーカーでもハッキリ聞こえるよう音量を最適化します。
 */
export function boostPcmVolume(
  pcmBuffer: Buffer,
  targetPeak: number = 28000,
  maxGain: number = 2.5
): Buffer {
  if (pcmBuffer.length < 2) return pcmBuffer;

  const sampleCount = Math.floor(pcmBuffer.length / 2);
  let maxSample = 0;

  // 1. 最大絶対値（ピーク値）を検出
  for (let i = 0; i < sampleCount; i++) {
    const val = Math.abs(pcmBuffer.readInt16LE(i * 2));
    if (val > maxSample) {
      maxSample = val;
    }
  }

  if (maxSample === 0) return pcmBuffer;

  // 2. 最適なゲインを計算（目標ピーク / 最大値、ただし最大増幅率 maxGain でクランプ）
  let gain = targetPeak / maxSample;
  if (gain > maxGain) gain = maxGain;
  if (gain < 1.0) gain = 1.0;

  // 既に十分な音圧がある場合はそのまま返す
  if (gain <= 1.05) return pcmBuffer;

  const boostedBuffer = Buffer.alloc(pcmBuffer.length);

  // 3. 各サンプルにゲインを適用し、クリッピング（-32768〜32767）を防止
  for (let i = 0; i < sampleCount; i++) {
    const rawVal = pcmBuffer.readInt16LE(i * 2);
    let newVal = Math.round(rawVal * gain);
    if (newVal > 32767) newVal = 32767;
    else if (newVal < -32768) newVal = -32768;
    boostedBuffer.writeInt16LE(newVal, i * 2);
  }

  // 奇数バイトの余りがあれば末尾をコピー
  if (pcmBuffer.length % 2 !== 0) {
    boostedBuffer[pcmBuffer.length - 1] = pcmBuffer[pcmBuffer.length - 1];
  }

  return boostedBuffer;
}

/**
 * WAV または PCM バイト列の音声データをブーストするヘルパー
 */
export function boostWavOrPcm(
  buffer: Buffer,
  targetPeak: number = 28000,
  maxGain: number = 2.5
): Buffer {
  if (
    buffer.length > 44 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === "data") {
        const pcmStart = offset + 8;
        const pcmEnd = Math.min(pcmStart + chunkSize, buffer.length);
        const pcmSlice = buffer.subarray(pcmStart, pcmEnd);
        const boosted = boostPcmVolume(Buffer.from(pcmSlice), targetPeak, maxGain);
        const result = Buffer.alloc(buffer.length);
        buffer.copy(result, 0, 0, pcmStart);
        boosted.copy(result, pcmStart);
        if (pcmEnd < buffer.length) {
          buffer.copy(result, pcmEnd, pcmEnd);
        }
        return result;
      }
      offset += 8 + chunkSize;
    }
  }

  return boostPcmVolume(buffer, targetPeak, maxGain);
}

/**
 * 16-bit PCM バイト列に標準 44バイトの RIFF WAV ヘッダーを付与するヘルパー
 * Gemini の audio/pcm;rate=24000 形式をブラウザの <audio> で直接再生可能にします。
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataLen = pcmBuffer.length;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  // RIFF チャンク
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write("WAVE", 8);

  // fmt サブチャンク
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // サブチャンクサイズ
  header.writeUInt16LE(1, 20); // フォーマット (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data サブチャンク
  header.write("data", 36);
  header.writeUInt32LE(dataLen, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/** 英会話れんしゅうの英語セリフ用の読み上げ指示(7さいの日本の子どもが聞き取りやすい英語)。 */
function buildEnglishInstruction(mood: GeminiTtsOptions["mood"]): string {
  const tone =
    mood === "celebrate"
      ? "Sound very happy and proud of the child."
      : mood === "think"
      ? "Sound gentle and reassuring."
      : "Sound warm, cheerful and friendly.";
  return [
    "You are Kanoha, a cheerful English conversation partner for a 7-year-old Japanese child.",
    "Read the provided text slowly and clearly in natural American English, with short pauses between words.",
    "Speak loudly enough for a small tablet speaker.",
    "CRITICAL: Do NOT read aloud any instructions, prompts, prefixes or explanations.",
    "Speak ONLY the exact text provided by the user, with no extra words.",
    tone,
  ].join(" ");
}

export async function generateGeminiSpeech({
  text,
  mood = "happy",
  voiceName = "Aoede",
  lang = "ja",
}: GeminiTtsOptions): Promise<GeminiTtsResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      fallback: true,
      error: "GEMINI_API_KEY is not configured",
    };
  }

  // 声のトーンやキャラクター指示（温かく可愛い小学生の学習コーチ）
  const moodPrompt =
    mood === "celebrate"
      ? "大正解を思いっきり喜んで、元気いっぱいに飛び跳ねるように褒めてあげてください。明るく大きな声ではっきりと発声してください。"
      : mood === "think"
      ? "優しく安心させるように、ゆっくり丁寧に語りかけてあげてください。子どもの耳にはっきりと届く声量で発声してください。"
      : "明るく親しみやすく、笑顔でいっしょに頑張ろうと励ましてください。元気いっぱいに、はっきりと聞き取りやすい声量で発声してください。";

  const systemInstruction =
    lang === "en"
      ? buildEnglishInstruction(mood)
      : `あなたは小学生の自立学習を応援する愛されマスコット「かのは」です。
子どもが安心できるよう、温かく可愛らしい小学2年生の女の子の声で、以下のセリフだけを元気にハキハキと読み上げてください。
タブレットやスマホのスピーカーでも子どもの耳にはっきりと届くよう、大きめのしっかりした声量で発声してください。
【最重要ルール】
・指示文、システムプロンプト、前置き、相槌、説明、挨拶（「はい」「かしこまりました」等）は一切声に出さないでください。
・ユーザーから渡されたセリフそのものだけを一言一句違わず発声してください。
【演出指示】: ${moodPrompt}`;

  const candidateModels = Array.from(
    new Set(
      [
        process.env.GEMINI_TTS_MODEL,
        "gemini-3.8-flash-tts",
        "gemini-3.8-flash-lite-tts",
        "gemini-3.8-flash",
      ].filter((m): m is string => Boolean(m))
    )
  );

  let lastError = "No models attempted";

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: systemInstruction,
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName, // Aoede: 優しく澄んだ女性声
                  },
                },
              },
            },
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Gemini TTS] Model ${model} returned ${response.status}: ${errText}`);
        lastError = `Gemini API (${model}) returned ${response.status}: ${errText}`;
        continue;
      }

      const data = await response.json();
      const candidatePart = data.candidates?.[0]?.content?.parts?.[0];
      const inlineAudio = candidatePart?.inlineData;

      if (!inlineAudio || !inlineAudio.data) {
        console.warn(`[Gemini TTS] Model ${model} returned no audio data`);
        lastError = `No audio data in response from ${model}`;
        continue;
      }

      const mimeType = inlineAudio.mimeType || "audio/wav";
      const rawBuffer = Buffer.from(inlineAudio.data, "base64");

      // PCM 形式の場合は音圧ブーストを行ってから WAV ヘッダーを付与してブラウザで即再生可能にする
      if (mimeType.includes("pcm")) {
        let rate = 24000;
        const rateMatch = mimeType.match(/rate=(\d+)/);
        if (rateMatch) {
          rate = parseInt(rateMatch[1], 10);
        }
        const boostedPcm = boostPcmVolume(rawBuffer);
        const wavBuffer = pcmToWav(boostedPcm, rate);
        return {
          success: true,
          audioDataUrl: `data:audio/wav;base64,${wavBuffer.toString("base64")}`,
        };
      }

      // 既に wav や mp3 の場合
      const finalBuffer = mimeType.includes("wav") ? boostWavOrPcm(rawBuffer) : rawBuffer;
      return {
        success: true,
        audioDataUrl: `data:${mimeType};base64,${finalBuffer.toString("base64")}`,
      };
    } catch (err) {
      console.warn(`[Gemini TTS] Model ${model} fetch failed:`, err);
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    fallback: true,
    error: lastError,
  };
}
