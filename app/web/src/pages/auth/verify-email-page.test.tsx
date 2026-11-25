/**
 * Confere consumo explícito do token e recuperação após falha transitória.
 * Protege resposta 400 neutra, ausência de CAPTCHA e prevenção de autoenvio.
 * Consumido pelo Vitest focal da página pública de confirmação.
 */

import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError } from "../../lib/api/public-http";
import { publicAccessApi } from "../../lib/api/public-access.api";
import { VerifyEmailPage } from "./verify-email-page";

vi.mock("../../lib/api/public-access.api", () => ({
  publicAccessApi: {
    request: vi.fn(),
    resendVerification: vi.fn(),
    verifyEmail: vi.fn(),
  },
}));

const TOKEN = "Abc_123-".repeat(5) + "Abc";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function renderVerifyPage(token = TOKEN): void {
  window.history.replaceState({ keep: true }, "", `/verify-email?origem=mail#token=${token}`);
  render(<StrictMode><MemoryRouter><VerifyEmailPage /></MemoryRouter></StrictMode>);
}

describe("VerifyEmailPage", () => {
  it("não consome token no render/replay StrictMode e confirma somente por ação explícita", async () => {
    vi.mocked(publicAccessApi.verifyEmail).mockResolvedValueOnce({ message: "E-mail confirmado." });
    renderVerifyPage();

    expect(publicAccessApi.verifyEmail).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/verify-email");
    expect(window.location.search).toBe("?origem=mail");
    expect(window.location.hash).toBe("");
    expect(window.history.state).toEqual({ keep: true });
    expect(screen.getByRole("button", { name: "Confirmar e-mail" })).toBeInTheDocument();

    fireEvent.submit(screen.getByRole("form", { name: "Confirmar e-mail" }));
    expect(publicAccessApi.verifyEmail).toHaveBeenCalledTimes(1);
    expect(publicAccessApi.verifyEmail).toHaveBeenCalledWith({ token: TOKEN });
    expect(await screen.findByRole("status")).toHaveTextContent("E-mail confirmado. Sua solicitação seguirá para análise.");
  });

  it("mantém o formulário após falha de rede para permitir tentativa humana de novo", async () => {
    vi.mocked(publicAccessApi.verifyEmail)
      .mockRejectedValueOnce(new PublicApiError(0, "NETWORK_ERROR"))
      .mockResolvedValueOnce({ message: "E-mail confirmado." });
    renderVerifyPage();

    fireEvent.submit(screen.getByRole("form", { name: "Confirmar e-mail" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar. Tente confirmar novamente.");
    expect(screen.getByRole("button", { name: "Confirmar e-mail" })).toBeInTheDocument();

    fireEvent.submit(screen.getByRole("form", { name: "Confirmar e-mail" }));
    expect(publicAccessApi.verifyEmail).toHaveBeenCalledTimes(2);
    expect(publicAccessApi.verifyEmail).toHaveBeenLastCalledWith({ token: TOKEN });
    expect(await screen.findByRole("status")).toHaveTextContent("Sua solicitação seguirá para análise.");
  });

  it("limpa token inválido e oferece caminho neutro para pedir novas instruções", async () => {
    vi.mocked(publicAccessApi.verifyEmail).mockRejectedValueOnce(new PublicApiError(400, "INVALID_VERIFICATION_TOKEN"));
    renderVerifyPage();
    fireEvent.submit(screen.getByRole("form", { name: "Confirmar e-mail" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este link é inválido ou expirou.");
    expect(screen.queryByRole("button", { name: "Confirmar e-mail" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar novas instruções" })).toHaveAttribute("href", "/request-access");
  });

  it("não chama a API para fragmento em formato inválido", () => {
    renderVerifyPage("token-curto");
    expect(screen.getByRole("status")).toHaveTextContent("Link indisponível");
    expect(publicAccessApi.verifyEmail).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar e-mail" })).not.toBeInTheDocument();
  });
});
