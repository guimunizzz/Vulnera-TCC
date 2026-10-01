-- AlterTable
ALTER TABLE `Vulnerability` ADD COLUMN `slaDueAt` DATETIME(3) NULL,
    ADD COLUMN `slaPausedMs` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `slaPolicyId` VARCHAR(191) NULL,
    ADD COLUMN `slaStartedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `SlaPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `criticalDays` INTEGER NOT NULL DEFAULT 2,
    `highDays` INTEGER NOT NULL DEFAULT 7,
    `mediumDays` INTEGER NOT NULL DEFAULT 30,
    `lowDays` INTEGER NOT NULL DEFAULT 90,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SlaPolicy_companyId_isActive_idx`(`companyId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Vulnerability_companyId_slaDueAt_idx` ON `Vulnerability`(`companyId`, `slaDueAt`);

-- AddForeignKey
ALTER TABLE `SlaPolicy` ADD CONSTRAINT `SlaPolicy_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
