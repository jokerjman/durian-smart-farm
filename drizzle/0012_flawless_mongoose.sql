ALTER TABLE `products` ADD `package_count_unit` text;--> statement-breakpoint
ALTER TABLE `products` ADD `default_crop_stage` text;--> statement-breakpoint
ALTER TABLE `products` ADD `default_target_issue` text;--> statement-breakpoint
ALTER TABLE `products` ADD `phi_days` integer;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `package_count_unit` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `discount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `item_kind` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `trade_name` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `common_name` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `formulation` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `crop_stage` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `target_issue` text;--> statement-breakpoint
ALTER TABLE `purchase_lines` ADD `phi_days` integer;