/** Garante a jornada unificada, plano ativo, CAPTCHA de envio e respostas neutras. */
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError } from "../../lib/api/public-http";
import { publicAccessApi } from "../../lib/api/public-access.api";
import { plansApi } from "../../lib/api/plans.api";
import type { TurnstileChallengeHandle } from "../../components/auth/turnstile-challenge";
import { RequestAccessPage } from "./request-access-page";

vi.mock("../../lib/api/public-access.api", () => ({ publicAccessApi: { request: vi.fn(), resendVerification: vi.fn(), verifyEmail: vi.fn() } }));
vi.mock("../../lib/api/plans.api", () => ({ plansApi: { list: vi.fn() } }));
vi.mock("../../components/auth/turnstile-challenge", async () => {
  const react = await import("react");
  type Props = { onTokenChange: (token: string | null) => void; className?: string };
  const Challenge = react.forwardRef<TurnstileChallengeHandle, Props>(function Challenge({ onTokenChange }, ref) {
    react.useImperativeHandle(ref, () => ({ reset: () => onTokenChange(null) }), [onTokenChange]);
    return react.createElement("button", { type: "button", onClick: () => onTokenChange("captcha-token") }, "Concluir verificação");
  });
  return { TurnstileChallenge: Challenge };
});
const plans = [
  { id: "plan-live", name: "Essencial", maxApplications: 3, maxProjects: 2, includesRemediation: false, price: 90, isActive: true, createdAt: "2026-01-01" },
  { id: "plan-off", name: "Arquivado", maxApplications: 10, maxProjects: 10, includesRemediation: true, price: 0, isActive: false, createdAt: "2026-01-01" },
];
beforeEach(() => { vi.clearAllMocks(); vi.mocked(plansApi.list).mockResolvedValue(plans); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<StrictMode><QueryClientProvider client={client}><MemoryRouter><RequestAccessPage /></MemoryRouter></QueryClientProvider></StrictMode>);
}
async function stepToReview(withCnpj = true): Promise<void> {
  fireEvent.change(screen.getByLabelText(/^Nome do responsável/), { target: { value: "Pessoa Exemplo" } });
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "pessoa@example.test" } });
  fireEvent.change(screen.getByLabelText(/^Telefone/), { target: { value: "+55 11 99999-0000" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText(/^Empresa/), { target: { value: "Empresa Exemplo" } });
  if (withCnpj) fireEvent.change(screen.getByLabelText(/^CNPJ/), { target: { value: "12.345.678/0001-99" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("radio", { name: /Essencial/ });
  expect(screen.queryByText("Arquivado")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /Essencial/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("RequestAccessPage", () => {
  it("revisa responsável, empresa/CNPJ e plano ativo antes de enviar com Turnstile", async () => {
    vi.mocked(publicAccessApi.request).mockResolvedValueOnce({ message: "private detail" });
    renderPage();
    await stepToReview();
    expect(screen.getByText(/Pessoa Exemplo · pessoa@example.test/)).toBeInTheDocument();
    expect(screen.getByText(/Empresa Exemplo · CNPJ 12\.345/)).toBeInTheDocument();
    expect(screen.getByText(/Essencial/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    expect(publicAccessApi.request).toHaveBeenCalledWith({
      name: "Pessoa Exemplo", email: "pessoa@example.test", companyName: "Empresa Exemplo", planId: "plan-live",
      companyCnpj: "12.345.678/0001-99", phone: "+55 11 99999-0000", captchaToken: "captcha-token",
    });
    expect(await screen.findByText("Se os dados informados permitirem, você receberá as instruções por e-mail.")).toBeInTheDocument();
    expect(screen.queryByText("private detail")).not.toBeInTheDocument();
  });

  it("envia sem CNPJ quando opcional e exige CAPTCHA só na revisão", async () => {
    vi.mocked(publicAccessApi.request).mockResolvedValueOnce({ message: "ok" });
    renderPage();
    await stepToReview(false);
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.submit(screen.getByRole("form", { name: "Solicitar acesso" }));
    expect(publicAccessApi.request).toHaveBeenCalledWith({
      name: "Pessoa Exemplo", email: "pessoa@example.test", companyName: "Empresa Exemplo", planId: "plan-live",
      phone: "+55 11 99999-0000", captchaToken: "captcha-token",
    });
  });

  it("trava envios duplicados e descarta o CAPTCHA usado", async () => {
    let resolve!: (value: { message: string }) => void;
    vi.mocked(publicAccessApi.request).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    renderPage();
    await stepToReview();
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    const send = screen.getByRole("button", { name: "Enviar solicitação" });
    act(() => { fireEvent.click(send); fireEvent.submit(screen.getByRole("form", { name: "Solicitar acesso" })); });
    expect(publicAccessApi.request).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ message: "ok" }));
    expect(screen.getByRole("button", { name: "Enviar solicitação" })).toBeDisabled();
  });

  it("mantém reenvio neutro e exige novo CAPTCHA", async () => {
    vi.mocked(publicAccessApi.resendVerification).mockResolvedValueOnce({ message: "ok" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificação" }));
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "pessoa@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.submit(screen.getByRole("form", { name: "Reenviar verificação" }));
    expect(publicAccessApi.resendVerification).toHaveBeenCalledWith({ email: "pessoa@example.test", captchaToken: "captcha-token" });
    expect(await screen.findByText("Se os dados informados permitirem, você receberá as instruções por e-mail.")).toBeInTheDocument();
  });

  it("respeita limite 429 sem expor dados pessoais ou permitir novo envio", async () => {
    vi.mocked(publicAccessApi.resendVerification).mockRejectedValueOnce(new PublicApiError(429, "RATE_LIMITED", { retryAfterSeconds: 2 }));
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar verificação" }));
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: "pessoa@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação" }));
    fireEvent.submit(screen.getByRole("form", { name: "Reenviar verificação" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde antes de tentar novamente.");
    expect(screen.getByRole("button", { name: "Aguarde para tentar novamente" })).toBeDisabled();
  });
});
