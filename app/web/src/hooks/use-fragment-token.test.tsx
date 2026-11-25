/**
 * Protege leitura única e remoção do token de verificação da barra de endereço.
 * Exercita replay de efeitos do StrictMode, query preservada e ausência de storage.
 * Consumido pelo Vitest focal do hook público de confirmação.
 */

import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFragmentToken } from "./use-fragment-token";

const TOKEN = "Abc_123-".repeat(5) + "Abc";

function Probe() {
  const { token, ready, clearToken } = useFragmentToken();
  return (
    <div>
      <output data-testid="token">{token ?? "vazio"}</output>
      <output data-testid="ready">{String(ready)}</output>
      <button type="button" onClick={clearToken}>Limpar</button>
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("useFragmentToken", () => {
  it("captura #token uma vez sob StrictMode e preserva state, path e query", () => {
    const historyState = { manter: "estado" };
    window.history.replaceState(historyState, "", `/verify-email?origem=convite#token=${TOKEN}`);
    const replace = vi.spyOn(window.history, "replaceState");

    render(<StrictMode><Probe /></StrictMode>);

    expect(screen.getByTestId("token")).toHaveTextContent(TOKEN);
    expect(screen.getByTestId("ready")).toHaveTextContent("true");
    expect(window.location.pathname).toBe("/verify-email");
    expect(window.location.search).toBe("?origem=convite");
    expect(window.location.hash).toBe("");
    expect(window.history.state).toEqual(historyState);
    expect(replace).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByTestId("token")).toHaveTextContent("vazio");
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("não lê token da query string nem persiste segredo em storage", () => {
    const localGet = vi.spyOn(localStorage, "getItem");
    const localSet = vi.spyOn(localStorage, "setItem");
    const sessionGet = vi.spyOn(sessionStorage, "getItem");
    const sessionSet = vi.spyOn(sessionStorage, "setItem");
    window.history.replaceState(null, "", "/verify-email?token=nao-ler#ancora");

    render(<StrictMode><Probe /></StrictMode>);

    expect(screen.getByTestId("token")).toHaveTextContent("vazio");
    expect(window.location.hash).toBe("#ancora");
    expect(localGet).not.toHaveBeenCalled();
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionGet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
  });
});
