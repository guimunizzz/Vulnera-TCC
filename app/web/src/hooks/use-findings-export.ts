/**
 * use-findings-export.ts
 *
 * O QUE FAZ
 * Baixa o recorte ATUAL de findings como CSV — o mesmo que a tabela está
 * mostrando, só que inteiro, não só a página visível.
 *
 * 🎯 EXPORTA O RECORTE, NÃO A PÁGINA
 * É a diferença entre a funcionalidade servir para alguma coisa e não servir.
 * Quem filtra "críticos abertos" e exporta espera os 40 críticos abertos, não
 * os 25 que couberam na tela. Sem filtro nenhum, exporta tudo que o ator pode
 * ver — com o mesmo escopo por papel que a listagem já aplica (RN16/RN17); o
 * CSV nunca contém uma linha que a pessoa não veria na tabela.
 *
 * COMO: PAGINA ATÉ O FIM
 * O endpoint tem teto de 100 por página (e o teto existe por um motivo), então
 * a exportação percorre as páginas em sequência. Não em paralelo: dez
 * requisições simultâneas para exportar uma planilha castigariam o banco para
 * economizar segundos que ninguém está contando.
 *
 * O PDF é gerado no cliente desde a Fase 6 (ADR-003) e este arquivo segue a
 * mesma escolha: o servidor entrega dados, o navegador monta o arquivo. Uma
 * rota `/export.csv` exigiria autenticar um download, que é justamente o
 * problema que o ADR-003 evitou.
 *
 * QUEM USA
 * `components/findings/findings-table.tsx`.
 */

import { useCallback, useRef, useState } from "react";
import { vulnerabilitiesApi, FINDINGS_PAGE_SIZE_MAX } from "../lib/api/vulnerabilities.api";
import { downloadBlob } from "../lib/pdf/base";
import { montarCsv, nomeDoArquivo } from "../lib/findings-csv";
import type { FindingListItem } from "../types/vulnerability.types";

/**
 * Teto de segurança: 100 páginas = 10.000 findings.
 *
 * Não é o limite do produto, é o limite de uma aba de navegador montando uma
 * string na memória. Passando disso a exportação para e AVISA quantas linhas
 * saíram — truncar em silêncio entregaria uma planilha incompleta com cara de
 * completa, que é pior que não exportar.
 */
const MAX_PAGINAS = 100;

export interface ControlesDeExportacao {
  exportar: () => void;
  exportando: boolean;
  /** Quantos já vieram / quantos existem — alimenta o rótulo do botão. */
  progresso: { baixados: number; total: number } | null;
  erro: string | null;
  /** Aviso quando o teto foi atingido; `null` quando saiu inteiro. */
  aviso: string | null;
}

export function useFindingsExport(params: URLSearchParams, temFiltro: boolean): ControlesDeExportacao {
  const [exportando, setExportando] = useState(false);
  const [progresso, setProgresso] = useState<{ baixados: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Trava reentrante: dois cliques rápidos no botão não podem virar duas
  // varreduras concorrentes do banco e dois arquivos baixados.
  const emAndamento = useRef(false);

  const exportar = useCallback(() => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setExportando(true);
    setErro(null);
    setAviso(null);
    setProgresso({ baixados: 0, total: 0 });

    void (async () => {
      try {
        const todos: FindingListItem[] = [];
        let pagina = 1;
        let totalDePaginas = 1;

        do {
          const daPagina = new URLSearchParams(params);
          daPagina.set("page", String(pagina));
          daPagina.set("pageSize", String(FINDINGS_PAGE_SIZE_MAX));

          const resposta = await vulnerabilitiesApi.search(daPagina);
          todos.push(...resposta.data);
          totalDePaginas = resposta.pagination.totalPages;
          setProgresso({ baixados: todos.length, total: resposta.pagination.total });
          pagina += 1;
        } while (pagina <= totalDePaginas && pagina <= MAX_PAGINAS);

        if (totalDePaginas > MAX_PAGINAS) {
          setAviso(
            `O recorte tem mais de ${MAX_PAGINAS * FINDINGS_PAGE_SIZE_MAX} findings. ` +
              `Foram exportados os ${todos.length} primeiros — filtre mais para levar o resto.`,
          );
        }

        const blob = new Blob([montarCsv(todos)], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, nomeDoArquivo(temFiltro));
      } catch {
        // Mensagem de produto, não o erro do axios: quem clicou em "Exportar"
        // não tem o que fazer com um código HTTP.
        setErro("Não foi possível exportar. A busca não chegou ao servidor — tente de novo.");
      } finally {
        emAndamento.current = false;
        setExportando(false);
        setProgresso(null);
      }
    })();
  }, [params, temFiltro]);

  return { exportar, exportando, progresso, erro, aviso };
}
