/**
 * code-import-help.test.tsx — o "?" ao lado de "Importar relatório": o passo a
 * passo monta o comando certo por ferramenta, sistema e modo; todo comando
 * ignora dependências, builds e .env; no Windows o Semgrep sai com
 * PYTHONUTF8; e o botão final leva direto ao diálogo de importação.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AjudaImportacao } from "./code-import-help";
import { montarReceita, type Alvo, type Modo, type Sistema } from "../../lib/code-import-receitas";

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

const COMBINACOES: [Alvo, Modo][] = [
  ["codigo", "instalando"],
  ["codigo", "sem-instalar"],
  ["codigo", "docker"],
  ["dependencias", "instalando"],
  ["dependencias", "docker"],
];
const SISTEMAS: Sistema[] = ["windows", "mac", "linux"];

describe("montarReceita", () => {
  it.each(COMBINACOES.flatMap(([a, m]) => SISTEMAS.map((s) => [a, m, s] as const)))("%s · %s · %s ignora dependências, builds e .env", (alvo, modo, sistema) => {
    const { comando } = montarReceita(alvo, sistema, modo);
    if (alvo === "codigo") {
      expect(comando).toContain('--exclude "node_modules"');
      expect(comando).toContain('--exclude ".env*"');
      expect(comando).toContain("semgrep.sarif");
    } else {
      expect(comando).toContain('--skip-dirs "**/node_modules"');
      expect(comando).toContain('--skip-files "**/.env*"');
      expect(comando).toContain("sbom.cdx.json");
      expect(comando).not.toMatch(/lock/); // o SCA depende dos lockfiles
    }
  });

  it("Semgrep nativo no Windows força UTF-8 antes do scan; fora do Windows, não", () => {
    for (const modo of ["instalando", "sem-instalar"] as const) {
      const linhas = montarReceita("codigo", "windows", modo).comando.split("\n");
      const utf8 = linhas.indexOf("$env:PYTHONUTF8=1");
      expect(utf8).toBeGreaterThanOrEqual(0);
      expect(utf8).toBeLessThan(linhas.findIndex((l) => l.includes("semgrep scan")));
      expect(montarReceita("codigo", "mac", modo).comando).not.toContain("PYTHONUTF8");
    }
  });

  it("instala com o gerenciador de cada sistema e avisa da lentidão do Docker no Windows", () => {
    expect(montarReceita("codigo", "windows", "instalando").comando).toMatch(/^pip install semgrep\n/);
    expect(montarReceita("codigo", "mac", "instalando").comando).toMatch(/^brew install semgrep\n/);
    expect(montarReceita("dependencias", "windows", "instalando").comando).toMatch(/^scoop install trivy\n/);
    expect(montarReceita("dependencias", "linux", "instalando").comando).toMatch(/install\.sh/);
    expect(montarReceita("codigo", "windows", "docker").aviso).toMatch(/Docker/);
    expect(montarReceita("codigo", "linux", "docker").aviso).toBeUndefined();
  });
});

describe("Ajuda da importação SAST/SCA", () => {
  it("monta o comando a partir das escolhas e copia o bloco inteiro", async () => {
    renderAjuda();
    const dialogo = screen.getByRole("dialog", { name: "Como importar um relatório SAST/SCA" });

    fireEvent.click(within(dialogo).getByRole("radio", { name: /Windows/ }));
    expect(within(dialogo).getByRole("radio", { name: /O código \(SAST\)/ })).toHaveAttribute("aria-checked", "true");
    expect(within(dialogo).getByRole("radio", { name: /Instalando.*recomendado/i })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(dialogo).getByRole("button", { name: /^Copiar: PowerShell/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(montarReceita("codigo", "windows", "instalando").comando));
    expect(await screen.findByText("Copiado")).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("radio", { name: /As dependências \(SCA\)/ }));
    expect(within(dialogo).queryByRole("radio", { name: /Sem instalar/ })).not.toBeInTheDocument();
    expect(within(dialogo).getByRole("radio", { name: /Docker.*recomendado/i })).toHaveAttribute("aria-checked", "true");
    expect(within(dialogo).getByText("sbom.cdx.json")).toBeInTheDocument();
  });

  it("explica como abrir o terminal e o que conferir antes de importar", () => {
    renderAjuda();
    fireEvent.click(screen.getByRole("radio", { name: /macOS/ }));
    expect(screen.getByText(/Abra o Terminal e entre na pasta do projeto/)).toBeInTheDocument();
    expect(screen.getByText(/0 KB/)).toBeInTheDocument();
  });

  it("'Já tenho o arquivo — importar' fecha o guia e abre a importação", () => {
    const aoImportar = renderAjuda();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /importar$/ }));
    expect(aoImportar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
