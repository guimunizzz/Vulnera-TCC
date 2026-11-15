-- AlterTable
ALTER TABLE `DastFinding` ADD COLUMN `cveId` VARCHAR(32) NULL,
    ADD COLUMN `cvssScore` DOUBLE NULL,
    ADD COLUMN `cvssVector` VARCHAR(255) NULL,
    ADD COLUMN `cvssVersion` VARCHAR(8) NULL;

-- CreateTable
CREATE TABLE `DastObservedAsset` (
    `id` VARCHAR(191) NOT NULL,
    `scanId` VARCHAR(191) NOT NULL,
    `kind` ENUM('IP', 'PORT', 'TECHNOLOGY', 'SUBDOMAIN') NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `parentValue` VARCHAR(255) NULL,
    `sensorKey` VARCHAR(32) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DastObservedAsset_scanId_kind_value_key`(`scanId`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CveRecord` (
    `id` VARCHAR(32) NOT NULL,
    `description` TEXT NULL,
    `cvssScore` DOUBLE NULL,
    `cvssVersion` VARCHAR(8) NULL,
    `cvssVector` VARCHAR(255) NULL,
    `cweId` VARCHAR(32) NULL,
    `publishedAt` DATETIME(3) NULL,
    `references` JSON NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DastObservedAsset` ADD CONSTRAINT `DastObservedAsset_scanId_fkey` FOREIGN KEY (`scanId`) REFERENCES `DastScan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
