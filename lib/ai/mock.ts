import type { AiProvider } from "./provider";
import type {
  Hints,
  ParsedProblem,
  SimilarProblemDraft,
  SimilarProblemRequest,
} from "./schemas";

interface MockProblemSpec {
  correctAnswer: string;
  hints?: Partial<Omit<Hints, "answer">>;
  problemText: string;
  recommendedVisualTemplate?: string;
  subUnit: string;
  unit: ParsedProblem["unit"];
}

const makeProblem = (spec: MockProblemSpec): ParsedProblem => ({
  correctAnswer: spec.correctAnswer,
  difficulty: "standard",
  grade: 2,
  hints: {
    answer: spec.correctAnswer,
    hint1: "わかるところから、ゆっくり考えよう。",
    hint2: "数字とたんいに注目してみよう。",
    praise: "よく問題を見られたね。",
    solution: `考え方を使うと、答えは${spec.correctAnswer}です。`,
    ...spec.hints,
  },
  problemText: spec.problemText,
  recommendedVisualTemplate: spec.recommendedVisualTemplate ?? null,
  rubyTextRequired: true,
  similarProblemCount: 5,
  subUnit: spec.subUnit,
  subject: "math",
  unit: spec.unit,
});

/** Deterministic problems using canonical curriculum units (lib/curriculum/grade2Math.ts). */
export const mockProblems: readonly ParsedProblem[] = [
  makeProblem({
    correctAnswer: "1000mL",
    hints: {
      hint1: "1Lの中には、100mLがいくつあるかな。",
      hint2: "100mLが10こで1Lだよ。",
      praise: "よく考えたね。",
      solution: "100を10こあわせます。",
    },
    problemText: "1Lは何mLですか。",
    recommendedVisualTemplate: "volume",
    subUnit: "LとmL",
    unit: "水のかさ",
  }),
  makeProblem({
    correctAnswer: "43",
    problemText: "28+15はいくつですか。",
    subUnit: "くり上がり",
    unit: "たし算",
  }),
  makeProblem({
    correctAnswer: "12こ",
    problemText: "3こずつ4さらで、ぜんぶで何こですか。",
    subUnit: "九九",
    unit: "かけ算",
  }),
];

const makeSimilarProblem = (
  input: SimilarProblemRequest,
  index: number,
): SimilarProblemDraft => {
  const count = index + 1;
  return {
    answer: `${count * 1000}mL`,
    difficulty: input.difficulty,
    explanation: `1Lは1000mLなので、${count}を1000倍します。`,
    problemText: `${count}Lは何mLですか。`,
    subUnit: input.subUnit,
    unit: input.unit,
  };
};

export const mockAiProvider: AiProvider = {
  analyzeProblems: async () => [...mockProblems],
  generateSimilarProblems: async (input) =>
    Array.from({ length: 5 }, (_, index) => makeSimilarProblem(input, index)),
  name: "mock",
  recognizeHandwriting: async () => ({ answer: "1000mL" }),
};
