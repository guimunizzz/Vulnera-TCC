/**
 * Contrato de verificação CAPTCHA separado do provedor externo.
 * Permite que serviços HTTP validem tokens sem depender da Cloudflare e que
 * testes substituam o provedor por uma fixture determinística.
 */

export type CaptchaVerificationInput = {
  token: string;
  remoteIp?: string;
};

export interface CaptchaVerifier {
  verify(input: CaptchaVerificationInput): Promise<boolean>;
}
