/**
 * Testes do fluxo público de ativação de conta.
 * Conferem convite, política local de senha, envio mínimo e acessibilidade.
 * Renderizam a página isolada em MemoryRouter, sem exigir AuthLayout.
 */

import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicApiError } from "../../lib/api/public-http";
import { accountActivationApi } from "../../lib/api/account-activation.api";
import { ActivateAccountPage } from "./activate-account-page";

vi.mock("../../lib/api/account-activation.api", () => ({
  accountActivationApi: { validate: vi.fn(), activate: vi.fn() },
}));

const TOKEN = "fragment-token-only-in-memory";

function setFragmentToken(token = TOKEN): void {
  window.history.replaceState(window.history.state, "", `/activate-account#token=${encodeURIComponent(token)}`);
}

function renderPage(strict = false) {
  const page = (
    <MemoryRouter initialEntries={["/activate-account"]}>
      <ActivateAccountPage />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

async function openForm(): Promise<void> {
  setFragmentToken();
  vi.mocked(accountActivationApi.validate).mockResolvedValueOnce({ valid: true });
  renderPage();
  await screen.findByLabelText(/^Senha nova/);
}

function fillPasswords(password: string, confirmation = password): void {
  fireEvent.change(screen.getByLabelText(/^Senha nova/), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/^Confirmar senha/), { target: { value: confirmation } });
}

function submitForm(): void {
  fireEvent.submit(screen.getByRole("form", { name: "Ativar conta" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/activate-account");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("ActivateAccountPage", () => {
  it("lê o fragmento uma vez em StrictMode, remove-o e não grava token nem cria sessão", async () => {
    const storageRead = vi.spyOn(Storage.prototype, "getItem");
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    setFragmentToken();
    vi.mocked(accountActivationApi.validate).mockResolvedValueOnce({ valid: true });

    renderPage(true);

    await screen.findByLabelText(/^Senha nova/);
    expect(window.location.pathname).toBe("/activate-account");
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    expect(accountActivationApi.validate).toHaveBeenCalledTimes(1);
    expect(accountActivationApi.validate).toHaveBeenCalledWith({ token: TOKEN });
    expect(accountActivationApi.activate).not.toHaveBeenCalled();
    expect(storageRead).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("apresenta a mesma mensagem neutra para convite inválido ou indisponível", async () => {
    setFragmentToken();
    vi.mocked(accountActivationApi.validate).mockResolvedValueOnce({ valid: false });
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Convite indisponível");
    expect(alert).toHaveTextContent("Este convite é inválido, expirado ou já foi utilizado.");
    expect(alert).not.toHaveTextContent(TOKEN);
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  });

  it("permite tentar novamente depois de uma falha de rede", async () => {
    setFragmentToken();
    vi.mocked(accountActivationApi.validate)
      .mockRejectedValueOnce(new PublicApiError(0, "NETWORK_ERROR"))
      .mockResolvedValueOnce({ valid: true });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível verificar o convite agora. Tente novamente.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByLabelText(/^Senha nova/)).toBeInTheDocument();
    expect(accountActivationApi.validate).toHaveBeenCalledTimes(2);
  });

  it("respeita Retry-After em 429 e bloqueia a nova validação durante a espera", async () => {
    setFragmentToken();
    vi.mocked(accountActivationApi.validate).mockRejectedValueOnce(new PublicApiError(429, "RATE_LIMITED", { retryAfterSeconds: 17 }));
    renderPage();

    const countdown = await screen.findByText(/Tente novamente em \d+s\./);
    const seconds = Number(countdown.textContent?.match(/\d+/)?.[0]);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(17);
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeDisabled();
    expect(accountActivationApi.validate).toHaveBeenCalledTimes(1);
  });

  it("valida os limites de caracteres e bytes UTF-8 antes de chamar a API", async () => {
    await openForm();
    fillPasswords("1234567");
    submitForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Use pelo menos 8 caracteres.");
    expect(accountActivationApi.activate).not.toHaveBeenCalled();

    fillPasswords("😀".repeat(19));
    submitForm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Use uma senha com até 72 bytes em UTF-8.");
    expect(accountActivationApi.activate).not.toHaveBeenCalled();
  });

  it("não envia quando a confirmação diverge", async () => {
    await openForm();
    fillPasswords("SenhaForte123", "SenhaForte321");
    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("As senhas não coincidem.");
    expect(accountActivationApi.activate).not.toHaveBeenCalled();
  });

  it("envia somente token e senha, aceita 72 bytes UTF-8 e termina sem login automático", async () => {
    await openForm();
    const senha72Bytes = "😀".repeat(18);
    fillPasswords(senha72Bytes);
    vi.mocked(accountActivationApi.activate).mockResolvedValueOnce(undefined);

    submitForm();

    expect(await screen.findByRole("status")).toHaveTextContent("Conta ativada");
    expect(accountActivationApi.activate).toHaveBeenCalledTimes(1);
    expect(accountActivationApi.activate).toHaveBeenCalledWith({ token: TOKEN, password: senha72Bytes });
    expect(accountActivationApi.validate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("heading", { name: "Destino login" })).not.toBeInTheDocument();
  });

  it("impede envios duplicados antes da atualização visual de pending", async () => {
    await openForm();
    fillPasswords("SenhaForte123");
    const pending = deferred<void>();
    vi.mocked(accountActivationApi.activate).mockReturnValueOnce(pending.promise);
    const form = screen.getByRole("form", { name: "Ativar conta" });

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(accountActivationApi.activate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ativar conta" })).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Conta ativada");
  });

  it("mantém títulos, campos e controles de senha acessíveis ao ser renderizada isoladamente", async () => {
    await openForm();
    const heading = screen.getByRole("heading", { name: "Ativar conta" });
    expect(heading).toHaveAttribute("id", "activate-account-title");
    expect(heading).toHaveAttribute("tabindex", "-1");
    heading.focus();
    expect(heading).toHaveFocus();
    expect(screen.getByRole("form", { name: "Ativar conta" })).toBeInTheDocument();

    const password = screen.getByLabelText(/^Senha nova/);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha nova" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha nova" }));
    expect(password).toHaveAttribute("type", "password");

    const confirmation = screen.getByLabelText(/^Confirmar senha/);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar confirmação de senha" }));
    expect(confirmation).toHaveAttribute("type", "text");
  });
});
