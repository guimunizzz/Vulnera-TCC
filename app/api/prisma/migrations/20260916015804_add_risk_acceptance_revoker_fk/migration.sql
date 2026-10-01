-- AddForeignKey
ALTER TABLE `RiskAcceptance` ADD CONSTRAINT `RiskAcceptance_revokedById_fkey` FOREIGN KEY (`revokedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
