-- CreateTable
CREATE TABLE `DastScan` (
    `id` VARCHAR(191) NOT NULL,
    `targetUrl` VARCHAR(2048) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `requestedById` VARCHAR(191) NOT NULL,
    `containerName` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `durationMs` INTEGER NULL,
    `errorMessage` TEXT NULL,
    `htmlReportPath` VARCHAR(191) NULL,
    `jsonReportPath` VARCHAR(191) NULL,
    `alertsHigh` INTEGER NOT NULL DEFAULT 0,
    `alertsMedium` INTEGER NOT NULL DEFAULT 0,
    `alertsLow` INTEGER NOT NULL DEFAULT 0,
    `alertsInfo` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DastScan_requestedById_idx`(`requestedById`),
    INDEX `DastScan_status_idx`(`status`),
    INDEX `DastScan_status_targetUrl_idx`(`status`, `targetUrl`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DastFinding` (
    `id` VARCHAR(191) NOT NULL,
    `scanId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `pluginId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `risk` ENUM('HIGH', 'MEDIUM', 'LOW', 'INFO') NOT NULL,
    `confidence` VARCHAR(191) NOT NULL,
    `cweId` VARCHAR(191) NULL,
    `wascId` VARCHAR(191) NULL,
    `url` TEXT NOT NULL,
    `normalizedUrl` TEXT NOT NULL,
    `param` VARCHAR(191) NULL,
    `evidence` TEXT NULL,
    `description` TEXT NULL,
    `solution` TEXT NULL,
    `reference` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DastFinding_scanId_idx`(`scanId`),
    INDEX `DastFinding_risk_idx`(`risk`),
    UNIQUE INDEX `DastFinding_scanId_fingerprint_key`(`scanId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DastScan` ADD CONSTRAINT `DastScan_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DastFinding` ADD CONSTRAINT `DastFinding_scanId_fkey` FOREIGN KEY (`scanId`) REFERENCES `DastScan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
