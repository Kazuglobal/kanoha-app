import type { GeminiImagePart } from "./gemini";
import type {
  HandwritingAnswer,
  ParsedProblem,
  SimilarProblemDraft,
  SimilarProblemRequest,
} from "./schemas";

export interface AiProvider {
  readonly name: "gemini" | "mock";
  analyzeProblems(images: readonly GeminiImagePart[]): Promise<ParsedProblem[]>;
  recognizeHandwriting(
    images: readonly GeminiImagePart[],
    problemText: string,
  ): Promise<HandwritingAnswer>;
  generateSimilarProblems(
    input: SimilarProblemRequest,
  ): Promise<readonly SimilarProblemDraft[]>;
}
