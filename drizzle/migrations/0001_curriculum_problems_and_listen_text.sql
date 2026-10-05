ALTER TABLE `generated_similar_problems` ADD `listen_text` text;--> statement-breakpoint
ALTER TABLE `problems` ADD `curriculum_problem_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `problems_child_curriculum_unique` ON `problems` (`child_id`,`curriculum_problem_id`);