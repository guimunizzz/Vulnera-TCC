-- AlterTable
ALTER TABLE `Application` ADD COLUMN `businessOwner` VARCHAR(191) NULL,
    ADD COLUMN `criticality` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN `dataSensitivity` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    ADD COLUMN `internetFacing` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `technicalOwner` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Application_companyId_criticality_idx` ON `Application`(`companyId`, `criticality`);
