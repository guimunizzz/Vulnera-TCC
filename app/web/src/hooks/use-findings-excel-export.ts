/**
 * use-findings-excel-export.ts
 *
 * O QUE FAZ
 * Baixa o recorte ATUAL de findings como planilha Excel formatada
 * (`GET /vulnerabilities/export.xlsx`): resumo, dados, dashboard e
 * acompanhamento de remediação.
 *
 * ==========================================================================
 * DIFERENÇA PARA `use-findings-export.ts` (o CSV)
 * ==========================================================================
 * O CSV é montado NO NAVEGADOR: pagina a listagem de 100 em 100, para em
 * 10.000 linhas e monta uma string. O Excel é montado NO SERVIDOR: o
 * formato (abas, fórmulas, gráficos nativos) não cabe numa aba do navegador, e
 * o limite é do produto (EXPORT_MAX_ROWS), com erro claro quando passa.
 * Os dois botões convivem — o CSV continua sendo o caminho para BI/importação.
 *
 * 🎯 O RECORTE É O DA TELA
 * Vão os mesmos parâmetros da tabela (filtros, busca, ordenação), sem a
 * paginação. O servidor aplica o MESMO escopo de acesso da listagem: a planilha
 * nunca tem uma linha que a tabela não mostraria.
 *
 * ESTADOS
 *   - exportando: o botão mostra spinner e ignora novo clique (trava reentrante:
 *     dois cliques não viram duas varreduras do banco e dois arquivos);
 *   - sucesso: o download começa sozinho e um toast confirma, com o nome do arquivo;
 *   - erro: toast com a mensagem em português e, quando repetir pode resolver,
 *     "Tentar novamente" — que reenvia o MESMO recorte do clique original, mesmo
 *     que a pessoa tenha mexido nos filtros nesse meio-tempo.
 *
 * QUEM USA
 * `components/findings/botao-exportar-excel.tsx`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../components/ui/toast";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import { interpretarErroDeExportacao, nomeDoArquivoDoHeader, paramsDaExportacao } from "../lib/findings-excel";
import { downloadBlob } from "../lib/pdf/base";

export interface ControlesDeExportacaoExcel {
  exportar: () => void;
  exportando: boolean;
}

export function useFindingsExcelExport(params: URLSearchParams): ControlesDeExportacaoExcel {
  const toast = useToast();
  const [exportando, setExportando] = useState(false);
  const emAndamento = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  /** `recorte` é o retrato dos parâmetros NO MOMENTO do clique — a nova tentativa reusa exatamente este. */
  const executar = useCallback(
    async (recorte: URLSearchParams): Promise<void> => {
      if (emAndamento.current) return;
      emAndamento.current = true;
      setExportando(true);
      try {
        const { blob, contentDisposition } = await vulnerabilitiesApi.exportXlsx(recorte);
        const nome = nomeDoArquivoDoHeader(contentDisposition);
        downloadBlob(blob, nome);
        toast.sucesso("Planilha exportada", nome);
      } catch (erro) {
        const info = await interpretarErroDeExportacao(erro);
        toast.erro(
          info.titulo,
          info.descricao,
          info.podeTentarDeNovo ? { rotulo: "Tentar novamente", aoClicar: () => void executar(recorte) } : undefined,
        );
      } finally {
        emAndamento.current = false;
        if (montado.current) setExportando(false);
      }
    },
    [toast],
  );

  const exportar = useCallback(() => {
    void executar(paramsDaExportacao(params));
  }, [executar, params]);

  return { exportar, exportando };
}
