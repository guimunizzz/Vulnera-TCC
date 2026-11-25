-- Permite encerrar uma adesão incompatível após a aprovação, com motivo obrigatório.
-- As transições históricas continuam válidas e nenhum dado existente é alterado.
ALTER TABLE `AccessRequestEvent`
  DROP CHECK `AccessRequestEvent_transition_check`,
  ADD CONSTRAINT `AccessRequestEvent_transition_check` CHECK (
    (
      CAST(`eventType` AS BINARY) = 'STATUS_TRANSITION'
      AND (
        (`fromStatus` IS NULL AND CAST(`toStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION' AND `actorId` IS NULL AND `reason` IS NULL)
        OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION'
          AND CAST(`toStatus` AS BINARY) = 'PENDING_REVIEW' AND `actorId` IS NULL AND `reason` IS NULL)
        OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_REVIEW'
          AND CAST(`toStatus` AS BINARY) = 'APPROVED' AND `actorId` IS NOT NULL AND `reason` IS NULL)
        OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'PENDING_REVIEW'
          AND CAST(`toStatus` AS BINARY) = 'REJECTED' AND `actorId` IS NOT NULL)
        OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'APPROVED'
          AND CAST(`toStatus` AS BINARY) = 'REJECTED' AND `actorId` IS NOT NULL
          AND `reason` IS NOT NULL AND CHAR_LENGTH(TRIM(`reason`)) > 0)
        OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_REVIEW', 'APPROVED')
          AND CAST(`toStatus` AS BINARY) = 'EXPIRED' AND `actorId` IS NULL AND `reason` IS NULL)
        OR (`fromStatus` IS NOT NULL AND CAST(`fromStatus` AS BINARY) = 'APPROVED'
          AND CAST(`toStatus` AS BINARY) = 'ACTIVATED' AND `actorId` IS NULL AND `reason` IS NULL)
      )
    )
    OR (
      CAST(`eventType` AS BINARY) IN ('VERIFICATION_ISSUED', 'VERIFICATION_REISSUED', 'VERIFICATION_DELIVERY_FAILED')
      AND `fromStatus` IS NOT NULL
      AND CAST(`fromStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION'
      AND CAST(`toStatus` AS BINARY) = 'PENDING_EMAIL_VERIFICATION'
      AND `actorId` IS NULL
      AND `reason` IS NULL
    )
  );
