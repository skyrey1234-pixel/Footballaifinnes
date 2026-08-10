CREATE TABLE `blocking_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`grades` json,
	`schemeConsistency` json,
	`pressureAllowed` json,
	`runFitAnalysis` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocking_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gap_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`gapAssignments` json,
	`blitzPackages` json,
	`runFitBreakdowns` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gap_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `heat_map_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`preSnapHeatMaps` json,
	`routeHeatMaps` json,
	`alignmentTendencies` json,
	`motionTracking` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `heat_map_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `injury_impact_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`keyPlayers` json,
	`vulnerabilityWindows` json,
	`depthChart` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `injury_impact_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `momentum_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`momentumGraph` json,
	`swingMoments` json,
	`emotionalIndicators` json,
	`comebackAnalysis` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `momentum_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `penalty_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`penalties` json,
	`patterns` json,
	`costAnalysis` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `penalty_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`comparisons` json,
	`matchupAdvantages` json,
	`overallAssessment` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `red_zone_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`efficiency` json,
	`goalLine` json,
	`tendencies` json,
	`scoringBreakdown` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `red_zone_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `route_tree_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`routes` json,
	`timingAnalysis` json,
	`effectivenessRatings` json,
	`routeTree` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `route_tree_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `situational_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`downAndDistance` json,
	`scoreDifferential` json,
	`fieldPosition` json,
	`timeRemaining` json,
	`predictiveModel` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `situational_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `third_down_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`conversionRate` json,
	`byDistance` json,
	`playCallingPatterns` json,
	`defensiveTendencies` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `third_down_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `two_minute_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`drillEfficiency` json,
	`playSelection` json,
	`timeoutManagement` json,
	`clutchPerformance` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `two_minute_analytics_id` PRIMARY KEY(`id`)
);
