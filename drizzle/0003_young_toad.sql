CREATE TABLE `harvest_batch_trees` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`tree_id` text NOT NULL,
	`weight_kg` real,
	`fruit_count` integer,
	FOREIGN KEY (`batch_id`) REFERENCES `harvest_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `harvest_batch_tree_uq` ON `harvest_batch_trees` (`batch_id`,`tree_id`);--> statement-breakpoint
CREATE TABLE `harvest_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`plot_id` text,
	`season_id` text,
	`lot_code` text NOT NULL,
	`variety` text NOT NULL,
	`harvested_on` text NOT NULL,
	`total_weight_kg` real NOT NULL,
	`fruit_count` integer NOT NULL,
	`status` text NOT NULL,
	`trace_key` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `harvest_batches_lot_uq` ON `harvest_batches` (`lot_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `harvest_batches_trace_uq` ON `harvest_batches` (`trace_key`);--> statement-breakpoint
CREATE INDEX `harvest_batches_farm_date_idx` ON `harvest_batches` (`farm_id`,`harvested_on`);--> statement-breakpoint
CREATE TABLE `harvest_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`grade` text NOT NULL,
	`weight_kg` real NOT NULL,
	`fruit_count` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `harvest_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `harvest_grades_batch_grade_uq` ON `harvest_grades` (`batch_id`,`grade`);--> statement-breakpoint
CREATE TABLE `produce_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`weight_kg` real NOT NULL,
	`price_per_kg` real NOT NULL,
	`total_amount` real NOT NULL,
	`delivery_on` text,
	`status` text NOT NULL,
	`transaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `harvest_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `produce_sales_transaction_uq` ON `produce_sales` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `produce_sales_batch_idx` ON `produce_sales` (`batch_id`);