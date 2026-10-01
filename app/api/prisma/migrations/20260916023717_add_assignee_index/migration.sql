-- CreateIndex
CREATE INDEX `Vulnerability_companyId_assignedTo_status_idx` ON `Vulnerability`(`companyId`, `assignedTo`, `status`);

-- RenameIndex
ALTER TABLE `Vulnerability` RENAME INDEX `Vulnerability_assignedTo_fkey` TO `Vulnerability_assignedTo_idx`;
