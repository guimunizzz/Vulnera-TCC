-- AlterTable
ALTER TABLE `DastFinding` ADD COLUMN `sensorKey` VARCHAR(32) NOT NULL DEFAULT 'zap';

-- CreateTable
CREATE TABLE `DastSensorRun` (
    `id` VARCHAR(191) NOT NULL,
    `scanId` VARCHAR(191) NOT NULL,
    `sensorKey` VARCHAR(32) NOT NULL,
    `status` ENUM('OK', 'NO_DATA', 'NOT_APPLICABLE', 'UNAVAILABLE', 'ERROR') NOT NULL,
    `message` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NOT NULL,
    `durationMs` INTEGER NOT NULL,

    UNIQUE INDEX `DastSensorRun_scanId_sensorKey_key`(`scanId`, `sensorKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DastSensorRun` ADD CONSTRAINT `DastSensorRun_scanId_fkey` FOREIGN KEY (`scanId`) REFERENCES `DastScan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
