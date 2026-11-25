/**
 * Confere paths e payloads dos três endpoints públicos de acesso.
 * Impede que a fachada pública passe a depender de sessão ou de rotas protegidas.
 * Consumido pelo Vitest focal da API web pública.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./public-http", () => ({ publicPost: vi.fn() }));
import { publicPost } from "./public-http";
import { publicAccessApi } from "./public-access.api";

afterEach(() => vi.clearAllMocks());

describe("publicAccessApi", () => {
  it("envia solicitação com CAPTCHA e dados sem CNPJ", async () => {
    const input = { name: "Pessoa", email: "pessoa@example.test", companyName: "Empresa", captchaToken: "captcha" };
    vi.mocked(publicPost).mockResolvedValueOnce({ message: "ok" });
    await expect(publicAccessApi.request(input)).resolves.toEqual({ message: "ok" });
    expect(publicPost).toHaveBeenCalledWith("/access-requests", input);
  });

  it("reenvia verificação com CAPTCHA", async () => {
    const input = { email: "pessoa@example.test", captchaToken: "captcha" };
    vi.mocked(publicPost).mockResolvedValueOnce({ message: "ok" });
    await publicAccessApi.resendVerification(input);
    expect(publicPost).toHaveBeenCalledWith("/access-requests/resend-verification", input);
  });

  it("confirma somente com token de fragmento", async () => {
    const input = { token: "x".repeat(43) };
    vi.mocked(publicPost).mockResolvedValueOnce({ message: "E-mail confirmado." });
    await publicAccessApi.verifyEmail(input);
    expect(publicPost).toHaveBeenCalledWith("/access-requests/verify-email", input);
  });
});
