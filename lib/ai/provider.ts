import type { Subject } from "@/lib/curriculum/subjects";
import type { GeminiImagePart } from "./gemini";
import type {
  HandwritingAnswer,
  Hints,
  SimilarProblemDraft,
  SimilarProblemRequest,
} from "./schemas";

export interface AiProvider {
  readonly name: "gemini" | "mock";
  /**
   * 生の解析結果を返す。呼び出し元(analyze-problem)が parsedProblemSchema で
   * 1件ずつ safeParse し、有効なものだけ保存する(B11: 全件一括検証にしない)。
   */
  analyzeProblems(images: readonly GeminiImagePart[]): Promise<readonly unknown[]>;
  recognizeHandwriting(
    images: readonly GeminiImagePart[],
    problemText: string,
    subject?: Subject,
  ): Promise<HandwritingAnswer>;
  generateSimilarProblems(
    input: SimilarProblemRequest,
  ): Promise<readonly SimilarProblemDraft[]>;
  /** 「もっとかんたんに」の再生成。prompt は buildHintsPrompt で組み立てる。 */
  generateHints(prompt: string): Promise<Hints>;
}
