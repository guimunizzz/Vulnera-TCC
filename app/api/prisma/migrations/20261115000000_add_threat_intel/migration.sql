-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `link` VARCHAR(512) NULL;

-- AlterTable
ALTER TABLE `Vulnerability` ADD COLUMN `sourceThreatMatchId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TechAsset` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `ecosystem` VARCHAR(32) NULL,
    `packageName` VARCHAR(255) NULL,
    `cpePart` VARCHAR(1) NULL,
    `cpeVendor` VARCHAR(128) NULL,
    `cpeProduct` VARCHAR(128) NULL,
    `version` VARCHAR(64) NULL,
    `displayName` VARCHAR(255) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'CONFIRMED',
    `source` VARCHAR(16) NOT NULL,
    `sourceRef` VARCHAR(64) NULL,
    `identityKey` VARCHAR(400) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TechAsset_companyId_status_idx`(`companyId`, `status`),
    INDEX `TechAsset_status_kind_idx`(`status`, `kind`),
    UNIQUE INDEX `TechAsset_companyId_identityKey_key`(`companyId`, `identityKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreatAdvisory` (
    `id` VARCHAR(64) NOT NULL,
    `aliases` JSON NULL,
    `source` VARCHAR(16) NOT NULL,
    `title` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `cvssScore` DOUBLE NULL,
    `cvssVersion` VARCHAR(8) NULL,
    `cvssVector` VARCHAR(255) NULL,
    `severity` VARCHAR(16) NULL,
    `cweId` VARCHAR(32) NULL,
    `publishedAt` DATETIME(3) NULL,
    `modifiedAt` DATETIME(3) NULL,
    `references` JSON NULL,
    `kev` BOOLEAN NOT NULL DEFAULT false,
    `kevAddedAt` DATETIME(3) NULL,
    `kevDueDate` DATETIME(3) NULL,
    `kevRansomware` BOOLEAN NOT NULL DEFAULT false,
    `epssScore` DOUBLE NULL,
    `epssPercentile` DOUBLE NULL,
    `epssAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ThreatAdvisory_publishedAt_idx`(`publishedAt`),
    INDEX `ThreatAdvisory_kev_kevAddedAt_idx`(`kev`, `kevAddedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreatMatch` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `advisoryId` VARCHAR(64) NOT NULL,
    `versionConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `preexisting` BOOLEAN NOT NULL DEFAULT false,
    `fixedVersion` VARCHAR(128) NULL,
    `triageStatus` ENUM('NEW', 'CONFIRMED', 'FALSE_POSITIVE', 'ACCEPTED_RISK') NOT NULL DEFAULT 'NEW',
    `triageNote` TEXT NULL,
    `triagedById` VARCHAR(191) NULL,
    `triagedAt` DATETIME(3) NULL,
    `notifiedAt` DATETIME(3) NULL,
    `kevNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ThreatMatch_companyId_triageStatus_idx`(`companyId`, `triageStatus`),
    INDEX `ThreatMatch_advisoryId_idx`(`advisoryId`),
    UNIQUE INDEX `ThreatMatch_assetId_advisoryId_key`(`assetId`, `advisoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreatSyncRun` (
    `id` VARCHAR(191) NOT NULL,
    `trigger` VARCHAR(16) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `sources` JSON NULL,
    `newAdvisories` INTEGER NOT NULL DEFAULT 0,
    `newMatches` INTEGER NOT NULL DEFAULT 0,
    `notifications` INTEGER NOT NULL DEFAULT 0,
    `errorMessage` TEXT NULL,

    INDEX `ThreatSyncRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Vulnerability_sourceThreatMatchId_key` ON `Vulnerability`(`sourceThreatMatchId`);

-- AddForeignKey
ALTER TABLE `Vulnerability` ADD CONSTRAINT `Vulnerability_sourceThreatMatchId_fkey` FOREIGN KEY (`sourceThreatMatchId`) REFERENCES `ThreatMatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TechAsset` ADD CONSTRAINT `TechAsset_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TechAsset` ADD CONSTRAINT `TechAsset_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreatMatch` ADD CONSTRAINT `ThreatMatch_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreatMatch` ADD CONSTRAINT `ThreatMatch_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `TechAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreatMatch` ADD CONSTRAINT `ThreatMatch_advisoryId_fkey` FOREIGN KEY (`advisoryId`) REFERENCES `ThreatAdvisory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreatMatch` ADD CONSTRAINT `ThreatMatch_triagedById_fkey` FOREIGN KEY (`triagedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

