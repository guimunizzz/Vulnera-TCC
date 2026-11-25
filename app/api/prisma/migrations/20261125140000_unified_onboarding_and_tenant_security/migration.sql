-- Acrescenta revogação de identidade, condições da adesão e convites empresariais.
-- O onboarding anterior fica disponível apenas para clientes elegíveis já existentes.
ALTER TABLE `User`
    ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `legacyOnboardingAllowed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;

UPDATE `User`
SET `legacyOnboardingAllowed` = true
WHERE `role` = 'CLIENT' AND `companyId` IS NULL;

CREATE TABLE `AccessRequestEnrollment` (
    `accessRequestId` VARCHAR(191) NOT NULL,
    `companyCnpj` VARCHAR(14) NULL,
    `planId` VARCHAR(191) NOT NULL,
    `planName` VARCHAR(191) NOT NULL,
    `planPrice` DECIMAL(10, 2) NOT NULL,
    `planMaxApplications` INTEGER NOT NULL,
    `planMaxProjects` INTEGER NOT NULL,
    `planIncludesRemediation` BOOLEAN NOT NULL,
    INDEX `AccessRequestEnrollment_planId_idx`(`planId`),
    PRIMARY KEY (`accessRequestId`),
    CONSTRAINT `AccessRequestEnrollment_accessRequestId_fkey`
        FOREIGN KEY (`accessRequestId`) REFERENCES `AccessRequest`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `AccessRequestEnrollment_planId_fkey`
        FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CompanyInvitation` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `issuerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `activeEmail` VARCHAR(191) NULL,
    `tokenHash` CHAR(64) COLLATE utf8mb4_bin NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    UNIQUE INDEX `CompanyInvitation_tokenHash_key`(`tokenHash`),
    INDEX `CompanyInvitation_companyId_issuedAt_idx`(`companyId`, `issuedAt`),
    INDEX `CompanyInvitation_issuerId_idx`(`issuerId`),
    UNIQUE INDEX `CompanyInvitation_companyId_activeEmail_key`(`companyId`, `activeEmail`),
    PRIMARY KEY (`id`),
    CONSTRAINT `CompanyInvitation_companyId_fkey`
        FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `CompanyInvitation_issuerId_fkey`
        FOREIGN KEY (`issuerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `CompanyInvitation_valid_window` CHECK (`expiresAt` > `issuedAt`),
    CONSTRAINT `CompanyInvitation_terminal_state` CHECK (`usedAt` IS NULL OR `revokedAt` IS NULL),
    CONSTRAINT `CompanyInvitation_active_slot` CHECK (
        `activeEmail` IS NULL OR (`activeEmail` = `email` AND `usedAt` IS NULL AND `revokedAt` IS NULL)
    )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
