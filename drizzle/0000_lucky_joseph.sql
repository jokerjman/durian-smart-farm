CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`detail_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_farm_date_idx` ON `audit_logs` (`farm_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `finance_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`is_system` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `farm_members` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`plot_scope_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farm_members_farm_user_uq` ON `farm_members` (`farm_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `farm_members_user_idx` ON `farm_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `farms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`area_rai` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `farms_owner_idx` ON `farms` (`owner_id`);--> statement-breakpoint
CREATE TABLE `labor_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`work_item_id` text,
	`work_date` text NOT NULL,
	`pay_type` text NOT NULL,
	`quantity` real NOT NULL,
	`rate` real NOT NULL,
	`amount` real NOT NULL,
	`transaction_id` text,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plots` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`name` text NOT NULL,
	`area_rai` real,
	`geo_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `plots_farm_idx` ON `plots` (`farm_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`unit` text NOT NULL,
	`minimum_stock` real,
	`active` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_farm_sku_uq` ON `products` (`farm_id`,`sku`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text NOT NULL,
	`target_kg` real,
	`budget` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seasons_farm_idx` ON `seasons` (`farm_id`);--> statement-breakpoint
CREATE TABLE `stock_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`lot_no` text,
	`expires_on` text,
	`unit_cost` real NOT NULL,
	`received_qty` real NOT NULL,
	`remaining_qty` real NOT NULL,
	`supplier` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_lots_product_expiry_idx` ON `stock_lots` (`product_id`,`expires_on`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`lot_id` text NOT NULL,
	`work_item_id` text,
	`transaction_id` text,
	`plot_id` text,
	`season_id` text,
	`movement_type` text NOT NULL,
	`quantity` real NOT NULL,
	`occurred_at` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_movements_lot_date_idx` ON `stock_movements` (`lot_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`plot_id` text,
	`season_id` text,
	`category_id` text NOT NULL,
	`work_item_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`amount` real NOT NULL,
	`occurred_on` text NOT NULL,
	`receipt_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `finance_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_work_once_uq` ON `transactions` (`work_item_id`);--> statement-breakpoint
CREATE INDEX `transactions_scope_idx` ON `transactions` (`farm_id`,`season_id`,`occurred_on`);--> statement-breakpoint
CREATE TABLE `tree_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`event_type` text NOT NULL,
	`note` text,
	`photo_key` text,
	`event_at` integer NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tree_events_tree_date_idx` ON `tree_events` (`tree_id`,`event_at`);--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`durian_id` text NOT NULL,
	`plot_id` text NOT NULL,
	`variety` text NOT NULL,
	`planted_at` text,
	`status` text NOT NULL,
	`production_stage` text,
	`qr_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trees_durian_id_uq` ON `trees` (`durian_id`);--> statement-breakpoint
CREATE INDEX `trees_plot_idx` ON `trees` (`plot_id`);--> statement-breakpoint
CREATE TABLE `user_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`plot_scope_id` text,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invitations_farm_email_idx` ON `user_invitations` (`farm_id`,`email`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`plot_id` text,
	`tree_id` text,
	`season_id` text,
	`title` text NOT NULL,
	`work_type` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_at` integer,
	`assignee_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `work_schedule_idx` ON `work_items` (`farm_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`name` text NOT NULL,
	`pay_type` text NOT NULL,
	`default_rate` real,
	`active` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action
);
