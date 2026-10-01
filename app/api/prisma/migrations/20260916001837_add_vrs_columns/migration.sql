-- AlterTable
ALTER TABLE `Vulnerability` ADD COLUMN `vrsComputedAt` DATETIME(3) NULL,
    ADD COLUMN `vrsFactors` TEXT NULL,
    ADD COLUMN `vrsScore` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Vulnerability_companyId_status_vrsScore_idx` ON `Vulnerability`(`companyId`, `status`, `vrsScore`);
