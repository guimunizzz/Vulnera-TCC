-- Fundação de acesso da Issue #51: somente tabelas novas; preserva User e dados.
-- Consumida por prisma migrate deploy. CHECKs exigem MySQL >= 8.0.16 e não
-- são representáveis no schema Prisma: manter este SQL nas futuras migrations.
-- CreateTable
CREATE TABLE `AccessRequest` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `status` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
    `activeEmail` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccessRequest_activeEmail_key`(`activeEmail`),
    INDEX `AccessRequest_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `AccessRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `AccessRequest_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` VARCHAR(191) NOT NULL,
    `accessRequestId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) COLLATE utf8mb4_bin NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerificationToken_accessRequestId_key`(`accessRequestId`),
    UNIQUE INDEX `EmailVerificationToken_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessInvitation` (
    `id` VARCHAR(191) NOT NULL,
    `accessRequestId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) COLLATE utf8mb4_bin NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AccessInvitation_accessRequestId_key`(`accessRequestId`),
    UNIQUE INDEX `AccessInvitation_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessRequestEvent` (
    `id` VARCHAR(191) NOT NULL,
    `accessRequestId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `fromStatus` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `toStatus` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AccessRequestEvent_accessRequestId_createdAt_idx`(`accessRequestId`, `createdAt`),
    INDEX `AccessRequestEvent_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AccessRequest` ADD CONSTRAINT `AccessRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_accessRequestId_fkey` FOREIGN KEY (`accessRequestId`) REFERENCES `AccessRequest`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AccessInvitation` ADD CONSTRAINT `AccessInvitation_accessRequestId_fkey` FOREIGN KEY (`accessRequestId`) REFERENCES `AccessRequest`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AccessRequestEvent` ADD CONSTRAINT `AccessRequestEvent_accessRequestId_fkey` FOREIGN KEY (`accessRequestId`) REFERENCES `AccessRequest`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AccessRequestEvent` ADD CONSTRAINT `AccessRequestEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- NULL explícito em todos os ramos: CHECK também aceita UNKNOWN no MySQL.
ALTER TABLE `AccessRequest`
  ADD CONSTRAINT `AccessRequest_status_check` CHECK (
    CAST(`status` AS BINARY) IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')
  ),
  ADD CONSTRAINT `AccessRequest_email_check` CHECK (
    CHAR_LENGTH(`email`) > 0
    AND CAST(`email` AS BINARY) = CAST(LOWER(TRIM(`email`)) AS BINARY)
    AND NOT REGEXP_LIKE(`email`, '[[:space:]]')
  ),
  ADD CONSTRAINT `AccessRequest_active_email_check` CHECK (
    (`status` = 'REJECTED' AND `activeEmail` IS NULL)
    OR (`status` IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED')
      AND `activeEmail` IS NOT NULL
      AND CAST(`activeEmail` AS BINARY) = CAST(`email` AS BINARY))
  ),
  ADD CONSTRAINT `AccessRequest_verification_check` CHECK (
    (`status` = 'PENDING_EMAIL_VERIFICATION' AND `emailVerifiedAt` IS NULL)
    OR (`status` IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED') AND `emailVerifiedAt` IS NOT NULL)
  ),
  ADD CONSTRAINT `AccessRequest_review_check` CHECK (
    (`status` IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW')
      AND `reviewedAt` IS NULL AND `reviewedById` IS NULL AND `rejectionReason` IS NULL)
    OR (`status` = 'APPROVED' AND `reviewedAt` IS NOT NULL
      AND `reviewedById` IS NOT NULL AND `rejectionReason` IS NULL)
    OR (`status` = 'REJECTED' AND `reviewedAt` IS NOT NULL AND `reviewedById` IS NOT NULL)
  );

ALTER TABLE `EmailVerificationToken`
  ADD CONSTRAINT `EmailVerificationToken_hash_check` CHECK (REGEXP_LIKE(`tokenHash`, '^[0-9a-f]{64}$', 'c')),
  ADD CONSTRAINT `EmailVerificationToken_dates_check` CHECK (
    `expiresAt` > `createdAt`
    AND (`usedAt` IS NULL OR (`usedAt` >= `createdAt` AND `usedAt` < `expiresAt`))
  );

ALTER TABLE `AccessInvitation`
  ADD CONSTRAINT `AccessInvitation_hash_check` CHECK (REGEXP_LIKE(`tokenHash`, '^[0-9a-f]{64}$', 'c')),
  ADD CONSTRAINT `AccessInvitation_dates_check` CHECK (
    `expiresAt` > `createdAt`
    AND (`usedAt` IS NULL OR (`usedAt` >= `createdAt` AND `usedAt` < `expiresAt`))
  );

ALTER TABLE `AccessRequestEvent`
  ADD CONSTRAINT `AccessRequestEvent_transition_check` CHECK (
    (`fromStatus` IS NULL AND CAST(`toStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION'
      AND `actorId` IS NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION'
      AND CAST(`toStatus` AS BINARY) = 'PENDING_REVIEW' AND `actorId` IS NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_REVIEW'
      AND CAST(`toStatus` AS BINARY) = 'APPROVED' AND `actorId` IS NOT NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_REVIEW'
      AND CAST(`toStatus` AS BINARY) = 'REJECTED' AND `actorId` IS NOT NULL)
  );
