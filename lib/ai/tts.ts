/**
 * Gemini TTS (Multimodal Audio Output) 連携モジュール
 * Google Gemini 2.0 Flash のネイティブ音声出力 (AUDIO モダリティ) を使用して、
 * 「かのはちゃん」の温かく愛らしい応援ボイスを生成します。
 */

export interface GeminiTtsOptions {
  text: string;
  mood?: "happy" | "celebrate" | "think";
  voiceName?: "Aoede" | "Autonoe" | "Laomedeia" | "Kore" | "Puck" | "Fenrir" | "Charon";
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

  // 小学校2年生の女の子キャラクター「かのはちゃん」専用の演出指示
  const moodInstruction =
    mood === "celebrate"
      ? "大正解を思いっきり喜んで、ぴょんぴょん飛び跳ねるように『やったー！』という満面の笑顔が伝わる最高に明るい声で褒めてください。"
      : mood === "think"
      ? "『大丈夫だよ、いっしょに考えよう』と安心させるように、優しく寄り添うトーンで語りかけてください。"
      : "親友といっしょに勉強しているように、笑顔でいっしょに頑張ろうと明るく励ましてください。";

  const systemInstruction = `あなたは小学2年生の自立学習をやさしく楽しく応援する女の子キャラクター「かのはちゃん」です。
【キャラクター設定と声色の指示】:
- 年齢: 小学2年生くらいの元気で純粋な女の子。
- 声質: 少し高めのピッチで、透明感と愛嬌のある、アニメのヒロインのようなとっても可愛らしい少女の声。
- トーン: 人工的な機械声やアナウンサーのような堅苦しさを完全に排除し、人間味とあたたかさにあふれた自然な話し言葉。
- 演出: ${moodInstruction}
- 注意事項: セリフ以外の解説や挨拶は一切追加せず、指定されたセリフ「」の中身だけをそのまま情感豊かに発声してください。`;

  try {
    const ttsModel = process.env.GEMINI_TTS_MODEL || "gemini-2.0-flash";
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ttsModel)}:generateContent`;

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
                voiceName, // Aoede / Autonoe: 明るく澄んだ愛らしい少女声
              },
            },
          },
        },
      }),
    });


    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Gemini TTS] API error: ${response.status} ${errText}`);
      return {
        success: false,
        fallback: true,
        error: `Gemini API returned ${response.status}`,
      };
    }

    const data = await response.json();
    const candidatePart = data.candidates?.[0]?.content?.parts?.[0];
    const inlineAudio = candidatePart?.inlineData;

    if (!inlineAudio || !inlineAudio.data) {
      console.warn("[Gemini TTS] No audio inlineData found in response");
      return {
        success: false,
        fallback: true,
        error: "No audio data in response",
      };
    }

    const mimeType = inlineAudio.mimeType || "audio/wav";
    const rawBuffer = Buffer.from(inlineAudio.data, "base64");

    // PCM 形式の場合は WAV ヘッダーを付与してブラウザで即再生可能にする
    if (mimeType.includes("pcm")) {
      // 例: audio/pcm;rate=24000
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
  } catch (error) {
    console.error("[Gemini TTS] Fetch failed:", error);
    return {
      success: false,
      fallback: true,
      error: error instanceof Error ? error.message : "TTS request failed",
    };
  }
}
