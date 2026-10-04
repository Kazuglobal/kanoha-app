/**
 * Gemini TTS (Multimodal Audio Output) 連携モジュール
 * Google Gemini 2.0 Flash のネイティブ音声出力 (AUDIO モダリティ) を使用して、
 * 「かのはちゃん」の温かく愛らしい応援ボイスを生成します。
 */

export interface GeminiTtsOptions {
  text: string;
  mood?: "happy" | "celebrate" | "think";
  voiceName?: "Aoede" | "Kore" | "Puck" | "Fenrir" | "Charon";
}

export interface GeminiTtsResult {
  success: boolean;
  audioDataUrl?: string;
  error?: string;
  fallback?: boolean;
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

export async function generateGeminiSpeech({
  text,
  mood = "happy",
  voiceName = "Aoede",
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
      ? "大正解を思いっきり喜んで、元気いっぱいに飛び跳ねるように褒めてあげてください。"
      : mood === "think"
      ? "優しく安心させるように、ゆっくり優しく語りかけてあげてください。"
      : "明るく親しみやすく、笑顔でいっしょに頑張ろうと励ましてください。";

  const systemInstruction = `あなたは小学生の自立学習を応援する愛されマスコット「かのは」です。
子どもが安心できるよう、温かく可愛らしい声で、以下のセリフだけをそのまま元気に読み上げてください。
余計な前置きや説明は一切含めず、セリフのみを発声してください。
【演出指示】: ${moodPrompt}`;

  const candidateModels = Array.from(
    new Set(
      [
        process.env.GEMINI_TTS_MODEL,
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-flash",
        "gemini-2.0-flash-exp",
        "gemini-2.0-flash",
      ].filter((m): m is string => Boolean(m))
    )
  );

  let lastError = "No models attempted";

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemInstruction}\n\n読み上げるセリフ：「${text}」` }],
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

      // PCM 形式の場合は WAV ヘッダーを付与してブラウザで即再生可能にする
      if (mimeType.includes("pcm")) {
        let rate = 24000;
        const rateMatch = mimeType.match(/rate=(\d+)/);
        if (rateMatch) {
          rate = parseInt(rateMatch[1], 10);
        }
        const wavBuffer = pcmToWav(rawBuffer, rate);
        return {
          success: true,
          audioDataUrl: `data:audio/wav;base64,${wavBuffer.toString("base64")}`,
        };
      }

      // 既に wav や mp3 の場合
      return {
        success: true,
        audioDataUrl: `data:${mimeType};base64,${inlineAudio.data}`,
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
