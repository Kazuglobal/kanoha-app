import type {
  AnswerType,
  Difficulty,
  ExplanationLevel,
  HintLevel,
  IsoDate,
  IsoDateTime,
  MasteryLevel,
  MaterialSourceType,
  MaterialStatus,
  ProblemStatus,
  ReviewStage,
  ReviewStatus,
  Uuid,
} from "@/types/domain";
import type { MistakeType } from "@/lib/curriculum/mistakeTypes";

export interface User {
  id: Uuid;
  email: string;
  displayName: string | null;
  /** 親 PIN(scrypt ハッシュ)。service_role 以外は読めない(0010)。 */
  parentPinHash: string | null;
  parentPinFailedAttempts: number;
  parentPinLockedUntil: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ChildProfile {
  id: Uuid;
  userId: Uuid;
  nickname: string;
  grade: number;
  preferredStyle: "praise_coach";
  readingMode: "kanji_with_ruby" | "hiragana";
  audioVoice: "friendly";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UploadedMaterial {
  id: Uuid;
  childId: Uuid;
  fileUrls: readonly string[];
  fileType: string;
  pageCount: number;
  sourceType: MaterialSourceType;
  status: MaterialStatus;
  expiresAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Problem {
  id: Uuid;
  materialId: Uuid | null;
  childId: Uuid;
  problemText: string;
  problemImageUrl: string | null;
  subject: string;
  grade: number;
  unit: string;
  subUnit: string;
  difficulty: Difficulty;
  correctAnswer: string;
  explanationJson: Record<string, unknown>;
  status: ProblemStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface LearningSession {
  id: Uuid;
  childId: Uuid;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  durationSeconds: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Attempt {
  id: Uuid;
  sessionId: Uuid;
  childId: Uuid;
  problemId: Uuid | null;
  similarProblemId: Uuid | null;
  childAnswer: string | null;
  answerType: AnswerType;
  isCorrect: boolean;
  hintLevelUsed: HintLevel;
  mistakeType: MistakeType | null;
  aiFeedback: string | null;
  createdAt: IsoDateTime;
}

export interface GeneratedSimilarProblem {
  id: Uuid;
  sourceProblemId: Uuid;
  childId: Uuid;
  problemText: string;
  answer: string;
  explanation: string;
  unit: string;
  subUnit: string;
  difficulty: Difficulty;
  /** サーバー生成の 4 択。数値で解釈できない答えは null(文字入力)。 */
  choices: readonly string[] | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** (child, problem, session) ごとに子どもが開いた最大ヒント段階(A2)。 */
export interface ProblemHintView {
  childId: Uuid;
  problemId: Uuid;
  sessionId: Uuid;
  maxLevel: HintLevel;
  updatedAt: IsoDateTime;
}

export interface WeaknessMapEntry {
  id: Uuid;
  childId: Uuid;
  unit: string;
  subUnit: string;
  accuracyRate: number;
  mistakeCount: number;
  lastAttemptedAt: IsoDateTime | null;
  nextReviewAt: IsoDateTime | null;
  masteryLevel: MasteryLevel;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ReviewScheduleEntry {
  id: Uuid;
  childId: Uuid;
  problemId: Uuid;
  unit: string;
  subUnit: string;
  scheduledFor: IsoDate;
  reviewStage: ReviewStage;
  status: ReviewStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ParentReport {
  id: Uuid;
  childId: Uuid;
  reportDate: IsoDate;
  summary: string;
  accuracyRate: number;
  weakUnits: readonly unknown[];
  growthPoints: readonly unknown[];
  nextRecommendations: readonly unknown[];
  slackSentAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AppSettings {
  id: Uuid;
  childId: Uuid;
  explanationLevel: ExplanationLevel;
  dailyLimitMinutes: number;
  enableSlack: boolean;
  slackWebhookSecretId: Uuid | null;
  enableAudio: boolean;
  enableVoiceAnswer: boolean;
  /** AI画像生成の親許可(0011)。既定 false。テンプレ図解には影響しない。 */
  enableImageGeneration: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** DB バックドの API レート制限(0012)。key は `${auth.uid()}:${action}`。RPC 経由でのみ読み書きされる。 */
export interface ApiRateLimit {
  key: string;
  windowStart: IsoDateTime;
  count: number;
}
