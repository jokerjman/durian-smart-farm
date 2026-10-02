CREATE TABLE `gap_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`season_id` text,
	`item_key` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`evidence_key` text,
	`reviewed_by` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gap_assessments_scope_item_uq` ON `gap_assessments` (`farm_id`,`season_id`,`item_key`);--> statement-breakpoint
CREATE INDEX `gap_assessments_farm_season_idx` ON `gap_assessments` (`farm_id`,`season_id`);