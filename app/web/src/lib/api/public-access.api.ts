/**
 * Fachada tipada dos três endpoints anônimos de acesso.
 * Encapsula paths e payloads sem depender de autenticação ou sessão.
 * Consumida pelas páginas de solicitação de acesso e confirmação de e-mail.
 */

import { publicPost } from "./public-http";
import type {
  PublicAccessMessage,
  RequestAccessInput,
  ResendVerificationInput,
  VerifyEmailInput,
} from "../../types/public-access.types";

export const publicAccessApi = {
  request(input: RequestAccessInput): Promise<PublicAccessMessage> {
    return publicPost<PublicAccessMessage>("/access-requests", input);
  },

  resendVerification(input: ResendVerificationInput): Promise<PublicAccessMessage> {
    return publicPost<PublicAccessMessage>("/access-requests/resend-verification", input);
  },

  verifyEmail(input: VerifyEmailInput): Promise<PublicAccessMessage> {
    return publicPost<PublicAccessMessage>("/access-requests/verify-email", input);
  },
};
