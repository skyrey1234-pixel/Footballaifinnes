CREATE TABLE `player_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`opponentName` varchar(255) NOT NULL,
	`playerNumber` varchar(10) NOT NULL,
	`playerName` varchar(255),
	`position` varchar(64),
	`tendencies` json,
	`strengths` text,
	`weaknesses` text,
	`threatLevel` enum('low','medium','high','elite') NOT NULL DEFAULT 'medium',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_profiles_id` PRIMARY KEY(`id`)
);
