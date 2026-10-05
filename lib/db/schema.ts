import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Better Auth 必須テーブル
 */
export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // かのはアプリ 親PIN関連
  parentPinHash: text("parent_pin_hash"),
  parentPinFailedAttempts: integer("parent_pin_failed_attempts").default(0).notNull(),
  parentPinLockedUntil: text("parent_pin_locked_until"),
});

export const sessions = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verifications = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/**
 * かのはアプリ ドメインモデル
 */
export const childProfiles = sqliteTable("child_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  grade: integer("grade").notNull().default(2),
  preferredStyle: text("preferred_style").notNull().default("praise_coach"),
  readingMode: text("reading_mode").notNull().default("kanji_with_ruby"),
  audioVoice: text("audio_voice").notNull().default("friendly"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const uploadedMaterials = sqliteTable("uploaded_materials", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  fileUrls: text("file_urls").notNull(), // JSON array string
  fileType: text("file_type").notNull(),
  pageCount: integer("page_count").notNull(),
  sourceType: text("source_type").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const problems = sqliteTable("problems", {
  id: text("id").primaryKey(),
  materialId: text("material_id").references(() => uploadedMaterials.id, { onDelete: "set null" }),
  childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  problemText: text("problem_text").notNull(),
  problemImageUrl: text("problem_image_url"),
  subject: text("subject").notNull().default("math"),
  grade: integer("grade").notNull().default(2),
  unit: text("unit").notNull(),
  subUnit: text("sub_unit").notNull(),
  difficulty: text("difficulty").notNull().default("standard"),
  correctAnswer: text("correct_answer").notNull(),
  explanationJson: text("explanation_json").notNull(), // JSON string
  status: text("status").notNull().default("active"),
  /** 問題バンク(lib/curriculum/curriculumBank.ts)から登録した問題の元 id。アップロード由来は null。 */
  curriculumProblemId: text("curriculum_problem_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("problems_child_curriculum_unique").on(table.childId, table.curriculumProblemId),
]);

export const learningSessions = sqliteTable("learning_sessions", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => learningSessions.id, { onDelete: "cascade" }),
  childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  problemId: text("problem_id").references(() => problems.id, { onDelete: "set null" }),
  similarProblemId: text("similar_problem_id").references(() => generatedSimilarProblems.id, { onDelete: "set null" }),
  childAnswer: text("child_answer").notNull(),
  answerType: text("answer_type").notNull(),
  isCorrect: integer("is_correct").notNull(), // 0 or 1
  hintLevelUsed: integer("hint_level_used").notNull().default(0),
  mistakeType: text("mistake_type"),
  aiFeedback: text("ai_feedback"),
  createdAt: text("created_at").notNull(),
});

export const generatedSimilarProblems = sqliteTable("generated_similar_problems", {
  id: text("id").primaryKey(),
  sourceProblemId: text("source_problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  problemText: text("problem_text").notNull(),
  answer: text("answer").notNull(),
  explanation: text("explanation").notNull(),
  unit: text("unit").notNull(),
  subUnit: text("sub_unit").notNull(),
  difficulty: text("difficulty").notNull(),
  choices: text("choices"), // JSON array string
  /** 英語の聞き取り問題で en-US 読み上げする文(答えそのものは入れない) */
  listenText: text("listen_text"),
  createdAt: text("created_at").notNull(),
});

export const problemHintViews = sqliteTable(
  "problem_hint_views",
  {
    childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
    problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull().references(() => learningSessions.id, { onDelete: "cascade" }),
    maxLevel: integer("max_level").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.childId, table.problemId, table.sessionId] }),
  ],
);

export const weaknessMap = sqliteTable(
  "weakness_map",
  {
    id: text("id").primaryKey(),
    childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
    unit: text("unit").notNull(),
    subUnit: text("sub_unit").notNull(),
    accuracyRate: real("accuracy_rate").notNull(),
    mistakeCount: integer("mistake_count").notNull().default(0),
    lastAttemptedAt: text("last_attempted_at"),
    nextReviewAt: text("next_review_at"),
    masteryLevel: text("mastery_level").notNull().default("learning"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("weakness_map_child_unit_sub_unit_unique").on(
      table.childId,
      table.unit,
      table.subUnit,
    ),
  ],
);

export const reviewSchedule = sqliteTable(
  "review_schedule",
  {
    id: text("id").primaryKey(),
    childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
    problemId: text("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
    unit: text("unit").notNull(),
    subUnit: text("sub_unit").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
    reviewStage: integer("review_stage").notNull().default(1),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("review_schedule_child_problem_unique").on(
      table.childId,
      table.problemId,
    ),
  ],
);

export const parentReports = sqliteTable(
  "parent_reports",
  {
    id: text("id").primaryKey(),
    childId: text("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
    reportDate: text("report_date").notNull(),
    summary: text("summary").notNull(),
    accuracyRate: real("accuracy_rate").notNull(),
    weakUnits: text("weak_units").notNull(), // JSON string
    growthPoints: text("growth_points").notNull(), // JSON string
    nextRecommendations: text("next_recommendations").notNull(), // JSON string
    slackSentAt: text("slack_sent_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("parent_reports_child_report_date_unique").on(
      table.childId,
      table.reportDate,
    ),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey(),
  childId: text("child_id").notNull().unique().references(() => childProfiles.id, { onDelete: "cascade" }),
  explanationLevel: text("explanation_level").notNull().default("easy"),
  dailyLimitMinutes: integer("daily_limit_minutes").notNull().default(15),
  enableSlack: integer("enable_slack").notNull().default(0),
  slackWebhookUrl: text("slack_webhook_url"),
  enableAudio: integer("enable_audio").notNull().default(1),
  enableVoiceAnswer: integer("enable_voice_answer").notNull().default(1),
  enableImageGeneration: integer("enable_image_generation").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiDailyUsage = sqliteTable("ai_daily_usage", {
  id: text("id").primaryKey(),
  usageDate: text("usage_date").notNull().unique(),
  calls: integer("calls").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: text("id").primaryKey(),
    limiterKey: text("limiter_key").notNull(),
    action: text("action").notNull(),
    windowStart: text("window_start").notNull(),
    callCount: integer("call_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("rate_limits_key_action_window_unique").on(
      table.limiterKey,
      table.action,
      table.windowStart,
    ),
  ],
);

/**
 * ごほうび(5円メーター・累計正解数)と着せかえ。子どもごとに1行。
 * 正解数はサーバー(/api/attempts)だけが増やす。端末の localStorage は表示用キャッシュ。
 */
export const childRewards = sqliteTable("child_rewards", {
  childId: text("child_id").primaryKey().references(() => childProfiles.id, { onDelete: "cascade" }),
  currentCycleCount: integer("current_cycle_count").notNull().default(0),
  totalCorrectCount: integer("total_correct_count").notNull().default(0),
  totalRewardYen: integer("total_reward_yen").notNull().default(0),
  lastRewardEarnedAt: text("last_reward_earned_at"),
  equippedAccessories: text("equipped_accessories"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
