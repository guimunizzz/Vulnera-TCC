/**
 * injetor.ts
 *
 * Costura os gráficos nativos num .xlsx já gerado pelo ExcelJS.
 *
 * COMO: o zip é REESCRITO em streaming (yauzl lê, yazl escreve). Só a aba do
 * Dashboard e o `[Content_Types].xml` são carregados em memória — a aba de
 * 50 mil linhas passa direto, de entrada a saída, sem virar string.
 *
 * POR QUE PRECISA DE ARQUIVO EM DISCO ANTES: o yauzl lê o zip pelo índice
 * final (acesso aleatório), então o ExcelJS escreve num arquivo temporário e
 * este módulo o lê. Efeito colateral bom: nenhum byte vai ao cliente antes de
 * a planilha estar inteira — falha na geração ainda vira status HTTP honesto,
 * não download truncado.
 *
 * O que é injetado, e onde:
 *   • `<drawing r:id="rId1"/>` no fim da aba do Dashboard (depois de
 *     `pageSetup`, como o schema exige — o ExcelJS não emite nada que viria depois);
 *   • `xl/worksheets/_rels/sheetN.xml.rels` → o desenho;
 *   • `xl/drawings/drawing1.xml` (+ rels) → um âncora por gráfico;
 *   • `xl/charts/chartK.xml`;
 *   • overrides em `[Content_Types].xml`.
 */

import { Readable } from "node:stream";
import yauzl from "yauzl";
import yazl from "yazl";
import { contentTypesDosGraficos, relsDaAba, relsDoDesenho, xmlDoDesenho, xmlDoGrafico, type GraficoNativo } from "./graficos";

function lerTudo(entrada: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    entrada.on("data", (d: Buffer) => partes.push(d));
    entrada.on("end", () => resolve(Buffer.concat(partes)));
    entrada.on("error", reject);
  });
}

export interface OpcoesDeInjecao {
  /** Caminho do .xlsx gerado pelo ExcelJS. */
  caminho: string;
  /** Parte do zip da aba que recebe o desenho. Ex.: `xl/worksheets/sheet3.xml`. */
  abaDoDashboard: string;
  graficos: GraficoNativo[];
}

/**
 * Devolve o xlsx final como stream. Qualquer erro de leitura/escrita do zip
 * destrói o stream com o erro — quem consome (a resposta HTTP) vê a falha.
 */
export function injetarGraficos({ caminho, abaDoDashboard, graficos }: OpcoesDeInjecao): Readable {
  const saida = new yazl.ZipFile();
  // O d.ts do yazl tipa `outputStream` como o ReadableStream legado; em runtime é um stream.Readable.
  const fluxo = saida.outputStream as unknown as Readable;
  const parteDaAba = abaDoDashboard.replace(/^xl\/worksheets\//, "");
  const relsDaAbaPath = `xl/worksheets/_rels/${parteDaAba}.rels`;

  yauzl.open(caminho, { lazyEntries: true, autoClose: true }, (erroAbrir, zip) => {
    if (erroAbrir || !zip) {
      fluxo.destroy(erroAbrir ?? new Error("XLSX_TEMPORARIO_ILEGIVEL"));
      return;
    }
    let achouAba = false;
    let achouTipos = false;
    const falhar = (erro: Error): void => {
      zip.close();
      fluxo.destroy(erro);
    };

    zip.on("error", falhar);
    zip.on("entry", (entrada: yauzl.Entry) => {
      zip.openReadStream(entrada, (erroLer, leitura) => {
        if (erroLer || !leitura) return falhar(erroLer ?? new Error("XLSX_ENTRADA_ILEGIVEL"));

        if (entrada.fileName === relsDaAbaPath) {
          return falhar(new Error("ABA_DO_DASHBOARD_JA_TEM_RELACIONAMENTOS"));
        }

        if (entrada.fileName === abaDoDashboard) {
          lerTudo(leitura)
            .then((buf) => {
              const xml = buf.toString("utf8");
              if (xml.includes("<drawing ")) throw new Error("ABA_DO_DASHBOARD_JA_TEM_DESENHO");
              if (!xml.includes("</worksheet>")) throw new Error("ABA_DO_DASHBOARD_SEM_FECHAMENTO");
              achouAba = true;
              saida.addBuffer(Buffer.from(xml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>'), "utf8"), entrada.fileName);
              zip.readEntry();
            })
            .catch(falhar);
        } else if (entrada.fileName === "[Content_Types].xml") {
          lerTudo(leitura)
            .then((buf) => {
              achouTipos = true;
              const xml = buf.toString("utf8").replace("</Types>", `${contentTypesDosGraficos(graficos.length)}</Types>`);
              saida.addBuffer(Buffer.from(xml, "utf8"), entrada.fileName);
              zip.readEntry();
            })
            .catch(falhar);
        } else {
          // Passagem direta: a aba de findings nunca é carregada inteira.
          saida.addReadStream(leitura, entrada.fileName);
          leitura.on("end", () => zip.readEntry());
          leitura.on("error", falhar);
        }
      });
    });

    zip.on("end", () => {
      if (!achouAba) return falhar(new Error("ABA_DO_DASHBOARD_NAO_ENCONTRADA"));
      if (!achouTipos) return falhar(new Error("CONTENT_TYPES_NAO_ENCONTRADO"));
      saida.addBuffer(Buffer.from(relsDaAba(), "utf8"), relsDaAbaPath);
      saida.addBuffer(Buffer.from(xmlDoDesenho(graficos), "utf8"), "xl/drawings/drawing1.xml");
      saida.addBuffer(Buffer.from(relsDoDesenho(graficos.length), "utf8"), "xl/drawings/_rels/drawing1.xml.rels");
      graficos.forEach((g, i) => saida.addBuffer(Buffer.from(xmlDoGrafico(g), "utf8"), `xl/charts/chart${i + 1}.xml`));
      saida.end();
    });

    zip.readEntry();
  });

  return fluxo;
}
