import { NextResponse } from "next/server";
import { generateGeminiSpeech } from "@/lib/ai/tts";
import { checkRateLimit } from "@/lib/utils/rateLimit";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    if (!checkRateLimit(`tts:${forwarded}`, 120)) {
      return NextResponse.json(
        {
          success: false,
          fallback: true,
          error: "Too many requests",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const mood = body.mood === "celebrate" || body.mood === "think" ? body.mood : "happy";
    const voiceName = body.voiceName || "Aoede";
    const lang = body.lang === "en" ? "en" : "ja";

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // セリフの最大文字数ガード (300文字)
    const truncatedText = text.slice(0, 300);

    const result = await generateGeminiSpeech({
      text: truncatedText,
      mood,
      voiceName,
      lang,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API TTS] Handler error:", error);
    return NextResponse.json(
      {
        success: false,
        fallback: true,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
