CREATE TABLE `adjustment_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adjustmentId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityCase` int NOT NULL DEFAULT 0,
	`quantityUnit` int NOT NULL DEFAULT 0,
	`unitCostCase` decimal(10,2),
	`unitCostUnit` decimal(10,2),
	`fromCase` int DEFAULT 0,
	`toUnit` int DEFAULT 0,
	`fromUnit` int DEFAULT 0,
	`toCase` int DEFAULT 0,
	`note` text,
	CONSTRAINT `adjustment_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `adjustments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`type` enum('补出库','补入库','箱散转换') NOT NULL,
	`adjustmentDate` date NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reason` text,
	`createdById` int NOT NULL,
	`createdByName` varchar(128),
	`approvedById` int,
	`approvedByName` varchar(128),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adjustments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tableName` varchar(64) NOT NULL,
	`recordId` int NOT NULL,
	`action` enum('create','update','delete') NOT NULL,
	`oldValue` text,
	`newValue` text,
	`operatorId` int,
	`operatorName` varchar(128),
	`ipAddress` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`snapshotDate` date NOT NULL,
	`openingCase` int NOT NULL DEFAULT 0,
	`openingUnit` int NOT NULL DEFAULT 0,
	`openingCostCase` decimal(12,2) NOT NULL DEFAULT '0',
	`openingCostUnit` decimal(12,2) NOT NULL DEFAULT '0',
	`inboundCase` int NOT NULL DEFAULT 0,
	`inboundUnit` int NOT NULL DEFAULT 0,
	`inboundCostCase` decimal(12,2) NOT NULL DEFAULT '0',
	`inboundCostUnit` decimal(12,2) NOT NULL DEFAULT '0',
	`outboundCase` int NOT NULL DEFAULT 0,
	`outboundUnit` int NOT NULL DEFAULT 0,
	`outboundCostCase` decimal(12,2) NOT NULL DEFAULT '0',
	`outboundCostUnit` decimal(12,2) NOT NULL DEFAULT '0',
	`adjustmentCase` int NOT NULL DEFAULT 0,
	`adjustmentUnit` int NOT NULL DEFAULT 0,
	`adjustmentCostCase` decimal(12,2) NOT NULL DEFAULT '0',
	`adjustmentCostUnit` decimal(12,2) NOT NULL DEFAULT '0',
	`closingCase` int NOT NULL DEFAULT 0,
	`closingUnit` int NOT NULL DEFAULT 0,
	`closingCostCase` decimal(12,2) NOT NULL DEFAULT '0',
	`closingCostUnit` decimal(12,2) NOT NULL DEFAULT '0',
	`avgCostCase` decimal(10,2) NOT NULL DEFAULT '0',
	`avgCostUnit` decimal(10,2) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityCase` int NOT NULL DEFAULT 0,
	`quantityUnit` int NOT NULL DEFAULT 0,
	`totalCostCase` decimal(12,2) NOT NULL DEFAULT '0',
	`totalCostUnit` decimal(12,2) NOT NULL DEFAULT '0',
	`avgCostCase` decimal(10,2) NOT NULL DEFAULT '0',
	`avgCostUnit` decimal(10,2) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(256) NOT NULL,
	`barcode` varchar(64),
	`unitsPerCase` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`safetyStockCase` int NOT NULL DEFAULT 0,
	`safetyStockUnit` int NOT NULL DEFAULT 0,
	`category` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `stock_take_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stocktakeId` int NOT NULL,
	`productId` int NOT NULL,
	`systemCase` int NOT NULL DEFAULT 0,
	`systemUnit` int NOT NULL DEFAULT 0,
	`actualCase` int NOT NULL DEFAULT 0,
	`actualUnit` int NOT NULL DEFAULT 0,
	`diffCase` int NOT NULL DEFAULT 0,
	`diffUnit` int NOT NULL DEFAULT 0,
	`note` text,
	CONSTRAINT `stock_take_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_takes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`stocktakeDate` date NOT NULL,
	`month` varchar(7) NOT NULL,
	`status` enum('draft','completed') NOT NULL DEFAULT 'draft',
	`createdById` int NOT NULL,
	`createdByName` varchar(128),
	`completedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_takes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`address` text,
	`phone` varchar(32),
	`lineGroupId` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`type` enum('inbound','outbound','adjustment_in','adjustment_out','conversion','stocktake','cancel') NOT NULL,
	`quantityCase` int NOT NULL DEFAULT 0,
	`quantityUnit` int NOT NULL DEFAULT 0,
	`unitCostCase` decimal(10,2),
	`unitCostUnit` decimal(10,2),
	`totalCost` decimal(12,2),
	`businessDate` date NOT NULL,
	`transactionTime` timestamp NOT NULL DEFAULT (now()),
	`source` enum('web','line','system') NOT NULL DEFAULT 'web',
	`operatorId` int,
	`operatorName` varchar(128),
	`adjustmentId` int,
	`stocktakeId` int,
	`cancelledById` int,
	`cancelledTransactionId` int,
	`note` text,
	`isCancelled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','store_manager') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `storeId` int;