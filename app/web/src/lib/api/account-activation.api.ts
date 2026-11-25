/**
 * Cliente tipado dos endpoints anônimos de ativação.
 * Mantém o convite fora do cliente autenticado e envia apenas os dados exigidos.
 * Consumido pela página pública de ativação de conta.
 */

import { publicPost } from "./public-http";
import type {
  ActivateAccountInput,
  ValidateAccountActivationInput,
  ValidateAccountActivationResponse,
} from "../../types/account-activation.types";

export const accountActivationApi = {
  validate(input: ValidateAccountActivationInput): Promise<ValidateAccountActivationResponse> {
    return publicPost<ValidateAccountActivationResponse>("/account-activation/validate", input);
  },

  activate(input: ActivateAccountInput): Promise<void> {
    return publicPost<void>("/account-activation/activate", input);
  },
};
