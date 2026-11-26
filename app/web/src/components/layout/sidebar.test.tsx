/**
 * sidebar.test.tsx — item "SAST/SCA" com o selo "new" (ADR-052): aparece
 * para ADMIN e PENTESTER, logo depois de DAST, e não aparece para CLIENT.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./sidebar";
import { useAuthStore } from "../../store/auth.store";

vi.mock("../../lib/api/saved-queries.api", () => ({ savedQueriesApi: { list: async () => [] } }));

function renderComo(role: "ADMIN" | "PENTESTER" | "CLIENT") {
  useAuthStore.setState({
    accessToken: "t",
    refreshToken: "r",
    user: { id: "u", name: "U", email: "u@x.test", role, companyId: null, companyRole: null, createdAt: "2026-11-13T00:00:00Z" },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/sast-sca"]}>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => useAuthStore.setState({ accessToken: null, refreshToken: null, user: null }));

describe("Sidebar — SAST/SCA", () => {
  it.each(["ADMIN", "PENTESTER"] as const)("%s vê o item com o selo new, depois de DAST", (role) => {
    renderComo(role);
    const link = screen.getByRole("link", { name: /SAST\/SCA/ });
    expect(link).toHaveAttribute("href", "/sast-sca");
    expect(within(link).getByText("new")).toBeInTheDocument();

    const operacao = screen.getByRole("region", { name: "Operação" });
    const rotulos = within(operacao).getAllByRole("link").map((l) => l.textContent ?? "");
    expect(rotulos.findIndex((t) => t.startsWith("SAST/SCA"))).toBe(rotulos.findIndex((t) => t.startsWith("DAST")) + 1);
  });

  it("CLIENT não vê o item", () => {
    renderComo("CLIENT");
    expect(screen.queryByRole("link", { name: /SAST\/SCA/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Solicitações de acesso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Aprovações de assinatura" })).not.toBeInTheDocument();
  });

  it("só os itens novos têm o selo (SAST/SCA, Threat Intel, Agendamentos, Filas, Triagem e Conformidade)", () => {
    renderComo("ADMIN");
    expect(screen.getAllByText("new")).toHaveLength(6);
    expect(screen.getByRole("link", { name: /Triagem/ })).toHaveTextContent("new");
    expect(screen.getByRole("link", { name: /Conformidade/ })).toHaveTextContent("new");
    expect(screen.getByRole("link", { name: /Agendamentos/ })).toHaveTextContent("new");
    expect(screen.getByRole("link", { name: /Threat Intel/ })).toHaveTextContent("new");
    expect(screen.getByRole("link", { name: /SAST\/SCA/ })).toHaveTextContent("new");
    expect(screen.getByRole("link", { name: /Filas/ })).toHaveTextContent("new");
  });

  it("Filas aparece só para ADMIN, no grupo Administração", () => {
    const { unmount } = renderComo("ADMIN");
    const admin = screen.getByRole("region", { name: "Administração" });
    expect(within(admin).getByRole("link", { name: /Filas/ })).toHaveAttribute("href", "/admin/filas");
    unmount();
    for (const papel of ["PENTESTER", "CLIENT"] as const) {
      const tentativa = renderComo(papel);
      expect(screen.queryByRole("link", { name: /Filas/ })).not.toBeInTheDocument();
      tentativa.unmount();
    }
  });

  it("Threat Intel aparece para os três papéis", () => {
    for (const papel of ["ADMIN", "PENTESTER", "CLIENT"] as const) {
      const { unmount } = renderComo(papel);
      expect(screen.getByRole("link", { name: /Threat Intel/ })).toHaveAttribute("href", "/threat-intel");
      unmount();
    }
  });

  it("separa solicitações de acesso das aprovações de assinatura para ADMIN", () => {
    renderComo("ADMIN");
    expect(screen.getByRole("link", { name: "Solicitações de acesso" })).toHaveAttribute(
      "href", "/admin/access-requests",
    );
    expect(screen.getByRole("link", { name: "Aprovações de assinatura" })).toHaveAttribute(
      "href", "/admin/subscriptions",
    );
  });

  it("Agendamentos (ADR-056) aparece para os três papéis, com o selo new, depois de SAST/SCA", () => {
    for (const papel of ["ADMIN", "PENTESTER", "CLIENT"] as const) {
      const { unmount } = renderComo(papel);
      const link = screen.getByRole("link", { name: /Agendamentos/ });
      expect(link).toHaveAttribute("href", "/agendamentos");
      expect(within(link).getByText("new")).toBeInTheDocument();
      if (papel !== "CLIENT") {
        const rotulos = within(screen.getByRole("region", { name: "Operação" })).getAllByRole("link").map((l) => l.textContent ?? "");
        expect(rotulos.findIndex((t) => t.startsWith("Agendamentos"))).toBe(rotulos.findIndex((t) => t.startsWith("SAST/SCA")) + 1);
      }
      unmount();
    }
  });
});
