/**
 * findings-access.test.tsx
 *
 * O QUE COBRE
 * A guarda de acesso da página global de findings — a contraparte de frente
 * do TEN-21 do backend.
 *
 *   FIND-ACC-01  CLIENT é barrado na rota /findings
 *   FIND-ACC-02  ADMIN e PENTESTER passam
 *   FIND-ACC-03  o item "Findings" não aparece na Sidebar do CLIENT
 *   FIND-ACC-04  o item aparece para ADMIN e PENTESTER
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A decisão de 2026-09-14 manteve o CLIENT com acesso ao ENDPOINT (RN16 — ele
 * continua vendo os findings da própria empresa no dashboard e no app mobile)
 * e moveu o bloqueio para a PÁGINA. Ou seja: o que protege a varredura global
 * não está mais no backend, está aqui. Sem estes testes, a regra mais fácil de
 * quebrar sem ninguém notar é justamente essa.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "../layout/protected-route";
import { Sidebar } from "../layout/sidebar";
import { useAuthStore } from "../../store/auth.store";
import type { UserRole } from "../../types/auth.types";

/**
 * A Sidebar consulta as watchlists fixadas (CP-6), então precisa de um
 * QueryClient como na aplicação real. `retry: false` para que a consulta
 * falhe rápido em vez de segurar o teste: o que se verifica aqui são os itens
 * de menu por papel, e a seção de watchlists é irrelevante para isso.
 */
function comProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

/** Sessão falsa — o `ProtectedRoute` e a `Sidebar` leem o store direto. */
function entrarComo(role: UserRole) {
  useAuthStore.setState({
    accessToken: "token-de-teste",
    refreshToken: "refresh-de-teste",
    user: { id: "u1", name: "Fulano", email: "fulano@vulnera.local", role, companyId: null, createdAt: new Date().toISOString() },
  });
}

/** Monta só o esqueleto de rotas que importa: /findings protegida + destino do redirecionamento. */
function renderizarRota(inicial = "/findings") {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route element={<ProtectedRoute roles={["ADMIN", "PENTESTER"]} />}>
          <Route path="/findings" element={<p>listagem global de findings</p>} />
        </Route>
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Acesso à página global de findings", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  });

  it("FIND-ACC-01 — CLIENT que força a URL é redirecionado, não vê a listagem", () => {
    entrarComo("CLIENT");

    renderizarRota();

    expect(screen.queryByText("listagem global de findings")).not.toBeInTheDocument();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });

  it("FIND-ACC-02 — ADMIN e PENTESTER alcançam a listagem", () => {
    for (const papel of ["ADMIN", "PENTESTER"] as UserRole[]) {
      entrarComo(papel);
      const { unmount } = renderizarRota();
      expect(screen.getByText("listagem global de findings")).toBeInTheDocument();
      unmount();
    }
  });

  it("FIND-ACC-03 — o item Findings não aparece no menu do CLIENT", () => {
    entrarComo("CLIENT");

    render(
      comProviders(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      ),
    );

    expect(screen.queryByRole("link", { name: /findings/i })).not.toBeInTheDocument();
    // controle positivo: o menu renderizou, só não tem esse item
    expect(screen.getByRole("link", { name: /projetos/i })).toBeInTheDocument();
  });

  it("FIND-ACC-04 — o item Findings aparece para ADMIN e PENTESTER", () => {
    for (const papel of ["ADMIN", "PENTESTER"] as UserRole[]) {
      entrarComo(papel);
      const { unmount } = render(
        comProviders(
          <MemoryRouter>
            <Sidebar />
          </MemoryRouter>,
        ),
      );
      expect(screen.getByRole("link", { name: /findings/i })).toBeInTheDocument();
      unmount();
    }
  });
});
