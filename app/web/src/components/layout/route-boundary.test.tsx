/**
 * route-boundary.test.tsx
 *
 * Cobre o code-splitting por rota (refactor web-motion-3d, Fase 1):
 *   LAZY-01  navegar para uma página lazy dentro do AppLayout preserva os nós de
 *            navegação e cabeçalho; só a área de conteúdo mostra o skeleton
 *   LAZY-02  chunk que não baixa vira ErrorState com "Tentar novamente"
 *   LAZY-03  erro de render da página NÃO é engolido pelo limite
 * Consumido pela suíte Vitest do frontend; decoração é omitida no jsdom.
 */

import { Component, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, NavLink, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./app-layout";
import { LimiteDeRota } from "./route-boundary";
import { ThemeProvider } from "../../design/theme-provider";
import { useAuthStore } from "../../store/auth.store";
import { paginaLazy } from "../../lib/lazy-page";

vi.mock("../dashboard/hero/dashboard-atmosphere", () => ({ DashboardAtmosphere: () => null }));
vi.mock("./sidebar", () => ({ Sidebar: () => <nav aria-label="Teste"><NavLink to="/a">Página A</NavLink><NavLink to="/b">Página B</NavLink></nav> }));

afterEach(() => useAuthStore.getState().clearAuth());

function renderComProviders(ui: ReactNode, rota: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider><QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[rota]}>{ui}</MemoryRouter>
    </QueryClientProvider></ThemeProvider>,
  );
}

class CapturaDeErro extends Component<{ children: ReactNode }, { erro: string | null }> {
  state = { erro: null as string | null };
  static getDerivedStateFromError(erro: Error) { return { erro: erro.message }; }
  render() { return this.state.erro ? <p>Capturado fora: {this.state.erro}</p> : this.props.children; }
}

describe("Limite de rota lazy", () => {
  it("LAZY-01 — mantém navegação e cabeçalho montados enquanto o chunk da página baixa", async () => {
    let liberar!: (modulo: { PaginaB: () => JSX.Element }) => void;
    const PaginaB = paginaLazy(() => new Promise<{ PaginaB: () => JSX.Element }>((resolve) => { liberar = resolve; }), "PaginaB");

    renderComProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="a" element={<h1>Página A carregada</h1>} />
          <Route path="b" element={<PaginaB />} />
        </Route>
      </Routes>,
      "/a",
    );
    await screen.findByRole("heading", { name: "Página A carregada" });
    const navegacao = screen.getAllByRole("navigation", { name: "Teste" })[0];
    const cabecalho = screen.getByRole("banner");

    fireEvent.click(screen.getAllByRole("link", { name: "Página B" })[0]);
    const carregando = await screen.findByText("Carregando página");
    const main = screen.getByRole("main");
    expect(within(main).getByText("Carregando página")).toBe(carregando);
    expect(carregando.closest("[aria-busy='true']")).not.toBeNull();
    expect(screen.getAllByRole("navigation", { name: "Teste" })[0]).toBe(navegacao);
    expect(screen.getByRole("banner")).toBe(cabecalho);

    await act(async () => liberar({ PaginaB: () => <h1>Página B carregada</h1> }));
    expect(await screen.findByRole("heading", { name: "Página B carregada" })).toBeInTheDocument();
    expect(screen.queryByText("Carregando página")).not.toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Teste" })[0]).toBe(navegacao);
    expect(screen.getByRole("banner")).toBe(cabecalho);
  });

  it("LAZY-02 — falha ao baixar o chunk mostra ErrorState com Tentar novamente", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Pagina = paginaLazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module")), "Pagina");

    renderComProviders(<LimiteDeRota variante="tela"><Pagina /></LimiteDeRota>, "/");

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("Não foi possível abrir esta tela")).toBeInTheDocument();
    expect(within(alerta).getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    silencio.mockRestore();
  });

  it("LAZY-03 — erro de render da página sobe para fora do limite", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Quebrada(): JSX.Element { throw new Error("bug da página"); }
    const Pagina = paginaLazy(() => Promise.resolve({ Pagina: Quebrada }), "Pagina");

    renderComProviders(
      <CapturaDeErro><LimiteDeRota variante="conteudo"><Pagina /></LimiteDeRota></CapturaDeErro>,
      "/",
    );

    expect(await screen.findByText("Capturado fora: bug da página")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível abrir esta tela")).not.toBeInTheDocument();
    silencio.mockRestore();
  });
});
