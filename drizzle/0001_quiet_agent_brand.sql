CREATE TABLE `game_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`opponentName` varchar(255) NOT NULL,
	`gameDate` varchar(32),
	`sourceType` enum('youtube','upload') NOT NULL,
	`youtubeVideoId` varchar(64),
	`videoUrl` text,
	`videoFileKey` text,
	`status` enum('analyzing','complete','failed') NOT NULL DEFAULT 'analyzing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scouting_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`executiveSummary` text,
	`offenseAnalysis` text,
	`defenseAnalysis` text,
	`specialSituations` text,
	`mistakes` text,
	`predictions` text,
	`highlights` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scouting_reports_id` PRIMARY KEY(`id`)
);
