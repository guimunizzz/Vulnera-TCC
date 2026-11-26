-- AlterTable
ALTER TABLE `ScanSchedule` ADD COLUMN `targetUrl` VARCHAR(2048) NULL,
    MODIFY `companyId` VARCHAR(191) NULL,
    MODIFY `applicationId` VARCHAR(191) NULL;
