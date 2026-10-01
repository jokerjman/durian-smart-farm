ALTER TABLE `farms` ADD `code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `farms_code_uq` ON `farms` (`code`);--> statement-breakpoint
ALTER TABLE `plots` ADD `code` text;--> statement-breakpoint
ALTER TABLE `plots` ADD `note` text;--> statement-breakpoint
CREATE UNIQUE INDEX `plots_farm_code_uq` ON `plots` (`farm_id`,`code`);--> statement-breakpoint
ALTER TABLE `trees` ADD `photo_key` text;--> statement-breakpoint
ALTER TABLE `trees` ADD `note` text;