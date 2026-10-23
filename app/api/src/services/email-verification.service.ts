// Orquestra emissão, reenvio e confirmação de e-mail para pedidos de acesso.
// Mantém token, estado e histórico atômicos e só envia após o commit.
// Consumido futuramente pela camada HTTP de solicitação de acesso.

import { AccessRequestEntity } from "../models/access-request.model";
import type { EmailVerificationToken } from "../models/email-verification-token.model";
import type { EmailSender } from "../models/email.model";
import type { VerificationDeliveryResult } from "../models/email-verification.model";
import { accessTokenDeadline } from "../models/access-token.model";
import type {
  AccessRequestRepository,
  AccessRepositories,
} from "../repositories/access-request.repository";
import { generateAccessToken, hashAccessToken } from "../utils/access-token.util";
import { buildEmailVerificationMessage } from "../utils/email-verification-message.util";

type PreparedDelivery = {
  accessRequestId: string;
  to: string;
  name: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

type PreparationResult =
  | { kind: "RESULT"; result: "NOT_ELIGIBLE" | "CONFLICT" }
  | { kind: "PREPARED"; delivery: PreparedDelivery };

export class EmailVerificationService {
  constructor(
    private readonly requests: AccessRequestRepository,
    private readonly sender: EmailSender,
    private readonly publicWebUrl: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  issueVerification(id: string): Promise<VerificationDeliveryResult> {
    return this.deliver(id, false);
  }

  resendVerification(id: string): Promise<VerificationDeliveryResult> {
    return this.deliver(id, true);
  }

  /** Caminho público: issue/rotação com cooldown persistido no slot bloqueado. */
  requestVerification(id: string, cooldownMs: number): Promise<VerificationDeliveryResult> {
    if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 0) {
      throw new Error("INVALID_ACCESS_REQUEST_RESEND_COOLDOWN_MS");
    }
    return this.deliver(id, true, cooldownMs, true);
  }

  async confirmEmail(rawToken: string): Promise<boolean> {
    if (!isCanonicalVerificationToken(rawToken)) return false;
    const tokenHash = hashAccessToken(rawToken);

    return this.withPersistence(() => this.requests.transactionWithRetry(
      async ({ requests, verificationTokens }) => {
        // O hash encontra o pedido; o slot é relido com FOR UPDATE após travá-lo.
        const indexedToken = await verificationTokens.findByHash(tokenHash);
        if (!indexedToken) return false;

        const parent = await requests.findByIdForUpdate(indexedToken.accessRequestId);
        if (!parent) return false;

        const now = this.clock();
        if (parent.status !== "PENDING_EMAIL_VERIFICATION") return false;
        if (now.getTime() >= parent.expiresAt.getTime()) {
          const expiration = new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, now);
          if (!await requests.transitionIfCurrent(parent.id, expiration)) {
            throw new Error("ACCESS_VERIFICATION_TRANSITION_CONFLICT");
          }
          return false;
        }

        const currentToken = await verificationTokens.findByAccessRequestIdForUpdate(parent.id);
        if (!isCurrentUsableToken(currentToken, tokenHash, now)) return false;
        if (!await verificationTokens.consumeIfAvailable(tokenHash, now)) return false;

        const transition = new AccessRequestEntity(parent).transitionTo("PENDING_REVIEW", undefined, undefined, now);
        if (!await requests.transitionIfCurrent(parent.id, transition)) {
          // Obriga rollback do consumo se a transição não aconteceu.
          throw new Error("ACCESS_VERIFICATION_TRANSITION_CONFLICT");
        }
        return true;
      },
      false,
    ));
  }

  private async deliver(
    id: string,
    allowResend: boolean,
    cooldownMs?: number,
    retryTransaction = false,
  ): Promise<VerificationDeliveryResult> {
    const prepare = async ({ requests, verificationTokens }: AccessRepositories) => {
      const parent = await requests.findByIdForUpdate(id);
      if (!parent || parent.status !== "PENDING_EMAIL_VERIFICATION") {
        return { kind: "RESULT", result: "NOT_ELIGIBLE" } as const;
      }

      const now = this.clock();
      if (now.getTime() >= parent.expiresAt.getTime()) {
        const expiration = new AccessRequestEntity(parent).transitionTo("EXPIRED", undefined, undefined, now);
        if (!await requests.transitionIfCurrent(parent.id, expiration)) {
          throw new Error("ACCESS_VERIFICATION_TRANSITION_CONFLICT");
        }
        return { kind: "RESULT", result: "NOT_ELIGIBLE" } as const;
      }

      const currentToken = await verificationTokens.findByAccessRequestIdForUpdate(parent.id);
      if (allowResend && currentToken?.usedAt) {
        return { kind: "RESULT", result: "CONFLICT" } as const;
      }
      if (cooldownMs !== undefined && currentToken
        && currentToken.issuedAt.getTime() + cooldownMs > now.getTime()) {
        // issuedAt é consultado sob os locks do pedido e do slot: aliases e
        // chamadas simultâneas compartilham a mesma janela persistida.
        return { kind: "RESULT", result: "CONFLICT" } as const;
      }
      if (!allowResend && currentToken) {
        return { kind: "RESULT", result: "CONFLICT" } as const;
      }

      const { token, tokenHash } = generateAccessToken();
      const expiresAt = accessTokenDeadline("VERIFICATION", parent.expiresAt, now);
      if (currentToken) {
        // A rotação termina antes do SMTP; envios podem concluir fora de ordem,
        // mas só o hash atualmente guardado continua válido.
        const rotated = await verificationTokens.rotateIfAvailable({
          accessRequestId: parent.id,
          tokenHash,
          expiresAt,
          expectedTokenHash: currentToken.tokenHash,
          expectedRevokedAt: currentToken.revokedAt,
        }, now);
        if (!rotated) return { kind: "RESULT", result: "CONFLICT" } as const;
      } else {
        const created = await verificationTokens.createIfEligible({
          accessRequestId: parent.id,
          tokenHash,
          expiresAt,
        }, now);
        if (!created) return { kind: "RESULT", result: "CONFLICT" } as const;
      }

      await requests.createVerificationEvent(
        parent.id,
        currentToken ? "VERIFICATION_REISSUED" : "VERIFICATION_ISSUED",
        now,
      );

      return {
        kind: "PREPARED",
        delivery: {
          accessRequestId: parent.id,
          to: parent.email,
          name: parent.name,
          token,
          tokenHash,
          expiresAt,
        },
      } as const;
    };

    const preparation = await this.withPersistence<PreparationResult>(() => retryTransaction
      ? this.requests.transactionWithRetry(prepare, true)
      : this.requests.transaction(prepare));

    if (preparation.kind === "RESULT") return preparation.result;

    try {
      const message = buildEmailVerificationMessage({
        to: preparation.delivery.to,
        name: preparation.delivery.name,
        token: preparation.delivery.token,
        expiresAt: preparation.delivery.expiresAt,
      }, this.publicWebUrl);
      await this.sender.send(message);
      return "SENT";
    } catch {
      await this.invalidateFailedDelivery(preparation.delivery);
      return "DELIVERY_FAILED";
    }
  }

  private async invalidateFailedDelivery(delivery: PreparedDelivery): Promise<void> {
    try {
      await this.requests.transactionWithRetry(async ({ requests, verificationTokens }) => {
        const now = this.clock();
        const revoked = await verificationTokens.revokeIfAvailable({
          accessRequestId: delivery.accessRequestId,
          expectedTokenHash: delivery.tokenHash,
        }, now);
        if (revoked) {
          await requests.createVerificationEvent(
            delivery.accessRequestId,
            "VERIFICATION_DELIVERY_FAILED",
            now,
          );
        }
      }, false);
    } catch {
      // Cleanup incompleto nunca pode ser apresentado como envio concluído.
      throw new Error("ACCESS_VERIFICATION_CLEANUP_FAILED");
    }
  }

  private async withPersistence<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && error.message === "ACCESS_VERIFICATION_TRANSITION_CONFLICT") {
        throw error;
      }
      throw new Error("ACCESS_VERIFICATION_PERSISTENCE_FAILED");
    }
  }
}

function isCanonicalVerificationToken(token: string): boolean {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(token)) return false;
  const decoded = Buffer.from(token, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === token;
}

function isCurrentUsableToken(
  token: EmailVerificationToken | null,
  expectedHash: string,
  now: Date,
): token is EmailVerificationToken {
  return token !== null
    && token.tokenHash === expectedHash
    && token.usedAt === null
    && token.revokedAt === null
    && token.expiresAt.getTime() > now.getTime()
    && token.issuedAt.getTime() <= now.getTime();
}
