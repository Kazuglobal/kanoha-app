import { buildProblemExplanation } from "./buildProblemRecords";
import { CURRICULUM_PROBLEMS, getCurriculumProblemById } from "@/lib/curriculum/curriculumBank";
import type { AiProvider } from "./provider";
import type {
  Hints,
  ParsedProblem,
  SimilarProblemDraft,
  SimilarProblemRequest,
} from "./schemas";

/** analyzeProblems は unknown[] を返す契約だが、モックは常に有効な ParsedProblem を返す。 */
interface MockProblemSpec {
  correctAnswer: string;
  hints?: Partial<Omit<Hints, "answer">>;
  problemText: string;
  recommendedVisualTemplate?: string;
  subUnit: string;
  subject?: ParsedProblem["subject"];
  unit: ParsedProblem["unit"];
}

const makeProblem = (spec: MockProblemSpec): ParsedProblem => ({
  correctAnswer: spec.correctAnswer,
  difficulty: "standard",
  grade: 2,
  hints: {
    answer: spec.correctAnswer,
    hint1: "わかるところから、ゆっくり考えよう。",
    hint2: "数字やことばに注目してみよう。",
    praise: "よく問題を見られたね。",
    solution: `考え方を使うと、答えは${spec.correctAnswer}です。`,
    ...spec.hints,
  },
  problemText: spec.problemText,
  recommendedVisualTemplate: spec.recommendedVisualTemplate ?? null,
  rubyTextRequired: true,
  similarProblemCount: 5,
  subUnit: spec.subUnit,
  subject: spec.subject ?? "math",
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

export const mockJapaneseProblems: readonly ParsedProblem[] = [
  makeProblem({
    subject: "japanese",
    correctAnswer: "青空",
    hints: {
      hint1: "「あお」と「ぞら」をそれぞれ漢字で思い出してみよう。",
      hint2: "「青」と「空」の２文字を組み合わせるよ。",
      praise: "漢字をよく思い出せたね！",
      solution: "「あお」は「青」、「ぞら」は「空」で「青空」と書きます。",
    },
    problemText: "つぎの ことばを かん字で かきましょう。「あおぞら」",
    subUnit: "漢字の書き",
    unit: "漢字",
  }),
  makeProblem({
    subject: "japanese",
    correctAnswer: "うれしい気持ち",
    hints: {
      hint1: "たけしさんが笑った場面を探してみよう。",
      hint2: "「ありがとう」と言われたときの気持ちを想像してみよう。",
      praise: "文章をていねいに読めたね！",
      solution: "友だちに喜んでもらえて、たけしさんは『うれしい気持ち』になりました。",
    },
    problemText: "たけしさんは、どんな気持ちでしたか。文の中からさがしましょう。",
    subUnit: "登場人物の気持ち",
    unit: "お話の読解",
  }),
];

/** Supabase 未設定時のデモ問題(app/child/home の /child/problem/volume-1, kanji-1)。 */
export const DEMO_PROBLEM_ID = "volume-1";
export const DEMO_JAPANESE_PROBLEM_ID = "kanji-1";

/** デモ問題を DB 行と同じ形で返す(/api/problems/[id]/hint の Supabase 未設定経路)。 */
export const demoProblemById = (id: string) => {
  const bankProblem = getCurriculumProblemById(id);
  if (bankProblem) {
    const parsed: ParsedProblem = {
      correctAnswer: bankProblem.correctAnswer,
      difficulty: "standard",
      grade: 2,
      hints: bankProblem.hints,
      problemText: bankProblem.problemText,
      recommendedVisualTemplate: bankProblem.recommendedVisualTemplate ?? null,
      rubyTextRequired: true,
      similarProblemCount: 5,
      subUnit: bankProblem.subUnit,
      subject: bankProblem.subject,
      unit: bankProblem.unit,
    };
    return {
      correct_answer: bankProblem.correctAnswer,
      explanation_json: buildProblemExplanation(parsed),
      problem_text: bankProblem.problemText,
      subject: bankProblem.subject,
      unit: bankProblem.unit,
    };
  }

  if (id === DEMO_PROBLEM_ID) {
    const problem = mockProblems[0];
    return {
      correct_answer: problem.correctAnswer,
      explanation_json: buildProblemExplanation(problem),
      problem_text: problem.problemText,
      subject: "math",
      unit: problem.unit,
    };
  }
  if (id === DEMO_JAPANESE_PROBLEM_ID) {
    const problem = mockJapaneseProblems[0];
    return {
      correct_answer: problem.correctAnswer,
      explanation_json: buildProblemExplanation(problem),
      problem_text: problem.problemText,
      subject: "japanese",
      unit: problem.unit,
    };
  }
  return null;
};

const makeSimilarProblem = (
  input: SimilarProblemRequest,
  index: number,
): SimilarProblemDraft => {
  const isJapanese = input.unit === "漢字" || input.unit === "お話の読解" || input.unit === "ことばのきまり";
  if (isJapanese) {
    const kanjiSamples = ["青空", "春風", "青い鳥", "青葉", "大空"];
    const sample = kanjiSamples[index % kanjiSamples.length];
    return {
      answer: "よみかた",
      difficulty: input.difficulty,
      explanation: `漢字の読み方をていねいに確認しましょう。`,
      problemText: `次の漢字の読み方を書きましょう。「${sample}」`,
      subUnit: input.subUnit,
      unit: input.unit,
    };
  }

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

/** 「もっとかんたんに」用の固定ヒント。very_easy はより短くやさしい文にする。 */
const STANDARD_MOCK_HINTS: Hints = {
  answer: "1000mL",
  hint1: "1Lの中には、100mLがいくつあるか考えよう。",
  hint2: "100mLが10こで1Lになるよ。",
  praise: "じっくり考えられているね。",
  solution: "100mLを10こあつめると1000mLです。だから1Lは1000mLです。",
};

const VERY_EASY_MOCK_HINTS: Hints = {
  answer: "1000mL",
  hint1: "えを 見てみよう。",
  hint2: "100が 10こ あるよ。",
  praise: "がんばっているね。",
  solution: "100が 10こで 1000だよ。",
};

const JAPANESE_MOCK_HINTS: Hints = {
  answer: "あおぞら",
  hint1: "漢字の１文字ずつに注目してみよう。",
  hint2: "「青」と「空」の読み方を思い出そう。",
  praise: "よく気づけたね！",
  solution: "「青」は「あお」、「空」はにごって「ぞら」と読みます。",
};

export const mockAiProvider: AiProvider = {
  analyzeProblems: async () => [...mockProblems],
  generateHints: async (prompt) => {
    if (prompt.includes("very_easy")) {
      return VERY_EASY_MOCK_HINTS;
    }
    if (prompt.includes("1Lは何mLですか。")) {
      return STANDARD_MOCK_HINTS;
    }
    const bankMatch = CURRICULUM_PROBLEMS.find(
      (p) => p.problemText && prompt.includes(p.problemText.slice(0, 8)),
    );
    if (bankMatch) {
      return bankMatch.hints;
    }
    if (prompt.includes("こくご") || prompt.includes("漢字") || prompt.includes("青空")) {
      return JAPANESE_MOCK_HINTS;
    }
    return STANDARD_MOCK_HINTS;
  },
  generateSimilarProblems: async (input) =>
    Array.from({ length: 5 }, (_, index) => makeSimilarProblem(input, index)),
  name: "mock",
  recognizeHandwriting: async (_images, problemText = "", subject = "math") => {
    const bankMatch = CURRICULUM_PROBLEMS.find(
      (p) => problemText && (p.problemText.includes(problemText.slice(0, 8)) || problemText.includes(p.problemText.slice(0, 8))),
    );
    if (bankMatch) {
      return { answer: bankMatch.correctAnswer };
    }
    if (
      subject === "japanese" ||
      problemText.includes("漢字") ||
      problemText.includes("青空") ||
      problemText.includes("ことば") ||
      problemText.includes("こくご")
    ) {
      return { answer: "青空" };
    }
    return { answer: "1000mL" };
  },
};
