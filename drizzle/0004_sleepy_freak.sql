CREATE TABLE `formation_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`formations` json,
	`offensiveFormations` json,
	`defensiveFormations` json,
	`predictions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `formation_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `highlight_reels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`clips` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `highlight_reels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mistake_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`plays` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mistake_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `presnap_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`reads` json,
	`coverageTypes` json,
	`blitzTendencies` json,
	`drilQuestions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `presnap_reads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `turnover_predictors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`plays` json,
	`riskSummary` json,
	`historicalData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `turnover_predictors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `analysisStage` varchar(64);