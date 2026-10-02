CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_daily_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`usage_date` text NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_daily_usage_usage_date_unique` ON `ai_daily_usage` (`usage_date`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`explanation_level` text DEFAULT 'easy' NOT NULL,
	`daily_limit_minutes` integer DEFAULT 15 NOT NULL,
	`enable_slack` integer DEFAULT 0 NOT NULL,
	`slack_webhook_url` text,
	`enable_audio` integer DEFAULT 1 NOT NULL,
	`enable_voice_answer` integer DEFAULT 1 NOT NULL,
	`enable_image_generation` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_child_id_unique` ON `app_settings` (`child_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`child_id` text NOT NULL,
	`problem_id` text,
	`similar_problem_id` text,
	`child_answer` text NOT NULL,
	`answer_type` text NOT NULL,
	`is_correct` integer NOT NULL,
	`hint_level_used` integer DEFAULT 0 NOT NULL,
	`mistake_type` text,
	`ai_feedback` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `learning_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`similar_problem_id`) REFERENCES `generated_similar_problems`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `child_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nickname` text NOT NULL,
	`grade` integer DEFAULT 2 NOT NULL,
	`preferred_style` text DEFAULT 'praise_coach' NOT NULL,
	`reading_mode` text DEFAULT 'kanji_with_ruby' NOT NULL,
	`audio_voice` text DEFAULT 'friendly' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `generated_similar_problems` (
	`id` text PRIMARY KEY NOT NULL,
	`source_problem_id` text NOT NULL,
	`child_id` text NOT NULL,
	`problem_text` text NOT NULL,
	`answer` text NOT NULL,
	`explanation` text NOT NULL,
	`unit` text NOT NULL,
	`sub_unit` text NOT NULL,
	`difficulty` text NOT NULL,
	`choices` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learning_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`total_questions` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `parent_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`report_date` text NOT NULL,
	`summary` text NOT NULL,
	`accuracy_rate` real NOT NULL,
	`weak_units` text NOT NULL,
	`growth_points` text NOT NULL,
	`next_recommendations` text NOT NULL,
	`slack_sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_reports_child_report_date_unique` ON `parent_reports` (`child_id`,`report_date`);--> statement-breakpoint
CREATE TABLE `problem_hint_views` (
	`child_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`session_id` text NOT NULL,
	`max_level` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`child_id`, `problem_id`, `session_id`),
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `learning_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `problems` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text,
	`child_id` text NOT NULL,
	`problem_text` text NOT NULL,
	`problem_image_url` text,
	`subject` text DEFAULT 'math' NOT NULL,
	`grade` integer DEFAULT 2 NOT NULL,
	`unit` text NOT NULL,
	`sub_unit` text NOT NULL,
	`difficulty` text DEFAULT 'standard' NOT NULL,
	`correct_answer` text NOT NULL,
	`explanation_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `uploaded_materials`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`limiter_key` text NOT NULL,
	`action` text NOT NULL,
	`window_start` text NOT NULL,
	`call_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_key_action_window_unique` ON `rate_limits` (`limiter_key`,`action`,`window_start`);--> statement-breakpoint
CREATE TABLE `review_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`unit` text NOT NULL,
	`sub_unit` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`review_stage` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_schedule_child_problem_unique` ON `review_schedule` (`child_id`,`problem_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `uploaded_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`file_urls` text NOT NULL,
	`file_type` text NOT NULL,
	`page_count` integer NOT NULL,
	`source_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`parent_pin_hash` text,
	`parent_pin_failed_attempts` integer DEFAULT 0 NOT NULL,
	`parent_pin_locked_until` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `weakness_map` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`unit` text NOT NULL,
	`sub_unit` text NOT NULL,
	`accuracy_rate` real NOT NULL,
	`mistake_count` integer DEFAULT 0 NOT NULL,
	`last_attempted_at` text,
	`next_review_at` text,
	`mastery_level` text DEFAULT 'learning' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weakness_map_child_unit_sub_unit_unique` ON `weakness_map` (`child_id`,`unit`,`sub_unit`);