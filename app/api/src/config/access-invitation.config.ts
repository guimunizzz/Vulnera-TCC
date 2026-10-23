// Valida parâmetros próprios da reemissão de convite de ativação.
// Mantém a política fora do service e não lê SMTP; a factory carrega SMTP lazy.
// Consumido pela factory administrativa de AccessRequest.

import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";

export type AccessInvitationConfig = {
  resendCooldownMs: number;
};

export function loadAccessInvitationConfig(): AccessInvitationConfig {
  const raw = EnvVar.getOptional(EnvKeys.ACCESS_INVITATION_RESEND_COOLDOWN_MS, "60000");
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) {
    throw new Error("Env ACCESS_INVITATION_RESEND_COOLDOWN_MS must be an integer");
  }

  const resendCooldownMs = Number(raw);
  if (!Number.isSafeInteger(resendCooldownMs) || resendCooldownMs < 0 || resendCooldownMs > 86_400_000) {
    throw new Error("Env ACCESS_INVITATION_RESEND_COOLDOWN_MS is outside the allowed range");
  }

  return { resendCooldownMs };
}
