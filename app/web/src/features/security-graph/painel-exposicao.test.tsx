/**
 * painel-exposicao.test.tsx — visão unificada no Exposure Graph: o painel da
 * aplicação e o resumo da empresa mostram as abertas por origem, e cada
 * vulnerabilidade principal traz o selo da lente que a encontrou.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AplicacaoExposta, ExposureGraph } from "../../types/exposure-graph.types";
import { PainelExposicao } from "./painel-exposicao";
import { idDaAplicacao } from "./exposure-graph-model";

const app = (id: string, extra: Partial<AplicacaoExposta>): AplicacaoExposta => ({
  id, name: `App ${id}`, url: null, environment: "PROD", criticality: "HIGH", internetFacing: false, dataSensitivity: "INTERNAL",
  abertas: { CRITICAL: 1, HIGH: 2, MEDIUM: 0, LOW: 0 }, abertasPorOrigem: {}, totalAbertas: 3, totalResolvidas: 0,
  piorSeveridade: "CRITICAL", categorias: [], principais: [], ...extra,
});

const DADOS: ExposureGraph = {
  companyId: "c1",
  geradoEm: "2026-11-15T00:00:00Z",
  aplicacoes: [
    app("a1", {
      abertasPorOrigem: { DAST_IMPORT: 1, SAST_IMPORT: 2 },
      principais: [{ id: "v1", title: "SQLi no login", severityFinal: "CRITICAL", status: "OPEN", owaspCategory: "A03", sourceType: "SAST_IMPORT" }],
    }),
    app("a2", { abertasPorOrigem: { SCA_IMPORT: 3 } }),
  ],
};

const renderPainel = (selecionadoId: string | null) =>
  render(
    <MemoryRouter>
      <PainelExposicao dados={DADOS} selecionadoId={selecionadoId} aoSelecionar={() => undefined} />
    </MemoryRouter>,
  );

const contagens = () =>
  within(screen.getByLabelText("Abertas por origem"))
    .getAllByRole("definition")
    .map((d) => d.textContent);

describe("PainelExposicao — origem", () => {
  it("aplicação: abertas por origem (zeros inclusive) e selo na principal", () => {
    renderPainel(idDaAplicacao("a1"));
    // ordem DAST, SAST, SCA, Manual
    expect(contagens()).toEqual(["1", "2", "0", "0"]);
    const item = screen.getByRole("link", { name: "SQLi no login" }).closest("li")!;
    expect(within(item).getByLabelText("Origem: SAST")).toBeInTheDocument();
  });

  it("empresa: soma as origens de todas as aplicações", () => {
    renderPainel(null);
    expect(contagens()).toEqual(["1", "2", "3", "0"]);
  });
});
