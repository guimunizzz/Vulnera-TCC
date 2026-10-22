-- Etapa 1.1: upgrade incremental da fundação, sem reescrever migration anterior.
-- Consumido pelo Prisma Migrate; preserva pedidos, eventos, tokens e Users.
-- Colisões sob a collation de User abortam ANTES de qualquer DDL permanente.
CREATE TEMPORARY TABLE `_AccessRequestCollationCheck` (
  `email` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY
);
INSERT INTO `_AccessRequestCollationCheck` (`email`)
SELECT `activeEmail` FROM `AccessRequest` WHERE `activeEmail` IS NOT NULL;
DROP TEMPORARY TABLE `_AccessRequestCollationCheck`;

ALTER TABLE `AccessRequest`
  DROP CHECK `AccessRequest_status_check`,
  DROP CHECK `AccessRequest_email_check`,
  DROP CHECK `AccessRequest_active_email_check`,
  DROP CHECK `AccessRequest_verification_check`,
  DROP CHECK `AccessRequest_review_check`,
  MODIFY `email` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY `activeEmail` VARCHAR(191) COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN `expiresAt` DATETIME(3) NULL;

-- Só preenche a janela histórica: não expira nem remove registros silenciosamente.
UPDATE `AccessRequest` SET `expiresAt` = CASE
  WHEN `status` = 'PENDING_EMAIL_VERIFICATION' THEN DATE_ADD(`createdAt`, INTERVAL 7 DAY)
  WHEN `status` = 'APPROVED' THEN DATE_ADD(GREATEST(`createdAt`, `reviewedAt`), INTERVAL 7 DAY)
  ELSE DATE_ADD(GREATEST(`createdAt`, `emailVerifiedAt`), INTERVAL 30 DAY)
END;

ALTER TABLE `AccessRequest`
  MODIFY `expiresAt` DATETIME(3) NOT NULL,
  ADD INDEX `AccessRequest_status_expiresAt_idx` (`status`, `expiresAt`),
  ADD CONSTRAINT `AccessRequest_status_check` CHECK (
    CAST(`status` AS BINARY) IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'ACTIVATED')
  ),
  ADD CONSTRAINT `AccessRequest_email_check` CHECK (
    CHAR_LENGTH(`email`) > 0 AND CAST(`email` AS BINARY) = CAST(LOWER(TRIM(`email`)) AS BINARY)
    AND NOT REGEXP_LIKE(`email`, '[[:space:]]')
  ),
  ADD CONSTRAINT `AccessRequest_active_email_check` CHECK (
    (`status` IN ('REJECTED', 'EXPIRED', 'ACTIVATED') AND `activeEmail` IS NULL)
    OR (`status` IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED')
      AND `activeEmail` IS NOT NULL AND CAST(`activeEmail` AS BINARY) = CAST(`email` AS BINARY))
  ),
  ADD CONSTRAINT `AccessRequest_verification_check` CHECK (
    (`status` = 'PENDING_EMAIL_VERIFICATION' AND `emailVerifiedAt` IS NULL)
    OR (`status` IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVATED') AND `emailVerifiedAt` IS NOT NULL)
    OR (`status` = 'EXPIRED' AND (`reviewedAt` IS NULL OR `emailVerifiedAt` IS NOT NULL))
  ),
  ADD CONSTRAINT `AccessRequest_review_check` CHECK (
    (`status` IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW')
      AND `reviewedAt` IS NULL AND `reviewedById` IS NULL AND `rejectionReason` IS NULL)
    OR (`status` IN ('APPROVED', 'ACTIVATED') AND `reviewedAt` IS NOT NULL
      AND `reviewedById` IS NOT NULL AND `rejectionReason` IS NULL)
    OR (`status` = 'REJECTED' AND `reviewedAt` IS NOT NULL AND `reviewedById` IS NOT NULL)
    OR (`status` = 'EXPIRED' AND `rejectionReason` IS NULL
      AND ((`reviewedAt` IS NULL AND `reviewedById` IS NULL) OR (`reviewedAt` IS NOT NULL AND `reviewedById` IS NOT NULL)))
  ),
  ADD CONSTRAINT `AccessRequest_deadline_check` CHECK (
    `expiresAt` > `createdAt` AND (`status` <> 'EXPIRED' OR `updatedAt` >= `expiresAt`)
  );

ALTER TABLE `EmailVerificationToken`
  DROP CHECK `EmailVerificationToken_dates_check`,
  ADD COLUMN `revokedAt` DATETIME(3) NULL,
  ADD COLUMN `issuedAt` DATETIME(3) NULL;
UPDATE `EmailVerificationToken` SET `issuedAt` = `createdAt`;
ALTER TABLE `EmailVerificationToken`
  MODIFY `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD CONSTRAINT `EmailVerificationToken_dates_check` CHECK (
    `issuedAt` >= `createdAt` AND `expiresAt` > `issuedAt`
    AND (`usedAt` IS NULL OR (`usedAt` >= `issuedAt` AND `usedAt` < `expiresAt`))
    AND (`revokedAt` IS NULL OR `revokedAt` >= `issuedAt`)
    AND (`usedAt` IS NULL OR `revokedAt` IS NULL)
  );

ALTER TABLE `AccessInvitation`
  DROP CHECK `AccessInvitation_dates_check`,
  ADD COLUMN `revokedAt` DATETIME(3) NULL,
  ADD COLUMN `issuedAt` DATETIME(3) NULL;
UPDATE `AccessInvitation` SET `issuedAt` = `createdAt`;
ALTER TABLE `AccessInvitation`
  MODIFY `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD CONSTRAINT `AccessInvitation_dates_check` CHECK (
    `issuedAt` >= `createdAt` AND `expiresAt` > `issuedAt`
    AND (`usedAt` IS NULL OR (`usedAt` >= `issuedAt` AND `usedAt` < `expiresAt`))
    AND (`revokedAt` IS NULL OR `revokedAt` >= `issuedAt`)
    AND (`usedAt` IS NULL OR `revokedAt` IS NULL)
  );

ALTER TABLE `AccessRequestEvent`
  DROP CHECK `AccessRequestEvent_transition_check`,
  ADD CONSTRAINT `AccessRequestEvent_transition_check` CHECK (
    (`fromStatus` IS NULL AND CAST(`toStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION' AND `actorId` IS NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION'
      AND CAST(`toStatus` AS BINARY) = 'PENDING_REVIEW' AND `actorId` IS NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_REVIEW'
      AND CAST(`toStatus` AS BINARY) = 'APPROVED' AND `actorId` IS NOT NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_REVIEW'
      AND CAST(`toStatus` AS BINARY) = 'REJECTED' AND `actorId` IS NOT NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED')
      AND CAST(`toStatus` AS BINARY) = 'EXPIRED' AND `actorId` IS NULL AND `reason` IS NULL)
    OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'APPROVED'
      AND CAST(`toStatus` AS BINARY) = 'ACTIVATED' AND `actorId` IS NULL AND `reason` IS NULL)
  );
