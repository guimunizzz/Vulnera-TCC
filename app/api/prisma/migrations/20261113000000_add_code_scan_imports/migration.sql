-- AlterTable
ALTER TABLE `Vulnerability` ADD COLUMN `sourceCodeFindingId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CodeScanImport` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `format` VARCHAR(16) NOT NULL,
    `toolName` VARCHAR(100) NOT NULL,
    `toolVersion` VARCHAR(64) NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `previousImportId` VARCHAR(191) NULL,
    `totalFindings` INTEGER NOT NULL DEFAULT 0,
    `newFindings` INTEGER NOT NULL DEFAULT 0,
    `persistedFindings` INTEGER NOT NULL DEFAULT 0,
    `resolvedFindings` INTEGER NOT NULL DEFAULT 0,
    `componentsCount` INTEGER NULL,
    `warningMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CodeScanImport_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `CodeScanImport_companyId_idx`(`companyId`),
    INDEX `CodeScanImport_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CodeFinding` (
    `id` VARCHAR(191) NOT NULL,
    `importId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(64) NOT NULL,
    `category` VARCHAR(8) NOT NULL,
    `ruleId` VARCHAR(255) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `severity` VARCHAR(16) NOT NULL,
    `cweId` VARCHAR(32) NULL,
    `filePath` TEXT NULL,
    `startLine` INTEGER NULL,
    `endLine` INTEGER NULL,
    `snippet` TEXT NULL,
    `packageName` VARCHAR(500) NULL,
    `packageVersion` VARCHAR(128) NULL,
    `purl` TEXT NULL,
    `fixedVersion` VARCHAR(255) NULL,
    `advisoryId` VARCHAR(64) NULL,
    `cvssScore` DOUBLE NULL,
    `cvssVector` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `recommendation` TEXT NULL,
    `helpUri` TEXT NULL,
    `triageStatus` ENUM('NEW', 'CONFIRMED', 'FALSE_POSITIVE', 'ACCEPTED_RISK') NOT NULL DEFAULT 'NEW',
    `triageNote` TEXT NULL,
    `triagedById` VARCHAR(191) NULL,
    `triagedAt` DATETIME(3) NULL,
    `triageInherited` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CodeFinding_projectId_fingerprint_idx`(`projectId`, `fingerprint`),
    INDEX `CodeFinding_importId_triageStatus_idx`(`importId`, `triageStatus`),
    INDEX `CodeFinding_importId_severity_idx`(`importId`, `severity`),
    UNIQUE INDEX `CodeFinding_importId_fingerprint_key`(`importId`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Vulnerability_sourceCodeFindingId_key` ON `Vulnerability`(`sourceCodeFindingId`);

-- AddForeignKey
ALTER TABLE `Vulnerability` ADD CONSTRAINT `Vulnerability_sourceCodeFindingId_fkey` FOREIGN KEY (`sourceCodeFindingId`) REFERENCES `CodeFinding`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CodeScanImport` ADD CONSTRAINT `CodeScanImport_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CodeScanImport` ADD CONSTRAINT `CodeScanImport_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CodeFinding` ADD CONSTRAINT `CodeFinding_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `CodeScanImport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CodeFinding` ADD CONSTRAINT `CodeFinding_triagedById_fkey` FOREIGN KEY (`triagedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

