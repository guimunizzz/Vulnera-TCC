/**
 * Protege o resumo visual de findings: as facetas ignoram o próprio filtro,
 * portanto os cards devem mostrar somente as severidades do recorte atual.
 * Consumido pelo Vitest; também cobre indisponibilidade sem contagens falsas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FindingsPage } from "./findings-page";
import type { UseFindingsResult } from "../hooks/use-findings";

const consulta = vi.hoisted(() => ({ resultado: {} as UseFindingsResult }));
vi.mock("../hooks/use-findings", () => ({ useFindings: () => consulta.resultado }));
vi.mock("../components/findings/findings-table", () => ({ FindingsTable: () => <div>Tabela de resultados</div> }));
vi.mock("../components/findings/saved-queries-bar", () => ({ SavedQueriesBar: () => <div>Atalhos salvos</div> }));
vi.mock("../components/dashboard/hero/dashboard-atmosphere", () => ({ DashboardAtmosphere: () => null }));

function renderPage(url = "/findings") {
  return render(<MemoryRouter initialEntries={[url]}><FindingsPage /></MemoryRouter>);
}

beforeEach(() => {
  consulta.resultado = {
    dados: undefined, carregando: true, atualizando: false, erro: null, recarregar: vi.fn(),
  };
});

describe("FindingsPage — resumo do recorte", () => {
  it("não apresenta zero como dado real enquanto a consulta carrega", () => {
    renderPage();
    expect(screen.getByText("Carregando findings…")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByLabelText("Findings por severidade no recorte atual")).not.toBeInTheDocument();
  });

  it("exclui facetas de severidades fora do filtro aplicado", () => {
    consulta.resultado = {
      ...consulta.resultado, carregando: false,
      dados: {
        data: [], pagination: { total: 9, page: 1, pageSize: 25, totalPages: 1 },
        facets: { severity: { CRITICAL: 4, HIGH: 5, MEDIUM: 7 }, status: {}, owasp: {}, company: {} },
      },
    };
    renderPage("/findings?severity=HIGH,CRITICAL");
    const resumo = screen.getByLabelText("Findings por severidade no recorte atual");
    expect(within(resumo).getByText("Crítica")).toBeInTheDocument();
    expect(within(resumo).getByText("Alta")).toBeInTheDocument();
    expect(within(resumo).queryByText("Média")).not.toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("distingue falha de busca de um recorte vazio", () => {
    consulta.resultado = { ...consulta.resultado, carregando: false, erro: new Error("offline") };
    renderPage();
    expect(screen.getByText("A busca não chegou ao servidor")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum finding no recorte atual")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
