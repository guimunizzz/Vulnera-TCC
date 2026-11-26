/**
 * Valida carregamento oficial, fail-closed, callbacks e tamanho responsivo do Turnstile.
 * Confere que erro/expiração descartam tokens e que cleanup remove widgets.
 * Consumido pelo Vitest focal do widget público de segurança.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileChallenge } from "./turnstile-challenge";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface RenderOptions {
  sitekey: string;
  action: string;
  size?: "normal" | "compact";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

function createTurnstile() {
  const options: RenderOptions[] = [];
  const api = {
    render: vi.fn((_container: HTMLElement, config: RenderOptions) => {
      options.push(config);
      return `widget-${options.length}`;
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  return { api, options };
}

function installTurnstile(api: ReturnType<typeof createTurnstile>["api"]): void {
  Object.defineProperty(window, "turnstile", {
    value: api as unknown as NonNullable<typeof window.turnstile>,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-for-test");
  vi.stubEnv("VITE_TURNSTILE_ACTION", "access-request");
  vi.stubEnv("MODE", "test");
  vi.stubEnv("DEV", false);
  delete window.turnstile;
});

afterEach(() => {
  delete window.turnstile;
  document.querySelectorAll(`script[src="${SCRIPT_URL}"]`).forEach((script) => script.remove());
  vi.unstubAllEnvs();
});

describe("TurnstileChallenge", () => {
  it("limpa promise com erro de script e permite uma tentativa posterior", async () => {
    const onTokenChange = vi.fn();
    const first = render(<TurnstileChallenge onTokenChange={onTokenChange} />);
    await waitFor(() => expect(document.querySelector(`script[src="${SCRIPT_URL}"]`)).not.toBeNull());
    const script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)!;
    fireEvent.error(script);
    expect(await screen.findByRole("alert")).toHaveTextContent("Verificação de segurança indisponível");
    expect(onTokenChange).toHaveBeenCalledWith(null);
    first.unmount();

    const turnstile = createTurnstile();
    installTurnstile(turnstile.api);
    render(<TurnstileChallenge onTokenChange={onTokenChange} />);
    await waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(1));
  });

  it("carrega a URL oficial em modo explícito e limpa o widget no unmount", async () => {
    const onTokenChange = vi.fn();
    const view = render(<TurnstileChallenge onTokenChange={onTokenChange} />);
    await waitFor(() => expect(document.querySelector(`script[src="${SCRIPT_URL}"]`)).not.toBeNull());
    const script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`)!;
    expect(script.src).toBe(SCRIPT_URL);

    const turnstile = createTurnstile();
    installTurnstile(turnstile.api);
    fireEvent.load(script);
    await waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(1));
    expect(turnstile.options[0]).toMatchObject({ sitekey: "site-key-for-test", action: "access-request", size: "normal" });

    act(() => turnstile.options[0].callback("captcha-once"));
    expect(onTokenChange).toHaveBeenLastCalledWith("captcha-once");
    act(() => turnstile.options[0]["expired-callback"]());
    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    expect(turnstile.api.reset).toHaveBeenCalledWith("widget-1");

    view.unmount();
    expect(turnstile.api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("falha fechado sem chave e bloqueia a chave pública de teste em produção", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const missing = render(<TurnstileChallenge onTokenChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("indisponível");
    expect(document.querySelector(`script[src="${SCRIPT_URL}"]`)).toBeNull();
    missing.unmount();

    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    vi.stubEnv("MODE", "production");
    vi.stubEnv("DEV", false);
    const production = render(<TurnstileChallenge onTokenChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("indisponível");
    expect(document.querySelector(`script[src="${SCRIPT_URL}"]`)).toBeNull();
    production.unmount();
  });

  it("usa widget compacto quando o espaço disponível é menor que 300px", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 270, height: 60, top: 0, right: 270, bottom: 60, left: 0,
      toJSON: () => ({}),
    });
    const turnstile = createTurnstile();
    installTurnstile(turnstile.api);

    render(<TurnstileChallenge onTokenChange={vi.fn()} />);

    await waitFor(() => expect(turnstile.options[turnstile.options.length - 1]?.size).toBe("compact"));
  });

  it("invalida o token ao receber erro e permite reconstruir o desafio", async () => {
    const turnstile = createTurnstile();
    installTurnstile(turnstile.api);
    const onTokenChange = vi.fn();
    render(<TurnstileChallenge onTokenChange={onTokenChange} />);
    await waitFor(() => expect(turnstile.options).toHaveLength(1));
    act(() => turnstile.options[0].callback("token-temporario"));
    act(() => turnstile.options[0]["error-callback"]());

    expect(onTokenChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Recarregar verificação" }));
    await waitFor(() => expect(turnstile.api.render).toHaveBeenCalledTimes(2));
    expect(turnstile.api.remove).toHaveBeenCalledWith("widget-1");
  });
});
