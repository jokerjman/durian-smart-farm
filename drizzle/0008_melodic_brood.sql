CREATE TABLE `season_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`name` text NOT NULL,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`started_on` text,
	`completed_on` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_stages_order_uq` ON `season_stages` (`season_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `season_stages_season_idx` ON `season_stages` (`season_id`);--> statement-breakpoint
ALTER TABLE `seasons` ADD `actual_kg` real;--> statement-breakpoint
ALTER TABLE `seasons` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `seasons` ADD `closed_at` integer;--> statement-breakpoint
ALTER TABLE `seasons` ADD `closed_by` text REFERENCES users(id);