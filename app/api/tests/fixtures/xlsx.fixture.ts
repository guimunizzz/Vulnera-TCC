/**
 * xlsx.fixture.ts
 *
 * Baixa a exportação Excel pela API REAL e a lê de volta com o ExcelJS — o
 * teste compara o CONTEÚDO do arquivo, não o que o código acha que escreveu.
 */

import request from "supertest";
import ExcelJS from "exceljs";
import type { Express } from "express";

export interface RespostaDeExportacao {
  status: number;
  headers: Record<string, string>;
  /** Corpo JSON quando a resposta não é um arquivo (400, 403, 404, 422…). */
  json: any;
  buffer: Buffer;
  /** Presente só quando `status === 200`. */
  wb: ExcelJS.Workbook | null;
}

function comoBinario(res: request.Response, cb: (err: Error | null, corpo: Buffer) => void): void {
  const partes: Buffer[] = [];
  res.on("data", (parte: Buffer) => partes.push(parte));
  res.on("end", () => cb(null, Buffer.concat(partes)));
}

export async function exportarXlsx(app: Express, token: string | null, query = ""): Promise<RespostaDeExportacao> {
  let req = request(app).get(`/api/vulnerabilities/export.xlsx${query ? `?${query}` : ""}`);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  const res = await req.buffer(true).parse(comoBinario);

  const buffer = res.body as Buffer;
  const ehJson = String(res.headers["content-type"] ?? "").includes("application/json");
  let wb: ExcelJS.Workbook | null = null;
  if (res.status === 200) {
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  }
  return {
    status: res.status,
    headers: res.headers as Record<string, string>,
    json: ehJson ? JSON.parse(buffer.toString("utf8")) : null,
    buffer,
    wb,
  };
}

/** O valor "de verdade" de uma célula: fórmula → o resultado em cache; data → Date; texto → string. */
export function valorDe(cell: ExcelJS.Cell): unknown {
  const v = cell.value as any;
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t: { text: string }) => t.text).join("");
  return v;
}

/** As linhas da aba Findings como objetos `{ "Título": ..., "Severidade": ... }`. */
export function linhasDeFindings(wb: ExcelJS.Workbook): Array<Record<string, unknown>> {
  const ws = wb.getWorksheet("Findings")!;
  const cabecalho: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, c) => {
    cabecalho[c] = String(valorDe(cell));
  });
  const linhas: Array<Record<string, unknown>> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 1; c < cabecalho.length; c++) obj[cabecalho[c]!] = valorDe(row.getCell(c));
    linhas.push(obj);
  }
  return linhas;
}

/** Todo o texto do arquivo (todas as abas, inclusive a oculta) — para provar que algo NÃO vazou. */
export function textoDeTudo(wb: ExcelJS.Workbook): string {
  const partes: string[] = [];
  wb.eachSheet((ws) => {
    ws.eachRow((row) => row.eachCell((cell) => partes.push(String(valorDe(cell) ?? ""))));
  });
  return partes.join("\n");
}

/** Nomes das partes do zip (`xl/charts/chart1.xml`…) — para provar que os gráficos nativos estão lá. */
export function partesDoZip(buffer: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yauzl = require("yauzl") as typeof import("yauzl");
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (erro, zip) => {
      if (erro || !zip) return reject(erro ?? new Error("zip ilegível"));
      const nomes: string[] = [];
      zip.on("entry", (e) => {
        nomes.push(e.fileName);
        zip.readEntry();
      });
      zip.on("end", () => resolve(nomes));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

/** O XML cru de uma parte do pacote (ex.: `xl/worksheets/sheet3.xml`). */
export function xmlDaParte(buffer: Buffer, nome: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yauzl = require("yauzl") as typeof import("yauzl");
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (erro, zip) => {
      if (erro || !zip) return reject(erro ?? new Error("zip ilegível"));
      zip.on("entry", (e) => {
        if (e.fileName !== nome) return zip.readEntry();
        zip.openReadStream(e, (err2, leitura) => {
          if (err2 || !leitura) return reject(err2 ?? new Error("parte ilegível"));
          const partes: Buffer[] = [];
          leitura.on("data", (p: Buffer) => partes.push(p));
          leitura.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
          leitura.on("error", reject);
        });
      });
      zip.on("end", () => reject(new Error(`parte ${nome} não existe no pacote`)));
      zip.on("error", reject);
      zip.readEntry();
    });
  });
}

/** As partes (aba → arquivo) na ordem fixa em que o gerador as cria. */
export const PARTE = {
  resumo: "xl/worksheets/sheet1.xml",
  findings: "xl/worksheets/sheet2.xml",
  dashboard: "xl/worksheets/sheet3.xml",
  acompanhamento: "xl/worksheets/sheet4.xml",
  auxiliar: "xl/worksheets/sheet5.xml",
} as const;

/**
 * Fórmula e resultado EM CACHE de uma célula, lidos do XML.
 *
 * Por que não pelo ExcelJS: o leitor dele descarta `result: 0`. O arquivo está
 * certo (`<v>0</v>`); ler do XML também prova que o cache EXISTE — é o que o
 * LibreOffice, o Excel Online e as prévias mostram sem recalcular.
 */
export function cacheDaCelula(xml: string, ref: string): { formula: string | null; valor: number | string | null } {
  const m = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>(.*?)</c>)`, "s").exec(xml);
  if (!m) throw new Error(`célula ${ref} não encontrada`);
  const miolo = m[2] ?? "";
  const des = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const f = /<f[^>]*>(.*?)<\/f>/s.exec(miolo);
  const v = /<v>(.*?)<\/v>/s.exec(miolo);
  const ehTexto = /t="str"/.test(m[1] ?? "");
  return { formula: f ? des(f[1]!) : null, valor: v ? (ehTexto ? des(v[1]!) : Number(v[1])) : null };
}
