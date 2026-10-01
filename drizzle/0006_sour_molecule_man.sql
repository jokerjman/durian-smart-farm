CREATE TABLE `farm_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`site_name` text NOT NULL,
	`mascot_name` text NOT NULL,
	`owner_name` text,
	`timezone` text NOT NULL,
	`date_format` text NOT NULL,
	`currency` text NOT NULL,
	`area_unit` text NOT NULL,
	`weight_unit` text NOT NULL,
	`volume_unit` text NOT NULL,
	`default_tank_liters` real NOT NULL,
	`farm_code_prefix` text NOT NULL,
	`plot_code_prefix` text NOT NULL,
	`tree_code_prefix` text NOT NULL,
	`custom_categories_json` text,
	`custom_units_json` text,
	`logo_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `farm_settings_farm_uq` ON `farm_settings` (`farm_id`);