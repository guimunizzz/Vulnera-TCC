/**
 * botao-exportar-excel.tsx
 *
 * O QUE FAZ
 * O botão "Exportar Excel" da barra de ações de uma tabela de findings. Baixa a
 * planilha do recorte que a tabela mostra agora (ver `use-findings-excel-export.ts`).
 *
 * ESTADOS
 *   - carregando a lista ou recorte vazio → DESABILITADO, com o motivo no
 *     `title` e para o leitor de tela. Exportar um recorte vazio entregaria um
 *     arquivo só com cabeçalhos; e exportar antes de a contagem chegar seria
 *     exportar um recorte que ainda não se confirmou.
 *   - exportando → spinner + `aria-busy` (o `Button` mantém o foco: `aria-disabled`,
 *     não `disabled`) e o clique é ignorado.
 *
 * O resultado (sucesso, erro, "tentar novamente") é do toast — ver o hook.
 *
 * QUEM USA
 * `components/findings/findings-table.tsx`, quando `exportavelExcel` está ligado.
 */

import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { useFindingsExcelExport } from "../../hooks/use-findings-excel-export";

interface BotaoExportarExcelProps {
  /** Os parâmetros da view atual (os mesmos que alimentam a tabela). */
  params: URLSearchParams;
  /** Total do recorte, vindo da listagem. */
  total: number;
  /** A listagem já respondeu? Antes disso não há recorte confirmado. */
  temDados: boolean;
}

export function BotaoExportarExcel({ params, total, temDados }: BotaoExportarExcelProps) {
  const { exportar, exportando } = useFindingsExcelExport(params);

  const vazio = temDados && total === 0;
  const desabilitado = !temDados || vazio;
  const motivo = vazio ? "Nenhum finding para exportar" : !temDados ? "Aguardando os findings carregarem" : undefined;

  return (
    <>
      <Button
        variant="secundario"
        size="sm"
        onClick={exportar}
        carregando={exportando}
        disabled={desabilitado}
        title={motivo}
        aria-describedby={motivo ? "exportar-excel-motivo" : undefined}
        iconeInicio={<Download className="h-4 w-4" aria-hidden="true" />}
      >
        {exportando ? "Exportando..." : "Exportar Excel"}
      </Button>
      {/* O `Button` desabilitado tem `pointer-events: none`, então o `title` nunca aparece para quem
          usa mouse. Recorte vazio é a situação em que a pessoa PRECISA do motivo — fica visível. */}
      {motivo && (
        <span id="exportar-excel-motivo" className={vazio ? "text-xs text-fg-muted" : "sr-only"}>
          {motivo}
        </span>
      )}
    </>
  );
}
