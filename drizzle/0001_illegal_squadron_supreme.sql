CREATE TABLE `work_material_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`product_name` text NOT NULL,
	`product_kind` text NOT NULL,
	`rate_per_200l` real NOT NULL,
	`rate_unit` text NOT NULL,
	`tank_count` real NOT NULL,
	`planned_quantity` real NOT NULL,
	`stock_product_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stock_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `work_materials_work_idx` ON `work_material_plans` (`work_item_id`);