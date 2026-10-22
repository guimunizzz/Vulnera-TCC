/**
 * botao-exportar-excel.test.tsx
 *
 * O botão "Exportar Excel" de ponta a ponta no front: clique → API → download →
 * toast. A API e o download do navegador são simulados; tudo o mais é o código real.
 *
 *   FX-W-10  estados: pronto, carregando a lista, recorte vazio
 *   FX-W-11  sucesso: loading, requisição com o recorte (sem paginação), download com o nome do header, toast
 *   FX-W-12  clique duplo não vira duas exportações
 *   FX-W-13  falha transitória: toast com "Tentar novamente", que reenvia o MESMO recorte
 *   FX-W-14  falha sem remédio (limite, permissão): mensagem clara e SEM "tentar novamente"
 *   FX-W-15  o botão volta ao normal depois de qualquer desfecho
 */

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../ui/toast";
import { BotaoExportarExcel } from "./botao-exportar-excel";

const { exportXlsx, downloadBlob } = vi.hoisted(() => ({ exportXlsx: vi.fn(), downloadBlob: vi.fn() }));
vi.mock("../../lib/api/vulnerabilities.api", () => ({
  FINDINGS_PAGE_SIZE_MAX: 100,
  vulnerabilitiesApi: { exportXlsx },
}));
vi.mock("../../lib/pdf/base", () => ({ downloadBlob }));

const PARAMS = new URLSearchParams("severity=CRITICAL&status=OPEN&sortBy=title&sortOrder=asc&page=4&pageSize=25");

function renderizar(props: Partial<React.ComponentProps<typeof BotaoExportarExcel>> = {}) {
  const base = { params: PARAMS, total: 12, temDados: true };
  const ui = (p: typeof base) => (
    <ToastProvider>
      <BotaoExportarExcel {...p} />
    </ToastProvider>
  );
  const r = render(ui({ ...base, ...props }));
  return { ...r, atualizar: (novas: Partial<typeof base>) => r.rerender(ui({ ...base, ...props, ...novas })) };
}

// O rótulo muda para "Exportando..." durante a geração — o seletor cobre os dois.
const botao = () => screen.getByRole("button", { name: /exporta(r|ndo)/i });
const planilha = () => ({ blob: new Blob(["xlsx"]), contentDisposition: 'attachment; filename="findings_filtrado_2026-10-22_1130.xlsx"' });

function erroDaApi(status: number, corpo: unknown, headers: Record<string, string> = {}): AxiosError {
  return new AxiosError("falhou", String(status), undefined, undefined, {
    status,
    statusText: "",
    data: new Blob([JSON.stringify(corpo)], { type: "application/json" }),
    headers,
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  });
}

/** Uma promessa que o teste resolve na hora que quiser — para observar o estado "carregando". */
function pendente<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe("Botão Exportar Excel", () => {
  beforeEach(() => {
    exportXlsx.mockReset();
    downloadBlob.mockReset();
  });

  it("FX-W-10 pronto: habilitado, com o rótulo e sem aviso", () => {
    renderizar();
    expect(botao()).toBeEnabled();
    expect(botao()).toHaveTextContent("Exportar Excel");
    expect(screen.queryByText(/nenhum finding para exportar/i)).not.toBeInTheDocument();
  });

  it("FX-W-10 recorte vazio: desabilitado e o motivo FICA VISÍVEL (o title não aparece em botão desabilitado)", () => {
    renderizar({ total: 0 });
    expect(botao()).toBeDisabled();
    expect(botao()).toHaveAttribute("title", "Nenhum finding para exportar");
    const aviso = screen.getByText("Nenhum finding para exportar", { selector: "span" });
    expect(aviso).toBeVisible();
    expect(aviso).not.toHaveClass("sr-only");
    expect(botao()).toHaveAccessibleDescription("Nenhum finding para exportar");
  });

  it("FX-W-10 lista ainda carregando: desabilitado, motivo só para leitor de tela (não grita 'vazio' antes da hora)", () => {
    renderizar({ temDados: false, total: 0 });
    expect(botao()).toBeDisabled();
    expect(screen.queryByText("Nenhum finding para exportar")).not.toBeInTheDocument();
    expect(botao()).toHaveAccessibleDescription("Aguardando os findings carregarem");
  });

  it("FX-W-10 desabilitado não exporta mesmo se clicado", async () => {
    renderizar({ total: 0 });
    await userEvent.click(botao());
    expect(exportXlsx).not.toHaveBeenCalled();
  });

  it("FX-W-11 sucesso: loading durante a geração, recorte sem paginação, download com o nome do servidor e toast", async () => {
    const geracao = pendente<ReturnType<typeof planilha>>();
    exportXlsx.mockReturnValue(geracao.promessa);
    renderizar();

    await userEvent.click(botao());

    // Durante a geração: ocupado, e o foco continua no botão (aria-disabled, não disabled).
    await waitFor(() => expect(botao()).toHaveAttribute("aria-busy", "true"));
    expect(botao()).toHaveAttribute("aria-disabled", "true");
    expect(botao()).toHaveFocus();

    // O recorte da tela viajou — e a paginação não.
    expect(exportXlsx).toHaveBeenCalledTimes(1);
    const enviados = exportXlsx.mock.calls[0]![0] as URLSearchParams;
    expect(enviados.get("severity")).toBe("CRITICAL");
    expect(enviados.get("status")).toBe("OPEN");
    expect(enviados.get("sortBy")).toBe("title");
    expect(enviados.get("sortOrder")).toBe("asc");
    expect(enviados.has("page")).toBe(false);
    expect(enviados.has("pageSize")).toBe(false);
    expect(downloadBlob).not.toHaveBeenCalled();

    geracao.resolver(planilha());

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(downloadBlob.mock.calls[0]![1]).toBe("findings_filtrado_2026-10-22_1130.xlsx");
    expect(downloadBlob.mock.calls[0]![0]).toBeInstanceOf(Blob);

    const regiao = screen.getByRole("region", { name: "Notificações" });
    expect(await within(regiao).findByText("Planilha exportada")).toBeInTheDocument();
    expect(within(regiao).getByText("findings_filtrado_2026-10-22_1130.xlsx")).toBeInTheDocument();
    expect(within(regiao).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("FX-W-11 não altera os parâmetros da tela (o original segue com a paginação)", async () => {
    exportXlsx.mockResolvedValue(planilha());
    renderizar();
    await userEvent.click(botao());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(PARAMS.get("page")).toBe("4");
    expect(PARAMS.get("pageSize")).toBe("25");
  });

  it("FX-W-11 sem Content-Disposition (header escondido por CORS) ainda baixa, com nome gerado", async () => {
    exportXlsx.mockResolvedValue({ blob: new Blob(["x"]), contentDisposition: undefined });
    renderizar();
    await userEvent.click(botao());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(downloadBlob.mock.calls[0]![1]).toMatch(/^findings_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);
  });

  it("FX-W-12 clique duplo durante a geração não dispara uma segunda exportação", async () => {
    const geracao = pendente<ReturnType<typeof planilha>>();
    exportXlsx.mockReturnValue(geracao.promessa);
    renderizar();

    await userEvent.click(botao());
    await userEvent.click(botao());
    await userEvent.click(botao());
    expect(exportXlsx).toHaveBeenCalledTimes(1);

    geracao.resolver(planilha());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  });

  it("FX-W-13 falha transitória: toast de erro com 'Tentar novamente'; ele reenvia o MESMO recorte do clique original", async () => {
    exportXlsx.mockRejectedValueOnce(new AxiosError("Network Error")).mockResolvedValueOnce(planilha());
    const { atualizar } = renderizar();

    await userEvent.click(botao());

    const regiao = screen.getByRole("region", { name: "Notificações" });
    const alerta = await within(regiao).findByRole("alert");
    expect(within(alerta).getByText("Não foi possível exportar")).toBeInTheDocument();
    expect(alerta).not.toHaveTextContent(/network|axios|\b5\d\d\b/i);
    expect(downloadBlob).not.toHaveBeenCalled();
    await waitFor(() => expect(botao()).not.toHaveAttribute("aria-busy"));

    // A pessoa mexe nos filtros ANTES de repetir: a nova tentativa deve ser do recorte que ela pediu exportar.
    atualizar({ params: new URLSearchParams("severity=LOW&sortBy=createdAt&sortOrder=desc") });
    await userEvent.click(within(alerta).getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(exportXlsx).toHaveBeenCalledTimes(2);
    expect((exportXlsx.mock.calls[1]![0] as URLSearchParams).toString()).toBe((exportXlsx.mock.calls[0]![0] as URLSearchParams).toString());
    expect((exportXlsx.mock.calls[1]![0] as URLSearchParams).get("severity")).toBe("CRITICAL");
    // O aviso de erro fechou ao clicar em tentar novamente.
    await waitFor(() => expect(within(regiao).queryByRole("alert")).not.toBeInTheDocument());
  });

  it("FX-W-13 rate limit: avisa o tempo de espera e oferece tentar novamente", async () => {
    exportXlsx.mockRejectedValueOnce(erroDaApi(429, { code: "RATE_LIMITED" }, { "retry-after": "12" }));
    renderizar();
    await userEvent.click(botao());
    const alerta = await within(screen.getByRole("region", { name: "Notificações" })).findByRole("alert");
    expect(within(alerta).getByText("Muitas exportações seguidas")).toBeInTheDocument();
    expect(within(alerta).getByText(/12 segundos/)).toBeInTheDocument();
    expect(within(alerta).getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("FX-W-14 acima do limite: diz quantos são e o teto, e NÃO oferece tentar novamente", async () => {
    exportXlsx.mockRejectedValueOnce(erroDaApi(422, { error: "EXPORT_LIMIT_EXCEEDED", limit: 50000, total: 63000 }));
    renderizar({ total: 63000 });
    await userEvent.click(botao());

    const alerta = await within(screen.getByRole("region", { name: "Notificações" })).findByRole("alert");
    expect(within(alerta).getByText("Recorte grande demais para exportar")).toBeInTheDocument();
    expect(within(alerta).getByText(/63\.000 findings.*50\.000/)).toBeInTheDocument();
    expect(within(alerta).queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("FX-W-14 sem permissão: mensagem clara, sem repetir", async () => {
    exportXlsx.mockRejectedValueOnce(erroDaApi(403, { error: "FORBIDDEN" }));
    renderizar();
    await userEvent.click(botao());
    const alerta = await within(screen.getByRole("region", { name: "Notificações" })).findByRole("alert");
    expect(within(alerta).getByText("Sem acesso a este recorte")).toBeInTheDocument();
    expect(within(alerta).queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("FX-W-15 depois de sucesso OU erro o botão volta a funcionar", async () => {
    exportXlsx.mockResolvedValueOnce(planilha()).mockRejectedValueOnce(erroDaApi(403, {})).mockResolvedValueOnce(planilha());
    renderizar();

    await userEvent.click(botao());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(botao()).not.toHaveAttribute("aria-busy"));

    await userEvent.click(botao());
    await waitFor(() => expect(botao()).not.toHaveAttribute("aria-busy"));
    expect(botao()).toBeEnabled();

    await userEvent.click(botao());
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2));
    expect(exportXlsx).toHaveBeenCalledTimes(3);
  });
});
