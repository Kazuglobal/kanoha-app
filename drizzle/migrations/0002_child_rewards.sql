CREATE TABLE `child_rewards` (
	`child_id` text PRIMARY KEY NOT NULL,
	`current_cycle_count` integer DEFAULT 0 NOT NULL,
	`total_correct_count` integer DEFAULT 0 NOT NULL,
	`total_reward_yen` integer DEFAULT 0 NOT NULL,
	`last_reward_earned_at` text,
	`equipped_accessories` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
