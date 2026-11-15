/**
 * origem-card.test.tsx — visão unificada no painel da aplicação: abertos por
 * origem (DAST, SAST, SCA, manual), fila de triagem do código e links só para
 * quem tem as rotas (ADMIN).
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrigemCard } from "./origem-card";

function renderCard(props: Partial<Parameters<typeof OrigemCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <OrigemCard
        applicationId="app-1"
        abertosPorOrigem={{ DAST_IMPORT: 1, SAST_IMPORT: 3, MANUAL: 2 }}
        filaDeTriagem={{ SAST: 4, SCA: 2 }}
        carregando={false}
        comLinks
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("OrigemCard", () => {
  it("mostra as quatro origens com o número escrito, inclusive zero", () => {
    renderCard();
    const lista = screen.getByRole("list", { name: "Findings em aberto por origem" });
    const linhas = within(lista).getAllByRole("listitem");
    expect(linhas.map((l) => l.textContent)).toEqual(["DAST1", "SAST3", "SCA0", "Manual2"]);
  });

  it("ADMIN: cada origem com abertos leva a Achados filtrados; a fila leva ao SAST/SCA", () => {
    renderCard();
    expect(screen.getByRole("link", { name: /3 findings abertos de origem SAST_IMPORT/ })).toHaveAttribute(
      "href",
      "/findings?applicationId=app-1&sourceType=SAST_IMPORT&status=OPEN,IN_PROGRESS",
    );
    // Origem sem nada aberto não vira link para uma lista vazia.
    expect(screen.queryByRole("link", { name: /origem SCA_IMPORT/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Fila de triagem do código/)).toHaveTextContent("4 SAST e 2 SCA");
    expect(screen.getByRole("link", { name: "Abrir SAST/SCA" })).toHaveAttribute("href", "/sast-sca");
  });

  it("CLIENT: sem links e sem fila (a API manda null)", () => {
    renderCard({ comLinks: false, filaDeTriagem: null });
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(/Fila de triagem/)).not.toBeInTheDocument();
  });

  it("estados vazios: nada aberto e fila zerada", () => {
    renderCard({ abertosPorOrigem: {}, filaDeTriagem: { SAST: 0, SCA: 0 } });
    expect(screen.getByText("Nenhum finding em aberto no recorte.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum achado de código aguardando triagem.")).toBeInTheDocument();
  });
});
