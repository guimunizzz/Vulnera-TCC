/**
 * Exercita solicitação e reenvio com CAPTCHA, travas, respostas neutras e cooldown.
 * Garante que tokens descartados exijam uma nova conclusão do desafio.
 * Consumido pelo Vitest focal das páginas públicas de acesso.
 */

import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError } from "../../lib/api/public-http";
import { publicAccessApi } from "../../lib/api/public-access.api";
import type { TurnstileChallengeHandle } from "../../components/auth/turnstile-challenge";
import { RequestAccessPage } from "./request-access-page";

vi.mock("../../lib/api/public-access.api", () => ({
  publicAccessApi: {
    request: vi.fn(),
    resendVerification: vi.fn(),
    verifyEmail: vi.fn(),
  },
}));

vi.mock("../../components/auth/turnstile-challenge", async () => {
  const react = await import("react");
  type Props = { onTokenChange: (token: string | null) => void; className?: string };
  const Challenge = react.forwardRef<TurnstileChallengeHandle, Props>(function Challenge({ onTokenChange }, ref) {
    react.useImperativeHandle(ref, () => ({ reset: () => onTokenChange(null) }), [onTokenChange]);
    return react.createElement("button", {
      type: "button",
      onClick: () => onTokenChange("captcha-token"),
    }, "Concluir verificação");
  });
  return { TurnstileChallenge: Challenge };
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderRequestPage(): void {
  render(<StrictMode><MemoryRouter><RequestAccessPage /></MemoryRouter></StrictMode>);
}

function fillRequest(): void {
  fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Pessoa Exemplo" } });
  fireEvent.change(screen.getByLabelText(/^Empresa/), { target: { value: "Empresa Exemplo" } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "pessoa@example.test" } });
}

describe("RequestAccessPage", () => {
  it("envia os dados públicos sem CNPJ e usa resposta neutra", async () => {
    vi.mocked(publicAccessApi.request).mockResolvedValueOnce({ message: "detalhe que a tela não deve expor" });
    renderRequestPage();
    fillRequest();
    expect(screen.queryByLabelText(/CNPJ/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.submit(screen.getByRole("form", { name: "Solicitar acesso" }));

    expect(publicAccessApi.request).toHaveBeenCalledWith({
      name: "Pessoa Exemplo",
      email: "pessoa@example.test",
      companyName: "Empresa Exemplo",
      captchaToken: "captcha-token",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Se os dados informados permitirem, você receberá as instruções por e-mail.");
    expect(screen.queryByText(/detalhe que a tela não deve expor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/conta criada|e-mail já existe/i)).not.toBeInTheDocument();
  });

  it("trava envios duplicados antes do próximo render", async () => {
    let resolve!: (value: { message: string }) => void;
    const pending = new Promise<{ message: string }>((done) => { resolve = done; });
    vi.mocked(publicAccessApi.request).mockReturnValueOnce(pending);
    renderRequestPage();
    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    const form = screen.getByRole("form", { name: "Solicitar acesso" });
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(publicAccessApi.request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Enviar solicitação" })).toHaveAttribute("aria-busy", "true");
    await act(async () => resolve({ message: "ok" }));
  });

  it("exige um CAPTCHA novo para reenvio e mantém resposta neutra", async () => {
    vi.mocked(publicAccessApi.resendVerification).mockResolvedValueOnce({ message: "ok" });
    renderRequestPage();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificação" }));
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "pessoa@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.submit(screen.getByRole("form", { name: "Reenviar verificação" }));

    expect(publicAccessApi.resendVerification).toHaveBeenCalledWith({ email: "pessoa@example.test", captchaToken: "captcha-token" });
    expect(await screen.findByRole("status")).toHaveTextContent("Se os dados informados permitirem, você receberá as instruções por e-mail.");
  });

  it("respeita 429 sem expor contagem e espera o cooldown antes de novo envio", async () => {
    vi.useFakeTimers();
    vi.mocked(publicAccessApi.resendVerification).mockRejectedValueOnce(new PublicApiError(429, "RATE_LIMITED", { retryAfterSeconds: 2 }));
    renderRequestPage();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificação" }));
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "pessoa@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.submit(screen.getByRole("form", { name: "Reenviar verificação" }));

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde antes de tentar novamente.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/\d/);
    expect(screen.getByRole("button", { name: "Aguarde para tentar novamente" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole("button", { name: "Reenviar instruções" })).not.toBeDisabled();
    expect(publicAccessApi.resendVerification).toHaveBeenCalledTimes(1);
  });

  it("não chama o endpoint sem token de CAPTCHA mesmo com submit programático", () => {
    renderRequestPage();
    fillRequest();
    fireEvent.submit(screen.getByRole("form", { name: "Solicitar acesso" }));
    expect(publicAccessApi.request).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Conclua a verificação de segurança antes de enviar.");
  });
});
