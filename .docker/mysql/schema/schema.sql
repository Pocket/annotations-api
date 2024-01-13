CREATE DATABASE IF NOT EXISTS `readitla_ril-tmp`;

USE `readitla_ril-tmp`;


SET GLOBAL explicit_defaults_for_timestamp = 0;

-- these are highlights
CREATE TABLE `user_annotations` (
  `annotation_id` varchar(50) COLLATE utf8mb4_bin NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `item_id` int(10) unsigned NOT NULL,
  `version` int(10) NOT NULL DEFAULT '1',
  `status` tinyint(3) unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `quote` mediumtext COLLATE utf8mb4_bin,
  `patch` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`annotation_id`),
  KEY `user_item_idx` (`user_id`,`item_id`),
  KEY `item_idx` (`item_id`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- table with a user's list
-- limiting only to necessary fields
CREATE TABLE IF NOT EXISTS `list` (
  `user_id` int(10) unsigned NOT NULL,
  `item_id` int(10) unsigned NOT NULL,
  `time_updated` datetime NOT NULL,
  `api_id_updated` mediumint(8) unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`item_id`),
  KEY `time_updated` (`time_updated`),
  KEY `api_id_updated` (`api_id_updated`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=8;

-- this table stores timestamps for changes to various entities
-- stores changes to highlights for this service
CREATE TABLE `users_meta` (
  `user_id` int(10) unsigned NOT NULL,
  `property` tinyint(3) unsigned NOT NULL,
  `value` text NOT NULL,
  `time_updated` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`property`,`time_updated`),
  KEY `property` (`property`),
  KEY `time_updated` (`time_updated`),
  KEY `updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
