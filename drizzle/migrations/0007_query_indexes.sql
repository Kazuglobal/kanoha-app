CREATE INDEX `attempts_child_created_idx` ON `attempts` (`child_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `attempts_child_problem_idx` ON `attempts` (`child_id`,`problem_id`);--> statement-breakpoint
CREATE INDEX `generated_similar_child_source_idx` ON `generated_similar_problems` (`child_id`,`source_problem_id`);