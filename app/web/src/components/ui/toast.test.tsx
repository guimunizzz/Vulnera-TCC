/**
 * toast.test.tsx
 *
 * A ação opcional do toast (usada por "Tentar novamente" na exportação Excel).
 * O contrato antigo — erro não expira, região sempre no DOM — também é fixado aqui,
 * porque a ação depende dele: um erro que sumisse sozinho levaria o botão junto.
 *
 *   TOAST-01  a região existe vazia desde o início (live region)
 *   TOAST-02  erro é role=alert e NÃO expira sozinho
 *   TOAST-03  a ação aparece, executa uma vez e fecha o aviso
 *   TOAST-04  sem ação não há botão extra
 *   TOAST-05  sucesso continua expirando
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";

function Disparador({ acao }: { acao?: () => void }) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.erro("Falhou", "Algo deu errado.", acao ? { rotulo: "Tentar novamente", aoClicar: acao } : undefined)}>erro</button>
      <button onClick={() => toast.sucesso("Feito", "Tudo certo.")}>sucesso</button>
    </>
  );
}

function montar(acao?: () => void) {
  return render(
    <ToastProvider>
      <Disparador acao={acao} />
    </ToastProvider>,
  );
}

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("TOAST-01 a região de notificações existe, vazia, antes de qualquer toast", () => {
    montar();
    expect(screen.getByRole("region", { name: "Notificações" })).toBeEmptyDOMElement();
  });

  it("TOAST-02 erro é um alerta e não expira sozinho", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    montar(() => undefined);
    await userEvent.click(screen.getByRole("button", { name: "erro" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("TOAST-03 a ação executa UMA vez e fecha o aviso", async () => {
    const aoClicar = vi.fn();
    montar(aoClicar);
    await userEvent.click(screen.getByRole("button", { name: "erro" }));

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(aoClicar).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("TOAST-04 sem ação, só existe o botão de fechar", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: "erro" }));
    const alerta = screen.getByRole("alert");
    expect(alerta.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Fechar notificação" })).toBeInTheDocument();
  });

  it("TOAST-05 sucesso continua expirando", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    montar();
    await userEvent.click(screen.getByRole("button", { name: "sucesso" }));
    expect(screen.getByRole("status")).toHaveTextContent("Feito");
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    await vi.waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
