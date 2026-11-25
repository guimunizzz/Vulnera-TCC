/**
 * Testes do contrato HTTP anônimo de ativação.
 * Garantem paths e payloads mínimos sem iniciar uma sessão autenticada.
 * Exercitam o cliente consumido pela página de ativação.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountActivationApi } from "./account-activation.api";
import { publicPost } from "./public-http";

vi.mock("./public-http", () => ({ publicPost: vi.fn() }));

const TOKEN = "A".repeat(43);

describe("accountActivationApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valida enviando somente o token ao endpoint público", async () => {
    vi.mocked(publicPost).mockResolvedValueOnce({ valid: true });

    await expect(accountActivationApi.validate({ token: TOKEN })).resolves.toEqual({ valid: true });

    expect(publicPost).toHaveBeenCalledExactlyOnceWith("/account-activation/validate", { token: TOKEN });
  });

  it("ativa enviando somente token e senha e resolve o 204 sem resposta", async () => {
    vi.mocked(publicPost).mockResolvedValueOnce(undefined);

    await expect(accountActivationApi.activate({ token: TOKEN, password: "Senha segura 123" })).resolves.toBeUndefined();

    expect(publicPost).toHaveBeenCalledExactlyOnceWith("/account-activation/activate", {
      token: TOKEN,
      password: "Senha segura 123",
    });
  });
});
