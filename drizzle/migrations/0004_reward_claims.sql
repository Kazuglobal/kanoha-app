CREATE TABLE `reward_claims` (
	`child_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`claim_date` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`child_id`, `kind`, `ref_id`, `claim_date`),
	FOREIGN KEY (`child_id`) REFERENCES `child_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
