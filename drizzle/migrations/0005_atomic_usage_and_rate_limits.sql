-- 【適用順】本番は「先にこのマイグレーション → そのあとに新コードをデプロイ」。逆順だと upsert の ON CONFLICT が合わず、レート制限つきの API がすべて 429 になる。
--   (先に適用して旧コードのままの間は、AI 呼び出しだけが安全側で止まる。)
-- AI 利用量を「ユーザーごと・日ごと」に。日次カウンタと窓の状態は一時的なデータなので作り直す
-- (SQLite は既定値のない NOT NULL 列を既存表へ追加できない。適用時点の当日カウントは 0 に戻る)。
DROP TABLE `ai_daily_usage`;--> statement-breakpoint
CREATE TABLE `ai_daily_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`usage_date` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_daily_usage_user_date_unique` ON `ai_daily_usage` (`user_id`,`usage_date`);--> statement-breakpoint
-- レート制限は limiter_key ごとに1行にして原子的な upsert で数える(既存の窓は捨てる。重複キーがあると一意索引を作れない)。
DELETE FROM `rate_limits`;--> statement-breakpoint
DROP INDEX `rate_limits_key_action_window_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_limiter_key_unique` ON `rate_limits` (`limiter_key`);
