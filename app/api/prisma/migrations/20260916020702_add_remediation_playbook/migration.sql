-- CreateTable
CREATE TABLE `RemediationPlaybook` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `owaspCategory` VARCHAR(191) NULL,
    `cweIds` TEXT NULL,
    `rootCause` TEXT NULL,
    `remediation` TEXT NULL,
    `validationSteps` TEXT NULL,
    `secureExample` TEXT NULL,
    `compensatingControls` TEXT NULL,
    `references` TEXT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'CUSTOM',
    `sourceUrl` VARCHAR(2048) NULL,
    `sourceVersion` VARCHAR(191) NULL,
    `sourceKey` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `companyId` VARCHAR(191) NULL,
    `clonedFromId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RemediationPlaybook_companyId_owaspCategory_idx`(`companyId`, `owaspCategory`),
    INDEX `RemediationPlaybook_isSystem_owaspCategory_idx`(`isSystem`, `owaspCategory`),
    UNIQUE INDEX `RemediationPlaybook_source_sourceKey_key`(`source`, `sourceKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RemediationPlaybook` ADD CONSTRAINT `RemediationPlaybook_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RemediationPlaybook` ADD CONSTRAINT `RemediationPlaybook_clonedFromId_fkey` FOREIGN KEY (`clonedFromId`) REFERENCES `RemediationPlaybook`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
