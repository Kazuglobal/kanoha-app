import { SUBJECT_CONFIG, type Grade2Unit, type Subject } from "./subjects";
import { GRADE_2_MATH_CURRICULUM } from "./grade2Math";
import { GRADE_2_JAPANESE_CURRICULUM } from "./grade2Japanese";
import { GRADE_2_ENGLISH_CURRICULUM } from "./grade2English";
import { ENGLISH_CURRICULUM_PROBLEMS } from "./curriculumBankEnglish";
import { JAPANESE_CURRICULUM_PROBLEMS } from "./curriculumBankJapanese";
import { MATH_CURRICULUM_PROBLEMS } from "./curriculumBankMath";

export interface CurriculumProblem {
  id: string;
  subject: Subject;
  unitId: string;
  unit: Grade2Unit;
  subUnit: string;
  problemText: string;
  correctAnswer: string;
  hints: {
    hint1: string;
    hint2: string;
    solution: string;
    answer: string;
    praise: string;
  };
  recommendedVisualTemplate?: string | null;
  /** 選択式の問題の選択肢(答えを含む)。無ければ文字入力/テンキー。 */
  choices?: readonly string[];
  /** 「えいごを きく」で en-US 読み上げする英語。答えが英語そのものの問題では付けない。 */
  listenText?: string;
}

export interface CurriculumStage {
  id: string;
  subject: Subject;
  unit: Grade2Unit;
  title: string;
  emoji: string;
  description: string;
  problemCount: number;
  firstProblemId: string;
  problemIds: readonly string[];
}

export const CURRICULUM_PROBLEMS: readonly CurriculumProblem[] = [
  ...MATH_CURRICULUM_PROBLEMS,
  ...JAPANESE_CURRICULUM_PROBLEMS,
  ...ENGLISH_CURRICULUM_PROBLEMS,
];

export function getCurriculumProblemById(id: string): CurriculumProblem | undefined {
  return CURRICULUM_PROBLEMS.find((p) => p.id === id);
}

export function getCurriculumProblemsBySubject(subject: Subject): CurriculumProblem[] {
  return CURRICULUM_PROBLEMS.filter((p) => p.subject === subject);
}

export function getCurriculumProblemsByUnit(unit: string): CurriculumProblem[] {
  return CURRICULUM_PROBLEMS.filter((p) => p.unit === unit);
}

/**
 * 現在の問題の「つぎの問題」を取得する。
 * 同じ単元内に次の問題があればそれを返し、
 * 単元の最後の問題であれば、次の単元の第1問を返す。
 * 全問解き終わったら最初の問題へループする。
 */
export function getNextCurriculumProblem(currentId: string): CurriculumProblem | null {
  const current = getCurriculumProblemById(currentId);
  if (!current) {
    // 未知のIDなら算数の第1問へ
    return CURRICULUM_PROBLEMS[0] ?? null;
  }

  const subjectProblems = getCurriculumProblemsBySubject(current.subject);
  const currentIndex = subjectProblems.findIndex((p) => p.id === currentId);
  if (currentIndex === -1) return subjectProblems[0] ?? null;

  const nextIndex = (currentIndex + 1) % subjectProblems.length;
  return subjectProblems[nextIndex] ?? null;
}

/**
 * 単元内での進行度（例: "たし算 1 / 3"）を取得する
 */
export function getCurriculumStageProgress(problemId: string): {
  unit: string;
  index: number;
  total: number;
  label: string;
} | null {
  const problem = getCurriculumProblemById(problemId);
  if (!problem) return null;

  const unitProblems = getCurriculumProblemsByUnit(problem.unit);
  const index = unitProblems.findIndex((p) => p.id === problemId);
  if (index === -1) return null;

  return {
    unit: problem.unit,
    index: index + 1,
    total: unitProblems.length,
    label: `${problem.unit} ${index + 1} / ${unitProblems.length}`,
  };
}

/** 単元ごとのステージ絵文字(未登録は教科の絵文字)。 */
const STAGE_EMOJI: Readonly<Record<string, string>> = {
  "水のかさ": "🌊",
  "たし算": "➕",
  "ひき算": "➖",
  "かけ算": "✖️",
  "時こくと時間": "⏰",
  "長さ": "📏",
  "三角形と四角形": "📐",
  "1000より大きい数": "🔢",
  "分数": "🍰",
  "はこの形": "📦",
  "表とグラフ": "📊",
  "整理する力": "📁",
  "漢字": "✍️",
  "ことばのきまり": "🔄",
  "文の組み立て": "🧩",
  "お話の読解": "📚",
  "説明文の読解": "🔍",
  "作文と表現": "📝",
  "アルファベット": "🔤",
  "あいさつ": "👋",
  "えいごのかず": "🔢",
  "いろ": "🎨",
  "どうぶつ": "🐶",
  "たべもの": "🍎",
  "からだ": "🙌",
};

const CURRICULUM_BY_SUBJECT: Readonly<
  Record<Subject, readonly { id: string; unit: string; subUnits: readonly string[] }[]>
> = {
  math: GRADE_2_MATH_CURRICULUM,
  japanese: GRADE_2_JAPANESE_CURRICULUM,
  english: GRADE_2_ENGLISH_CURRICULUM,
};

/**
 * ステージ選択カード用データ(問題が 1 問もない単元は出さない)
 */
export function getCurriculumStages(subject: Subject): CurriculumStage[] {
  return CURRICULUM_BY_SUBJECT[subject].flatMap((unitDef) => {
    const problems = getCurriculumProblemsByUnit(unitDef.unit);
    const first = problems[0];
    if (!first) return [];
    return [
      {
        id: unitDef.id,
        subject,
        unit: unitDef.unit as Grade2Unit,
        title: unitDef.unit,
        emoji: STAGE_EMOJI[unitDef.unit] ?? SUBJECT_CONFIG[subject].emoji,
        description: unitDef.subUnits.join("・"),
        problemCount: problems.length,
        firstProblemId: first.id,
        problemIds: problems.map((problem) => problem.id),
      },
    ];
  });
}
