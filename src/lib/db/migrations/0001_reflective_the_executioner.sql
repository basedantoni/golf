CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round_holes` (
	`round_id` text NOT NULL,
	`hole_number` integer NOT NULL,
	`strokes` integer NOT NULL,
	PRIMARY KEY(`round_id`, `hole_number`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_round_holes_round_id` ON `round_holes` (`round_id`);--> statement-breakpoint
CREATE TABLE `round_recommended_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` text NOT NULL,
	`type` text NOT NULL,
	`no_stats` integer DEFAULT false,
	`value` real,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recommended_stats_round_id` ON `round_recommended_stats` (`round_id`);--> statement-breakpoint
CREATE TABLE `round_stats` (
	`round_id` text PRIMARY KEY NOT NULL,
	`aces` integer DEFAULT 0,
	`double_eagle_or_better` integer DEFAULT 0,
	`eagles` integer DEFAULT 0,
	`birdies` integer DEFAULT 0,
	`pars` integer DEFAULT 0,
	`bogeys` integer DEFAULT 0,
	`double_bogey_or_worse` integer DEFAULT 0,
	`fairway_lefts` integer DEFAULT 0,
	`fairway_middles` integer DEFAULT 0,
	`fairway_rights` integer DEFAULT 0,
	`fairway_shorts` integer DEFAULT 0,
	`fairway_longs` integer DEFAULT 0,
	`fairway_hole_count` integer DEFAULT 0,
	`gir` integer DEFAULT 0,
	`gir_lefts` integer DEFAULT 0,
	`gir_rights` integer DEFAULT 0,
	`gir_shorts` integer DEFAULT 0,
	`gir_longs` integer DEFAULT 0,
	`gir_no_chances` integer DEFAULT 0,
	`gir_hole_count` integer DEFAULT 0,
	`putts` integer DEFAULT 0,
	`putt_hole_count` integer DEFAULT 0,
	`stroke_gain_overall` integer DEFAULT 100,
	`stroke_gain_tee_to_green` integer DEFAULT 100,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`club_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`score` integer NOT NULL,
	`strokes` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rounds_user_id` ON `rounds` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_rounds_club_id` ON `rounds` (`club_id`);--> statement-breakpoint
CREATE INDEX `idx_rounds_timestamp` ON `rounds` (`timestamp`);--> statement-breakpoint
CREATE TABLE `user_followed_clubs` (
	`user_id` text NOT NULL,
	`club_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `club_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_played_clubs` (
	`user_id` text NOT NULL,
	`club_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `club_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_posted_in_clubs` (
	`user_id` text NOT NULL,
	`club_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `club_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
