/**
 * app-layout.test.tsx
 *
 * Exercita a transição real de rota com consultas e animação de saída.
 * Evita montar a próxima tela duas vezes e consumir o limite da API.
 * Consumido pela suíte Vitest do frontend; decoração é omitida no jsdom.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, NavLink, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AppLayout } from "./app-layout";
import { ThemeProvider } from "../../design/theme-provider";
import { useAuthStore } from "../../store/auth.store";

vi.mock("../dashboard/hero/dashboard-atmosphere", () => ({ DashboardAtmosphere: () => null }));
vi.mock("./sidebar", () => ({ Sidebar: () => <nav><NavLink to="/a">Página A</NavLink><NavLink to="/b">Página B</NavLink></nav> }));

afterEach(() => useAuthStore.getState().clearAuth());

describe("Transição de navegação", () => {
  it("monta a página de destino uma vez, inclusive com cache imediatamente obsoleto", async () => {
    const loadA = vi.fn().mockResolvedValue("Dados A");
    const loadB = vi.fn().mockResolvedValue("Dados B");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    function Page({ id, load }: { id: string; load: () => Promise<string> }) {
      const { data } = useQuery({ queryKey: [id], queryFn: load });
      return <h1>{data ?? "Carregando"}</h1>;
    }

    const view = render(
      <ThemeProvider><QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/a"]}><Routes>
          <Route element={<AppLayout />}>
            <Route path="a" element={<Page id="a" load={loadA} />} />
            <Route path="b" element={<Page id="b" load={loadB} />} />
          </Route>
        </Routes></MemoryRouter>
      </QueryClientProvider></ThemeProvider>,
    );
    await screen.findByRole("heading", { name: "Dados A" });
    fireEvent.click(screen.getByRole("link", { name: "Página B" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Dados A" })).not.toBeInTheDocument());
    await screen.findByRole("heading", { name: "Dados B" });
    expect(loadB).toHaveBeenCalledTimes(1);
    view.unmount();
    client.clear();
  });
});
