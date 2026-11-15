/**
 * code-import-dialog.test.tsx — envio do relatório SAST/SCA (ADR-052):
 * arquivo inválido nem sai do navegador, o projeto travado vai no envio e o
 * erro da API chega legível (não "Verifique os dados informados").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { CodeImportDialog } from "./code-import-dialog";

const api = vi.hoisted(() => ({ importReport: vi.fn() }));
vi.mock("../../lib/api/code-imports.api", () => ({ codeImportsApi: api }));
vi.mock("../../lib/api/projects.api", () => ({ projectsApi: { list: async () => [] } }));

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CodeImportDialog aberto aoFechar={() => {}} projetoFixo={{ id: "p1", name: "Portal" }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const input = view.container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
  return { input };
}

function arquivo(nome: string, conteudo = '{"version":"2.1.0","runs":[]}') {
  return new File([conteudo], nome, { type: "application/json" });
}

beforeEach(() => vi.clearAllMocks());

describe("Importar relatório SAST/SCA", () => {
  it("recusa no navegador um arquivo que não é .sarif/.json", () => {
    const { input } = renderDialog();
    fireEvent.change(input, { target: { files: [arquivo("relatorio.xml")] } });
    expect(screen.getByText(/\.sarif ou \.json/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    expect(api.importReport).not.toHaveBeenCalled();
  });

  it("envia o arquivo para o projeto travado", async () => {
    api.importReport.mockResolvedValue({ id: "imp-1" });
    const { input } = renderDialog();
    fireEvent.change(input, { target: { files: [arquivo("semgrep.sarif")] } });
    expect(screen.getByText("semgrep.sarif")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    await waitFor(() => expect(api.importReport).toHaveBeenCalledWith("p1", expect.any(File), expect.any(Function)));
  });

  it("mostra o erro da API por extenso", async () => {
    api.importReport.mockRejectedValue(
      new AxiosError("falha", "ERR_BAD_REQUEST", undefined, undefined, { status: 422, data: { error: "UNSUPPORTED_REPORT_FORMAT" } } as AxiosResponse),
    );
    const { input } = renderDialog();
    fireEvent.change(input, { target: { files: [arquivo("outro.json", '{"issues":[]}')] } });
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    expect(await screen.findByText(/Formato não reconhecido/)).toBeInTheDocument();
  });
});
