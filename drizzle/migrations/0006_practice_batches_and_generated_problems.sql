CREATE TABLE `practice_batch_items` (
	`batch_id` text NOT NULL,
	`position` integer NOT NULL,
	`problem_id` text NOT NULL,
	`reason` text NOT NULL,
	PRIMARY KEY(`batch_id`, `position`),
	FOREIGN KEY (`batch_id`) REFERENCES `practice_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `practice_batch_items_problem_idx` ON `practice_batch_items` (`problem_id`);--> statement-breakpoint
CREATE TABLE `practice_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`subject` text NOT NULL,
	`batch_date` text NOT NULL,
	`seq` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `practice_batches_child_subject_date_seq_unique` ON `practice_batches` (`child_id`,`subject`,`batch_date`,`seq`);--> statement-breakpoint
ALTER TABLE `problems` ADD `choices` text;--> statement-breakpoint
ALTER TABLE `problems` ADD `listen_text` text;--> statement-breakpoint
ALTER TABLE `problems` ADD `generator_ref` text;--> statement-breakpoint
ALTER TABLE `problems` ADD `difficulty_level` integer;