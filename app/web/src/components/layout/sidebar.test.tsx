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
  });

  it("só o item novo tem o selo", () => {
    renderComo("ADMIN");
    expect(screen.getAllByText("new")).toHaveLength(1);
  });
});
