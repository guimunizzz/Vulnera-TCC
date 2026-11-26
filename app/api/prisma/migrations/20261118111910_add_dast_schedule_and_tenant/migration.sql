-- AlterTable
ALTER TABLE `Application` ADD COLUMN `dastAuthorizedAt` DATETIME(3) NULL,
    ADD COLUMN `dastAuthorizedById` VARCHAR(191) NULL,
    ADD COLUMN `dastAuthorizedHost` VARCHAR(255) NULL,
    ADD COLUMN `dastAuthorizedUntil` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `DastScan` ADD COLUMN `applicationId` VARCHAR(191) NULL,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `projectId` VARCHAR(191) NULL,
    ADD COLUMN `scheduleId` VARCHAR(191) NULL,
    ADD COLUMN `trigger` ENUM('MANUAL', 'SCHEDULED') NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE `ScanSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `mode` ENUM('REAL', 'SIMULATED') NOT NULL,
    `frequency` ENUM('DAILY', 'WEEKLY') NOT NULL,
    `hour` INTEGER NOT NULL,
    `minute` INTEGER NOT NULL,
    `dayOfWeek` INTEGER NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NOT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `lastScanId` VARCHAR(191) NULL,
    `lastOutcome` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScanSchedule_companyId_idx`(`companyId`),
    INDEX `ScanSchedule_applicationId_idx`(`applicationId`),
    INDEX `ScanSchedule_projectId_idx`(`projectId`),
    INDEX `ScanSchedule_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DastScan_companyId_idx` ON `DastScan`(`companyId`);

-- CreateIndex
CREATE INDEX `DastScan_applicationId_idx` ON `DastScan`(`applicationId`);

-- CreateIndex
CREATE INDEX `DastScan_projectId_idx` ON `DastScan`(`projectId`);

-- CreateIndex
CREATE INDEX `DastScan_scheduleId_idx` ON `DastScan`(`scheduleId`);

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_dastAuthorizedById_fkey` FOREIGN KEY (`dastAuthorizedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DastScan` ADD CONSTRAINT `DastScan_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DastScan` ADD CONSTRAINT `DastScan_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DastScan` ADD CONSTRAINT `DastScan_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DastScan` ADD CONSTRAINT `DastScan_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `ScanSchedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScanSchedule` ADD CONSTRAINT `ScanSchedule_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScanSchedule` ADD CONSTRAINT `ScanSchedule_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScanSchedule` ADD CONSTRAINT `ScanSchedule_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScanSchedule` ADD CONSTRAINT `ScanSchedule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
