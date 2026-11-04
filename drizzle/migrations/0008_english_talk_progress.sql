CREATE TABLE `english_talk_progress` (
	`child_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`best_stars` integer NOT NULL,
	`clear_count` integer NOT NULL,
	`last_cleared_at` text NOT NULL,
	`last_run_id` text,
	PRIMARY KEY(`child_id`, `scene_id`),
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "english_talk_progress_stars_range" CHECK(best_stars BETWEEN 1 AND 3)
);
