CREATE TABLE `plant_health_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`plot_id` text,
	`tree_id` text,
	`observation_type` text NOT NULL,
	`severity` text NOT NULL,
	`symptom` text NOT NULL,
	`note` text,
	`photo_key` text,
	`status` text NOT NULL,
	`observed_by` text NOT NULL,
	`observed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`observed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `health_observations_farm_status_idx` ON `plant_health_observations` (`farm_id`,`status`);--> statement-breakpoint
CREATE TABLE `sensor_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`plot_id` text,
	`name` text NOT NULL,
	`device_type` text NOT NULL,
	`unit` text NOT NULL,
	`status` text NOT NULL,
	`last_seen_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sensor_devices_farm_idx` ON `sensor_devices` (`farm_id`);--> statement-breakpoint
CREATE TABLE `sensor_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`value` real NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `sensor_devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sensor_readings_device_date_idx` ON `sensor_readings` (`device_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `smart_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`plot_id` text,
	`alert_type` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`recommended_action` text,
	`status` text NOT NULL,
	`triggered_at` integer NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plot_id`) REFERENCES `plots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `smart_alerts_farm_status_idx` ON `smart_alerts` (`farm_id`,`status`);