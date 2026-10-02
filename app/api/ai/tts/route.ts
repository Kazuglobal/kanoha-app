import { NextResponse } from "next/server";
import { generateGeminiSpeech } from "@/lib/ai/tts";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const mood = body.mood === "celebrate" || body.mood === "think" ? body.mood : "happy";
    const voiceName = body.voiceName || "Aoede";

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // セリフの最大文字数ガード (300文字)
    const truncatedText = text.slice(0, 300);

    const result = await generateGeminiSpeech({
      text: truncatedText,
      mood,
      voiceName,
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
