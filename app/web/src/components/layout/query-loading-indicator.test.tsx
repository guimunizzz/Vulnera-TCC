/**
 * query-loading-indicator.test.tsx
 *
 * Verifica o feedback discreto das buscas globais: atraso para respostas
 * rápidas, encerramento imediato e animação acessível. Consumido pelo Vitest
 * para proteger a espera exibida no cabeçalho das telas autenticadas.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryLoadingIndicator } from "./query-loading-indicator";

const fetching = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({ useIsFetching: fetching }));

beforeEach(() => {
  vi.useFakeTimers();
  fetching.mockReturnValue(1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("QueryLoadingIndicator", () => {
  it("aguarda 200 ms antes de anunciar uma busca em andamento", () => {
    render(<QueryLoadingIndicator />);
    const indicador = screen.getByRole("status", { hidden: true });

    expect(indicador).toHaveClass("invisible");
    expect(indicador).toHaveAttribute("aria-hidden", "true");

    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toBe(indicador);
    expect(indicador).not.toHaveClass("invisible");
    expect(indicador).toHaveTextContent("Carregando dados…");
  });

  it("some ao concluir e cancela o atraso de uma resposta rápida", () => {
    const { rerender } = render(<QueryLoadingIndicator />);
    act(() => vi.advanceTimersByTime(200));
    const indicador = screen.getByRole("status");

    fetching.mockReturnValue(0);
    rerender(<QueryLoadingIndicator />);
    expect(indicador).toHaveClass("invisible", "min-h-5", "min-w-4");
    expect(indicador).toHaveAttribute("aria-busy", "false");
    expect(indicador).toHaveAttribute("aria-hidden", "true");

    fetching.mockReturnValue(1);
    rerender(<QueryLoadingIndicator />);
    act(() => vi.advanceTimersByTime(100));
    fetching.mockReturnValue(0);
    rerender(<QueryLoadingIndicator />);
    act(() => vi.advanceTimersByTime(200));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { hidden: true })).toBe(indicador);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("anuncia a espera sem capturar cliques e respeita movimento reduzido", () => {
    render(<QueryLoadingIndicator />);
    act(() => vi.advanceTimersByTime(200));
    const indicador = screen.getByRole("status");
    const spinner = indicador.querySelector("[aria-hidden='true']");

    expect(indicador).toHaveAttribute("aria-live", "polite");
    expect(indicador).toHaveClass("pointer-events-none");
    expect(spinner).toHaveClass("animate-spin", "motion-reduce:animate-none");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });
});
