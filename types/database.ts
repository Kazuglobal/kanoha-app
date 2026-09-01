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
  createdAt: IsoDateTime;
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
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

