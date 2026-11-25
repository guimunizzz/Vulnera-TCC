// Orquestra solicitação pública e verificação sem criar identidade autenticada.
// Existe para centralizar reserva, reenvio e confirmação; consumido pelo controller de acesso.

import {
  AccessRequestEntity,
  normalizeAccessRequestEmail,
  type AccessRequest,
  type CreateAccessRequestDTO,
} from "../models/access-request.model";
import type { AccessRequestRepository } from "../repositories/access-request.repository";
import type { EmailVerificationService } from "./email-verification.service";

export type AccessRequestServiceOptions = {
  clock?: () => Date;
  cooldownMs?: number;
};

const DEFAULT_RESEND_COOLDOWN_MS = 60_000;

type PublicRequestResolution =
  | { kind: "USER_EXISTS" }
  | { kind: "REQUEST"; request: AccessRequest };

export class AccessRequestService {
  private readonly clock: () => Date;
  private readonly cooldownMs: number;

  constructor(
    private readonly requests: AccessRequestRepository,
    private readonly verification: EmailVerificationService,
    options: AccessRequestServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.cooldownMs = options.cooldownMs ?? DEFAULT_RESEND_COOLDOWN_MS;
    if (!Number.isSafeInteger(this.cooldownMs) || this.cooldownMs < 0) {
      throw new Error("INVALID_ACCESS_REQUEST_RESEND_COOLDOWN_MS");
    }
  }

  /** Resposta pública uniforme; nenhuma informação do pedido volta ao chamador. */
  async request(dto: CreateAccessRequestDTO): Promise<void> {
    let resolution: PublicRequestResolution;
    try {
      const now = this.clock();
      const email = normalizeAccessRequestEmail(dto.email);
      resolution = await this.requests.transactionWithRetry(async ({ requests }) => {
        const existingUser = await requests.existsUserByEmail(email);
        const active = await requests.findActiveByEmailForUpdate(email);

        if (active && active.expiresAt.getTime() > now.getTime()) {
          // A repetição não atualiza os dados pessoais já reservados.
          return existingUser
            ? { kind: "USER_EXISTS" } as const
            : { kind: "REQUEST", request: active } as const;
        }

        if (active) {
          const expiration = new AccessRequestEntity(active).transitionTo("EXPIRED", undefined, undefined, now);
          if (!await requests.transitionIfCurrent(active.id, expiration)) {
            throw new Error("ACCESS_REQUEST_EXPIRATION_CONFLICT");
          }
        }

        // Libera uma reserva vencida, mas nunca cria um pedido para identidade existente.
        if (existingUser) return { kind: "USER_EXISTS" } as const;

        const created = await requests.createIfEmailAvailable({ ...dto, email }, now);
        if (!created) return { kind: "USER_EXISTS" } as const;
        return { kind: "REQUEST", request: created } as const;
      });
    } catch {
      // Erro de banco deve virar 500 genérico no controller, nunca sucesso neutro.
      throw new Error("ACCESS_REQUEST_PERSISTENCE_FAILED");
    }

    if (resolution.kind === "USER_EXISTS") return;
    await this.verification.requestVerification(resolution.request.id, this.cooldownMs);
  }

  /** Reenvia somente para uma reserva ativa; ausência/User existente são neutros. */
  async resend(email: string): Promise<void> {
    let request: AccessRequest | null;
    try {
      const normalized = normalizeAccessRequestEmail(email);
      request = await this.requests.transactionWithRetry(async ({ requests }) => {
        if (await requests.existsUserByEmail(normalized)) return null;
        return requests.findActiveByEmail(normalized);
      }, false);
    } catch {
      throw new Error("ACCESS_REQUEST_PERSISTENCE_FAILED");
    }
    if (!request) return;
    await this.verification.requestVerification(request.id, this.cooldownMs);
  }

  confirmEmail(token: string): Promise<boolean> {
    return this.verification.confirmEmail(token);
  }
}
