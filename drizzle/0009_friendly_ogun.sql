ALTER TABLE `labor_entries` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `labor_entries` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `labor_entries_transaction_uq` ON `labor_entries` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `labor_entries_worker_date_idx` ON `labor_entries` (`worker_id`,`work_date`);--> statement-breakpoint
ALTER TABLE `work_items` ADD `description` text;--> statement-breakpoint
ALTER TABLE `work_items` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `work_items` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `work_items` ADD `tank_liters` real;--> statement-breakpoint
ALTER TABLE `work_items` ADD `tank_count` real;--> statement-breakpoint
ALTER TABLE `work_items` ADD `actual_tank_count` real;--> statement-breakpoint
ALTER TABLE `work_material_plans` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `work_material_plans` ADD `common_name` text;--> statement-breakpoint
ALTER TABLE `work_material_plans` ADD `actual_quantity` real;
