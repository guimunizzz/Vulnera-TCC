/**
 * atmosfera.store.test.ts — o canal tela → atmosfera.
 *   AST-01  a desmontagem da página anterior não apaga o risco da nova
 *   AST-02  quem publicou limpa ao sair; undefined (carregando) não publica
 *   AST-03  supressão só vale enquanto ativa e só o dono a libera
 *   AST-04  cada ping incrementa o sinal
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { pingarAtmosfera, useAtmosferaStore, usePublicarRisco, useSuprimirAtmosfera } from "./atmosfera.store";

beforeEach(() => useAtmosferaStore.setState({ risco: null, donoDoRisco: null, supressao: null, sinal: 0 }));

describe("atmosfera.store", () => {
  it("AST-01 — a página que sai não apaga o risco da que entrou", () => {
    const anterior = renderHook(() => usePublicarRisco(0.2));
    expect(useAtmosferaStore.getState().risco).toBe(0.2);
    // A nova entra enquanto a anterior ainda está na transição de saída.
    renderHook(() => usePublicarRisco(0.9));
    expect(useAtmosferaStore.getState().risco).toBe(0.9);
    act(() => anterior.unmount());
    expect(useAtmosferaStore.getState().risco).toBe(0.9);
  });

  it("AST-02 — quem publicou limpa ao sair; undefined não publica", () => {
    const tela = renderHook(({ v }: { v: number | undefined }) => usePublicarRisco(v), { initialProps: { v: undefined as number | undefined } });
    expect(useAtmosferaStore.getState().risco).toBeNull();
    tela.rerender({ v: 0.6 });
    expect(useAtmosferaStore.getState().risco).toBe(0.6);
    act(() => tela.unmount());
    expect(useAtmosferaStore.getState().risco).toBeNull();
  });

  it("AST-03 — supressão enquanto ativa", () => {
    const aba = renderHook(({ ativa }: { ativa: boolean }) => useSuprimirAtmosfera(ativa), { initialProps: { ativa: false } });
    expect(useAtmosferaStore.getState().supressao).toBeNull();
    aba.rerender({ ativa: true });
    expect(useAtmosferaStore.getState().supressao).not.toBeNull();
    // Outro dono não libera a supressão alheia.
    act(() => useAtmosferaStore.getState().liberar("outro"));
    expect(useAtmosferaStore.getState().supressao).not.toBeNull();
    aba.rerender({ ativa: false });
    expect(useAtmosferaStore.getState().supressao).toBeNull();
    aba.rerender({ ativa: true });
    act(() => aba.unmount());
    expect(useAtmosferaStore.getState().supressao).toBeNull();
  });

  it("AST-04 — ping incrementa o sinal", () => {
    act(() => pingarAtmosfera());
    act(() => pingarAtmosfera());
    expect(useAtmosferaStore.getState().sinal).toBe(2);
  });
});
