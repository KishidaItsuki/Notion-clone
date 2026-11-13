CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`page_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_page_idx` ON `favorites` (`user_id`,`page_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'page' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`icon` text,
	`content` text DEFAULT '[]' NOT NULL,
	`plain_text` text DEFAULT '' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`parent_id` text,
	`database_id` text,
	`properties` text DEFAULT '[]' NOT NULL,
	`view_config` text DEFAULT '{}' NOT NULL,
	`values` text DEFAULT '{}' NOT NULL,
	`deleted_at` integer,
	`trash_root_id` text,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`database_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pages_parent_idx` ON `pages` (`parent_id`);--> statement-breakpoint
CREATE INDEX `pages_database_idx` ON `pages` (`database_id`);--> statement-breakpoint
CREATE INDEX `pages_deleted_idx` ON `pages` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text DEFAULT '' NOT NULL,
	`google_sub` text,
	`avatar_url` text,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by_id` text,
	`approved_at` integer,
	`last_login_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_idx` ON `users` (`google_sub`);