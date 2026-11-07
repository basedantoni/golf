CREATE TABLE `course_holes` (
	`club_id` text NOT NULL,
	`hole_number` integer NOT NULL,
	`par` integer,
	`variant_pars` text,
	PRIMARY KEY(`club_id`, `hole_number`),
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `round_holes` ADD `putts` integer;--> statement-breakpoint
ALTER TABLE `round_holes` ADD `fairway` text;--> statement-breakpoint
ALTER TABLE `round_holes` ADD `gir` text;