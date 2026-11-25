/**
 * Buckets próprios para emissões e consumo de convites de equipe.
 * Protege cada instância da API mesmo com o limiter global desligado; chaves
 * derivadas de e-mail, IP e token são hasheadas e nunca entram em log.
 */
import { createHash } from "node:crypto";
import { TokenBucketStore, type TokenBucketResult } from "../utils/token-bucket.util";

export type CompanyInvitationPublicAction = "validate" | "activate";

const PER_MINUTE = (burst: number) => ({ burst, ratePerSecond: burst / 60 });
const STORE_TTL_MS = 10 * 60_000;

export class CompanyInvitationRateLimitService {
  readonly store: TokenBucketStore;

  constructor(store?: TokenBucketStore) {
    this.store = store ?? new TokenBucketStore({ ttlMs: STORE_TTL_MS, maxKeys: 10_000 });
  }

  consumeManagement(actorId: string, companyId: string, email?: string): TokenBucketResult {
    const scopes = [
      { key: `company-invitation:issuer:${fingerprint(actorId)}`, policy: PER_MINUTE(10) },
      { key: `company-invitation:company:${fingerprint(companyId)}`, policy: PER_MINUTE(30) },
      ...(email ? [{ key: `company-invitation:email:${fingerprint(email.trim().toLowerCase())}`, policy: PER_MINUTE(3) }] : []),
    ];
    return this.consumeAll(scopes);
  }

  consumePublicIp(action: CompanyInvitationPublicAction, ip: string): TokenBucketResult {
    const burst = action === "validate" ? 30 : 5;
    return this.store.consume(`company-invitation:${action}:ip:${fingerprint(ip)}`, PER_MINUTE(burst), {
      rejectNewAtCapacity: true,
    });
  }

  consumePublicToken(action: CompanyInvitationPublicAction, token: string): TokenBucketResult {
    const burst = action === "validate" ? 30 : 5;
    return this.store.consume(`company-invitation:${action}:token:${fingerprint(token)}`, PER_MINUTE(burst), {
      rejectNewAtCapacity: true,
    });
  }

  dispose(): void {
    this.store.dispose();
  }

  private consumeAll(scopes: Array<{ key: string; policy: ReturnType<typeof PER_MINUTE> }>): TokenBucketResult {
    const consumed: Array<{ key: string; policy: ReturnType<typeof PER_MINUTE> }> = [];
    let lastResult: TokenBucketResult = {
      allowed: true, remaining: 0, retryAfterSeconds: 0, resetAfterSeconds: 0, limit: 0,
    };
    for (const scope of scopes) {
      const result = this.store.consume(scope.key, scope.policy, { rejectNewAtCapacity: true });
      if (!result.allowed) {
        for (const prior of consumed) this.store.refund(prior.key, prior.policy);
        return result;
      }
      consumed.push(scope);
      lastResult = result;
    }
    return lastResult;
  }
}

export class CompanyInvitationRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("RATE_LIMITED");
    this.name = "CompanyInvitationRateLimitError";
  }
}

export function assertCompanyInvitationRateLimit(result: TokenBucketResult): void {
  if (!result.allowed) throw new CompanyInvitationRateLimitError(result.retryAfterSeconds);
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
