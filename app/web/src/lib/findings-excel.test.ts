/**
 * findings-excel.test.ts
 *
 * As partes puras da exportação Excel.
 *
 *   FX-W-01  os parâmetros: filtros e ordenação vão, paginação não, o original não muda
 *   FX-W-02  o nome do arquivo vem do header e é saneado
 *   FX-W-03  header ausente cai num nome gerado
 *   FX-W-04  cada erro da API vira uma mensagem em português — sem código HTTP
 *   FX-W-05  só se oferece "tentar novamente" quando repetir pode resolver
 */

import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { interpretarErroDeExportacao, nomeDeArquivoPadrao, nomeDoArquivoDoHeader, paramsDaExportacao } from "./findings-excel";

/** Um erro de axios como o que chega com `responseType: "blob"`: o corpo JSON vem como Blob. */
function erroDaApi(status: number, corpo: unknown, headers: Record<string, string> = {}): AxiosError {
  const blob = new Blob([JSON.stringify(corpo)], { type: "application/json" });
  return new AxiosError("falhou", String(status), undefined, undefined, {
    status,
    statusText: "",
    data: blob,
    headers,
    config: { headers: new AxiosHeaders() } as InternalAxiosRequestConfig,
  });
}

describe("findings-excel · parâmetros", () => {
  it("FX-W-01 mantém filtros, busca e ordenação; tira só a paginação", () => {
    const original = new URLSearchParams(
      "severity=HIGH,CRITICAL&status=OPEN&search=sql%20injection&projectId=p1&sortBy=severity&sortOrder=desc&page=3&pageSize=25",
    );
    const enviados = paramsDaExportacao(original);

    expect(enviados.get("severity")).toBe("HIGH,CRITICAL");
    expect(enviados.get("status")).toBe("OPEN");
    expect(enviados.get("search")).toBe("sql injection");
    expect(enviados.get("projectId")).toBe("p1");
    expect(enviados.get("sortBy")).toBe("severity");
    expect(enviados.get("sortOrder")).toBe("desc");
    expect(enviados.has("page")).toBe(false);
    expect(enviados.has("pageSize")).toBe(false);
    // O original é o estado da tela: não pode ser mutado.
    expect(original.get("page")).toBe("3");
    expect(original.get("pageSize")).toBe("25");
  });

  it("FX-W-01 sem filtro nenhum, só a ordenação viaja", () => {
    expect(paramsDaExportacao(new URLSearchParams("page=1&pageSize=25&sortBy=createdAt&sortOrder=desc")).toString()).toBe(
      "sortBy=createdAt&sortOrder=desc",
    );
  });
});

describe("findings-excel · nome do arquivo", () => {
  it("FX-W-02 lê filename entre aspas e filename* (UTF-8)", () => {
    expect(nomeDoArquivoDoHeader('attachment; filename="findings_todos_2026-10-22_1130.xlsx"')).toBe("findings_todos_2026-10-22_1130.xlsx");
    expect(nomeDoArquivoDoHeader("attachment; filename*=UTF-8''findings_a%C3%A7a%C3%AD_2026-10-22_1130.xlsx")).toBe("findings_açaí_2026-10-22_1130.xlsx");
    // O estendido vence o simples quando os dois existem.
    expect(nomeDoArquivoDoHeader('attachment; filename="findings_x.xlsx"; filename*=UTF-8\'\'findings_y.xlsx')).toBe("findings_y.xlsx");
  });

  it("FX-W-02 sanea o que vem de fora: caminho, controle, extensão", () => {
    const caminho = nomeDoArquivoDoHeader('attachment; filename="../../etc/passwd"');
    expect(caminho).not.toContain("/"); // nenhum separador de caminho sobrevive
    expect(caminho).not.toContain("\\");
    expect(caminho.startsWith(".")).toBe(false);
    expect(caminho.endsWith(".xlsx")).toBe(true);
    const hostil = nomeDoArquivoDoHeader('attachment; filename="..\\..\\evil\u0000.exe"');
    // eslint-disable-next-line no-control-regex
    expect(hostil).not.toMatch(/[\\/:*?"<>|\u0000-\u001F]/);
    expect(hostil.endsWith(".xlsx")).toBe(true);
    expect(nomeDoArquivoDoHeader('attachment; filename="relatorio"')).toBe("relatorio.xlsx");
    expect(nomeDoArquivoDoHeader('attachment; filename=".oculto.xlsx"')).toBe("oculto.xlsx");
  });

  it("FX-W-02 percent-encoding inválido no filename* não derruba: cai no filename simples", () => {
    expect(nomeDoArquivoDoHeader("attachment; filename=\"ok.xlsx\"; filename*=UTF-8''%E0%A4%A")).toBe("ok.xlsx");
  });

  it("FX-W-03 sem header (ou sem nome) usa um nome gerado no padrão do servidor", () => {
    const padrao = () => "findings_fixo.xlsx";
    expect(nomeDoArquivoDoHeader(undefined, padrao)).toBe("findings_fixo.xlsx");
    expect(nomeDoArquivoDoHeader("attachment", padrao)).toBe("findings_fixo.xlsx");
    expect(nomeDoArquivoDoHeader('attachment; filename=""', padrao)).toBe("findings_fixo.xlsx");
    expect(nomeDeArquivoPadrao(new Date(2026, 9, 22, 11, 30))).toBe("findings_2026-10-22_1130.xlsx");
  });
});

describe("findings-excel · erros", () => {
  it("FX-W-04 limite excedido diz quantos são e qual é o teto — e não oferece repetir", async () => {
    const r = await interpretarErroDeExportacao(erroDaApi(422, { error: "EXPORT_LIMIT_EXCEEDED", limit: 50000, total: 63000 }));
    expect(r.titulo).toBe("Recorte grande demais para exportar");
    expect(r.descricao).toContain("63.000");
    expect(r.descricao).toContain("50.000");
    expect(r.podeTentarDeNovo).toBe(false);
  });

  it("FX-W-04 rate limit usa o Retry-After e oferece repetir", async () => {
    const r = await interpretarErroDeExportacao(erroDaApi(429, { code: "RATE_LIMITED" }, { "retry-after": "17" }));
    expect(r.titulo).toBe("Muitas exportações seguidas");
    expect(r.descricao).toContain("17 segundos");
    expect(r.podeTentarDeNovo).toBe(true);
    // Singular quando é 1 segundo.
    expect((await interpretarErroDeExportacao(erroDaApi(429, {}, { "retry-after": "1" }))).descricao).toBe("Aguarde 1 segundo e tente de novo.");
    // Sem o header, a mensagem continua útil.
    expect((await interpretarErroDeExportacao(erroDaApi(429, {}))).descricao).toBe("Aguarde um instante e tente de novo.");
  });

  it("FX-W-04 permissão, filtro inválido e dados que mudaram", async () => {
    for (const status of [403, 404]) {
      const r = await interpretarErroDeExportacao(erroDaApi(status, { error: "FORBIDDEN" }));
      expect(r.titulo).toBe("Sem acesso a este recorte");
      expect(r.podeTentarDeNovo).toBe(false);
    }
    const invalido = await interpretarErroDeExportacao(erroDaApi(400, { error: "INVALID_SEVERITY" }));
    expect(invalido).toMatchObject({ titulo: "Filtro inválido", podeTentarDeNovo: false });
    const mudou = await interpretarErroDeExportacao(erroDaApi(409, { error: "EXPORT_DATA_CHANGED" }));
    expect(mudou).toMatchObject({ titulo: "Os dados mudaram", podeTentarDeNovo: true });
  });

  it("FX-W-04 rede fora, 5xx e erro desconhecido → mensagem genérica que oferece repetir", async () => {
    for (const erro of [new Error("rede"), new AxiosError("sem resposta"), erroDaApi(500, { error: "INTERNAL_ERROR" }), erroDaApi(502, "<html>bad gateway</html>"), "texto solto", null]) {
      const r = await interpretarErroDeExportacao(erro);
      expect(r).toMatchObject({ titulo: "Não foi possível exportar", podeTentarDeNovo: true });
    }
  });

  it("FX-W-04 nenhuma mensagem expõe código HTTP, nome de código de erro ou JSON", async () => {
    const todas = await Promise.all(
      [
        erroDaApi(422, { error: "EXPORT_LIMIT_EXCEEDED", limit: 1, total: 2 }),
        erroDaApi(429, { code: "RATE_LIMITED" }, { "retry-after": "3" }),
        erroDaApi(403, { error: "FORBIDDEN" }),
        erroDaApi(400, { error: "INVALID_SORT_BY" }),
        erroDaApi(409, { error: "EXPORT_DATA_CHANGED" }),
        erroDaApi(500, { error: "INTERNAL_ERROR" }),
      ].map(interpretarErroDeExportacao),
    );
    for (const r of todas) {
      const texto = `${r.titulo} ${r.descricao}`;
      expect(texto).not.toMatch(/\b(4\d\d|5\d\d)\b|EXPORT_|INVALID_|FORBIDDEN|INTERNAL_ERROR|RATE_LIMITED|\{|\}/);
    }
  });

  it("FX-W-05 422 com corpo ilegível não afirma números que não tem", async () => {
    const r = await interpretarErroDeExportacao(erroDaApi(422, { error: "OUTRA_COISA" }));
    expect(r.descricao).not.toMatch(/\d/);
    expect(r.podeTentarDeNovo).toBe(true);
  });
});
