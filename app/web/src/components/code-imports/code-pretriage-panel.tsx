/**
 * code-pretriage-panel.tsx
 *
 * O QUE FAZ
 * O resumo da pré-triagem no topo da lista de achados de uma importação
 * SAST/SCA: quantos achados parecem vulnerabilidade de verdade (KEV, EPSS
 * alto, confirmado pelo DAST) e quantos estão fora do código de produção
 * (testes, fixtures, documentação, artefatos gerados, scripts) — com um botão
 * que aceita, de uma vez, a sugestão de falso-positivo destes.
 *
 * POR QUE EXISTE
 * Num relatório real (2026-11-17), 74% dos achados estavam em relatórios HTML,
 * testes e fixtures. Triar um a um escondia os 15% que importavam. A decisão
 * continua humana (ADR-032/052): o botão só aplica o que foi sugerido, com
 * quem clicou como autor, e a API registra o lote na auditoria.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Sparkles } from "lucide-react";
import { codeImportsApi } from "../../lib/api/code-imports.api";
import { useApiError } from "../../hooks/use-api-error";
import { resumoPreTriagem, type FiltrosAchados } from "../../lib/code-import";
import { CODE_CONTEXT_LABELS, type CodeContext, type CodeFinding } from "../../types/code-import.types";
import { Button } from "../ui/button";

export function PainelPreTriagem({
  importId,
  findings,
  recorte,
  aoFiltrar,
}: {
  importId: string;
  findings: CodeFinding[];
  recorte: FiltrosAchados["preTriagem"];
  aoFiltrar(r: FiltrosAchados["preTriagem"]): void;
}) {
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const { provaveis, foraDeProducao, porContexto } = resumoPreTriagem(findings);

  const aceitar = useMutation({
    mutationFn: () => codeImportsApi.acceptSuggestions(importId),
    onSuccess: async (r) => {
      setMensagem({ tom: "ok", texto: `${r.accepted} ${r.accepted === 1 ? "achado marcado" : "achados marcados"} como falso-positivo.` });
      if (recorte === "FORA_PRODUCAO") aoFiltrar("");
      await queryClient.invalidateQueries({ queryKey: ["code-imports", importId] });
    },
    onError: (err: unknown) => setMensagem({ tom: "erro", texto: getErrorMessage(err) }),
  });

  if (provaveis === 0 && foraDeProducao === 0 && !mensagem) return null;

  const detalheContextos = (Object.entries(porContexto) as [CodeContext, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${n} ${CODE_CONTEXT_LABELS[c]}`)
    .join(" · ");

  return (
    <section aria-label="Pré-triagem" className="grid gap-3 sm:grid-cols-2">
      {provaveis > 0 && (
        <div className="flex flex-col gap-2 rounded-container border border-subtle bg-danger-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            <ShieldAlert className="h-4 w-4 text-severity-high-ink" aria-hidden="true" />
            {provaveis} {provaveis === 1 ? "provável vulnerabilidade" : "prováveis vulnerabilidades"}
          </p>
          <p className="text-xs text-fg-muted">
            Outra fonte confirma o risco: CVE explorada ativamente (KEV), EPSS alto ou o mesmo tipo de falha já confirmado pelo DAST nesta
            aplicação. O rascunho de promoção já vem com os sinais.
          </p>
          <div>
            <Button size="sm" variant={recorte === "PROVAVEL" ? "primario" : "secundario"} aria-pressed={recorte === "PROVAVEL"} onClick={() => aoFiltrar(recorte === "PROVAVEL" ? "" : "PROVAVEL")}>
              {recorte === "PROVAVEL" ? "Mostrar todos" : "Ver só esses"}
            </Button>
          </div>
        </div>
      )}

      {foraDeProducao > 0 && (
        <div className="flex flex-col gap-2 rounded-container border border-subtle bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            <Sparkles className="h-4 w-4 text-accent-ink" aria-hidden="true" />
            {foraDeProducao} {foraDeProducao === 1 ? "achado fora" : "achados fora"} do código de produção
          </p>
          <p className="text-xs text-fg-muted">
            {detalheContextos}. Sugestão: falso-positivo. Revise se quiser e aceite de uma vez — você fica como autor da triagem.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => aceitar.mutate()} carregando={aceitar.isPending} disabled={aceitar.isPending}>
              Aceitar sugestões ({foraDeProducao})
            </Button>
            <Button size="sm" variant="fantasma" aria-pressed={recorte === "FORA_PRODUCAO"} onClick={() => aoFiltrar(recorte === "FORA_PRODUCAO" ? "" : "FORA_PRODUCAO")}>
              {recorte === "FORA_PRODUCAO" ? "Mostrar todos" : "Revisar antes"}
            </Button>
          </div>
        </div>
      )}

      {mensagem && (
        <p role="status" className={mensagem.tom === "ok" ? "text-sm text-success-ink sm:col-span-2" : "text-sm text-danger-ink sm:col-span-2"}>
          {mensagem.texto}
        </p>
      )}
    </section>
  );
}
