CREATE TABLE `purchase_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`product_id` text NOT NULL,
	`lot_id` text NOT NULL,
	`package_qty` real NOT NULL,
	`package_size` real NOT NULL,
	`package_unit` text NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchase_receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lot_id`) REFERENCES `stock_lots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchase_lines_purchase_idx` ON `purchase_lines` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `purchase_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`supplier` text NOT NULL,
	`invoice_no` text,
	`purchased_on` text NOT NULL,
	`subtotal` real NOT NULL,
	`discount` real NOT NULL,
	`total_amount` real NOT NULL,
	`transaction_id` text NOT NULL,
	`receipt_key` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_receipts_transaction_uq` ON `purchase_receipts` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `purchase_receipts_farm_date_idx` ON `purchase_receipts` (`farm_id`,`purchased_on`);--> statement-breakpoint
ALTER TABLE `products` ADD `brand` text;--> statement-breakpoint
ALTER TABLE `products` ADD `common_name` text;--> statement-breakpoint
ALTER TABLE `products` ADD `formulation` text;--> statement-breakpoint
ALTER TABLE `products` ADD `registration_no` text;--> statement-breakpoint
ALTER TABLE `products` ADD `package_size` real;--> statement-breakpoint
ALTER TABLE `products` ADD `package_unit` text;--> statement-breakpoint
ALTER TABLE `products` ADD `default_rate_per_200l` real;--> statement-breakpoint
ALTER TABLE `products` ADD `rate_unit` text;