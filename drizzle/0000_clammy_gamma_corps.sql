CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`storage_key` text,
	`size` integer DEFAULT 0 NOT NULL,
	`content` text,
	`source_node_id` text,
	`source_node_run_id` text,
	`pipeline_run_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `node_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`error` text,
	`logs` text DEFAULT '[]',
	`retry_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`pipeline_run_id`) REFERENCES `pipeline_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `pipeline_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pipeline_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`source_port_name` text NOT NULL,
	`target_node_id` text NOT NULL,
	`target_port_name` text NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `pipeline_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `pipeline_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pipeline_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`adapter_id` text NOT NULL,
	`config` text DEFAULT '{}',
	`position_x` integer DEFAULT 0 NOT NULL,
	`position_y` integer DEFAULT 0 NOT NULL,
	`label` text DEFAULT '',
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
