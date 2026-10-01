-- CreateTable
CREATE TABLE `RiskAcceptance` (
    `id` VARCHAR(191) NOT NULL,
    `vulnerabilityId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `reason` TEXT NOT NULL,
    `businessJustification` TEXT NOT NULL,
    `compensatingControls` TEXT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestedExpiresAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedById` VARCHAR(191) NULL,
    `revokeReason` TEXT NULL,
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RiskAcceptance_vulnerabilityId_idx`(`vulnerabilityId`),
    INDEX `RiskAcceptance_companyId_status_idx`(`companyId`, `status`),
    INDEX `RiskAcceptance_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RiskAcceptance` ADD CONSTRAINT `RiskAcceptance_vulnerabilityId_fkey` FOREIGN KEY (`vulnerabilityId`) REFERENCES `Vulnerability`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiskAcceptance` ADD CONSTRAINT `RiskAcceptance_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiskAcceptance` ADD CONSTRAINT `RiskAcceptance_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiskAcceptance` ADD CONSTRAINT `RiskAcceptance_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
