/**
 * code-import-help.test.tsx — o "?" ao lado de "Importar relatório": abre o
 * guia com o fluxo e os comandos por ferramenta, copia o comando e leva
 * direto ao diálogo de importação.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AjudaImportacao } from "./code-import-help";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

function renderAjuda(aoImportar = vi.fn()) {
  render(
    <MemoryRouter>
      <AjudaImportacao aoImportar={aoImportar} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Como importar um relatório SAST/SCA" }));
  return aoImportar;
}

describe("Ajuda da importação SAST/SCA", () => {
  it("abre o guia com o fluxo em cinco passos", () => {
    renderAjuda();
    const dialogo = screen.getByRole("dialog", { name: "Como importar um relatório SAST/SCA" });
    const fluxo = within(dialogo).getByRole("region", { name: "O fluxo" });
    expect(within(fluxo).getAllByRole("listitem")).toHaveLength(5);
    expect(within(fluxo).getByText("Corrija e reimporte")).toBeInTheDocument();
  });

  it("mostra os comandos por ferramenta e copia o escolhido", async () => {
    renderAjuda();
    expect(screen.getByText(/semgrep scan --config p\/default --sarif --output semgrep\.sarif/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Trivy" }));
    expect(screen.getByText(/trivy fs --scanners vuln --format cyclonedx --output sbom\.cdx\.json \./)).toBeInTheDocument();
    expect(screen.getByText(/Sem lockfile no repositório/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copiar: Instalado na máquina" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("trivy fs --scanners vuln --format cyclonedx --output sbom.cdx.json ."));
    expect(await screen.findByText("Copiado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "GitHub Actions" }));
    expect(screen.getByText(/actions\/upload-artifact@v4/)).toBeInTheDocument();
  });

  it("'Importar relatório' fecha o guia e abre a importação", () => {
    const aoImportar = renderAjuda();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Importar relatório" }));
    expect(aoImportar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
