ALTER TABLE `live_game_sessions` MODIFY COLUMN `analysisIntervalSeconds` int NOT NULL DEFAULT 5;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `teamPhase` enum('offense','defense','special_teams','transition','unclear') DEFAULT 'unclear' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `phaseReason` text;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `offenseInsights` json;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `defenseInsights` json;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `impactPlayers` json;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `keyMatchups` json;--> statement-breakpoint
ALTER TABLE `live_analysis_events` ADD `latencyMs` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `live_game_sessions` ADD `gameMemory` json;--> statement-breakpoint
ALTER TABLE `live_game_sessions` MODIFY `analysisIntervalSeconds` int DEFAULT 5 NOT NULL;
