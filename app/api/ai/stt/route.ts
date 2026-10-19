import { NextResponse } from "next/server";
import { getTalkTurn } from "@/lib/curriculum/englishTalkScenes";

/**
 * リアルタイム英会話 音声認識 (STT) エンドポイント
 * - ブラウザの Web Speech API がネットワーク制限等で利用できない場合や、
 *   音声ストリームから直接テキスト化するフォールバックとして使用します。
 * - Gemini Multimodal (AUDIO 入力) が利用可能な場合は高精度に英語・日本語（「わからない」等）を書き起こします。
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
    const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "audio/webm";
    const lang = body.lang === "ja-JP" ? "ja-JP" : "en-US";
    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    const turnId = typeof body.turnId === "string" ? body.turnId : "";

    const turn = sceneId && turnId ? getTalkTurn(sceneId, turnId) : undefined;
    if (!audioBase64 || audioBase64.length < 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Audio data is required",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

    if (apiKey) {
      const candidateModels = Array.from(
        new Set(
          [
            process.env.GEMINI_STT_MODEL,
            process.env.GEMINI_TEXT_MODEL,
            "gemini-3.8-flash",
          ].filter((m): m is string => Boolean(m)),
        ),
      );
      const contextHint = turn
        ? `Question asked to the child: "${turn.prompt}" (Expected example answer: "${turn.modelAnswer}").`
        : "";

      const prompt = [
        "Transcribe the short voice recording from a Japanese child practicing English conversation.",
        contextHint,
        "If the child says an English phrase (even with a Japanese accent), output the English words only.",
        "If the child says 'わからない', 'わかんない', 'ヒント', or asks for Japanese, output 'わからない'.",
        "Return ONLY the transcribed phrase as plain text, with no quotes or explanation.",
      ]
        .filter(Boolean)
        .join(" ");

      for (const model of candidateModels) {
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
                parts: [
                  { inlineData: { data: audioBase64, mimeType } },
                  { text: prompt },
                ],
              },
            ],
          }),
        }).catch(() => null);

        if (response?.ok) {
          const data = await response.json().catch(() => null);
          const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (transcript) {
            return NextResponse.json({ success: true, transcript });
          }
        }
      }
    }

    // テスト環境で Gemini API モック用のフォールバック
    if (process.env.NODE_ENV === "test") {
      if (lang === "ja-JP") {
        return NextResponse.json({
          success: true,
          transcript: "わからない",
          fallback: true,
        });
      }

      if (turn) {
        return NextResponse.json({
          success: true,
          transcript: turn.modelAnswer,
          fallback: true,
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: "Speech recognition unavailable",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 },
    );
  }
}
