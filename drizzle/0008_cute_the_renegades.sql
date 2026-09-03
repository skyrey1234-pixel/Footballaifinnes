CREATE TABLE `advanced_analytics_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`module` varchar(64) NOT NULL,
	`status` enum('ready','insufficient','failed') NOT NULL DEFAULT 'ready',
	`summary` text,
	`confidence` int NOT NULL DEFAULT 0,
	`dataBasis` varchar(160) NOT NULL DEFAULT 'AI estimate from scouting-report evidence',
	`evidence` json,
	`missingInputs` json,
	`limitations` json,
	`coachVerified` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `advanced_analytics_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `analytics_run_session_module_unique` UNIQUE(`sessionId`,`module`)
);
