/**
 * Gemini マルチモーダル(AUDIO 入力)による音声の書き起こし。
 * モデル名は環境変数(GEMINI_STT_MODEL → GEMINI_TEXT_MODEL)だけから読む。
 * 認証・利用量の確認は呼び出し側(Route Handler)の責務。
 */

const STT_TIMEOUT_MS = 10_000;

export interface TranscribeAudioOptions {
  audioBase64: string;
  mimeType: string;
  prompt: string;
}

const candidateModels = (): string[] =>
  Array.from(
    new Set(
      [process.env.GEMINI_STT_MODEL, process.env.GEMINI_TEXT_MODEL].filter((model): model is string =>
        Boolean(model),
      ),
    ),
  );

async function requestTranscript(
  model: string,
  apiKey: string,
  { audioBase64, mimeType, prompt }: TranscribeAudioOptions,
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inlineData: { data: audioBase64, mimeType } }, { text: prompt }] }],
        }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return typeof transcript === "string" && transcript ? transcript : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 書き起こせたときだけ文字列を返す(未設定・失敗・空は null)。 */
export async function transcribeAudio(options: TranscribeAudioOptions): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  for (const model of candidateModels()) {
    const transcript = await requestTranscript(model, apiKey, options);
    if (transcript) return transcript;
  }
  return null;
}
