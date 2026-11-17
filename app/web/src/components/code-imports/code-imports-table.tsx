/**
 * code-imports-table.tsx
 *
 * Lista de importações SAST/SCA (ADR-052). Usada na página global "SAST/SCA"
 * (com a coluna de projeto) e na aba do projeto (sem ela).
 */

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { LinkButton } from "../ui/button";
import { TABELA } from "../ui/table-estilos";
import { SeverityStrip } from "./severity-strip";
import { CODE_FORMAT_LABELS, type CodeScanImport } from "../../types/code-import.types";

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function CodeImportsTable({ imports, mostrarProjeto = true }: { imports: CodeScanImport[]; mostrarProjeto?: boolean }) {
  return (
    <div data-ops-surface className="overflow-x-auto rounded-container border border-subtle">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Importações de relatórios SAST/SCA</caption>
        <thead className={TABELA.cabecalho}>
          <tr>
            {mostrarProjeto && (
              <th scope="col" className={TABELA.th}>
                Projeto
              </th>
            )}
            <th scope="col" className={TABELA.th}>
              Ferramenta
            </th>
            <th scope="col" className={`${TABELA.th} min-w-campo`}>
              Achados
            </th>
            <th scope="col" className={TABELA.th}>
              Desde a anterior
            </th>
            <th scope="col" className={TABELA.th}>
              Importado
            </th>
            <th scope="col" className={TABELA.th}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {imports.map((imp) => (
            <tr key={imp.id} className={TABELA.linha}>
              {mostrarProjeto && (
                <td className={TABELA.celula}>
                  <span className="block text-fg">{imp.projectName}</span>
                  <span className="block text-xs text-fg-muted">{imp.applicationName}</span>
                </td>
              )}
              <td className={TABELA.celula}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg">{imp.toolName}</span>
                  <Badge tom={imp.format === "SARIF" ? "acento" : "neutro"}>{CODE_FORMAT_LABELS[imp.format]}</Badge>
                </div>
                <span className="block max-w-xs truncate font-mono text-xs text-fg-muted" title={imp.fileName}>
                  {imp.fileName}
                </span>
              </td>
              <td className={TABELA.celula}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-fg" data-numeric>
                    {imp.totalFindings}
                  </span>
                  <SeverityStrip counts={imp.severityCounts} className="w-full max-w-xs" />
                </div>
              </td>
              <td className={TABELA.celula}>
                {imp.previousImportId ? (
                  <div className="flex items-center gap-3 font-mono text-xs" data-numeric>
                    <span className="inline-flex items-center gap-1 text-severity-high-ink" title="Achados novos">
                      <ArrowUpRight size={14} aria-hidden="true" />
                      {imp.newFindings}
                      <span className="sr-only">novos</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-success-ink" title="Achados resolvidos">
                      <ArrowDownRight size={14} aria-hidden="true" />
                      {imp.resolvedFindings}
                      <span className="sr-only">resolvidos</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-fg-muted">primeira</span>
                )}
              </td>
              <td className={TABELA.celula}>
                <span className="block text-fg-muted">{dataCurta(imp.createdAt)}</span>
                <span className="block text-xs text-fg-muted">{imp.uploadedByName}</span>
              </td>
              <td className={TABELA.celula}>
                <LinkButton variant="secundario" size="sm" to={`/sast-sca/imports/${imp.id}`}>
                  Ver
                </LinkButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
