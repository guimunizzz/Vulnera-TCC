/**
 * code-reopen-suggestion.tsx
 *
 * CODE-FUT-03: lista as vulnerabilidades marcadas FIXED cujo achado ainda
 * aparece no relatório importado DEPOIS da correção, e oferece reabri-las.
 * Quem decide quais entram é a API (`reopenCandidates` do compare); aqui só se
 * mostra e se pede confirmação. Reabrir é a transição de retorno
 * FIXED → IN_PROGRESS do ADR-033 ("validação reprovada") — nunca automática.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { useApiError } from "../../hooks/use-api-error";
import { Alert } from "../ui/alert";
import { SeverityBadge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogTitle } from "../ui/dialog";
import type { CodeComparisonEntry } from "../../types/code-import.types";

export function CodeReopenSuggestion({ itens }: { itens: CodeComparisonEntry[] }) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [alvo, setAlvo] = useState<CodeComparisonEntry | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const reabrir = useMutation({
    mutationFn: (vulnerabilityId: string) => vulnerabilitiesApi.transition(vulnerabilityId, "IN_PROGRESS"),
    onSuccess: () => {
      setAlvo(null);
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ["code-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  if (itens.length === 0) return null;
  const uma = itens.length === 1;

  return (
    <>
      <Alert tom="atencao" className="mt-4" titulo="Correção não confirmada">
        <p>
          {uma ? "Uma vulnerabilidade marcada como corrigida ainda aparece" : `${itens.length} vulnerabilidades marcadas como corrigidas ainda aparecem`}{" "}
          neste relatório, importado depois da correção. Reabra para voltar ao trabalho, ou confira se o achado mudou de lugar.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {itens.map((e) => (
            <li key={e.fingerprint} className="flex flex-wrap items-center gap-2">
              <SeverityBadge severidade={e.severity === "INFO" ? "NONE" : e.severity} />
              <span className="min-w-0 text-sm text-fg">{e.title}</span>
              {e.location && <span className="break-all font-mono text-xs text-fg-muted">{e.location}</span>}
              <Link className="text-xs text-accent-ink hover:underline" to={`/findings/${e.promotedVulnerability!.id}`}>
                abrir vulnerabilidade
              </Link>
              <Button variant="secundario" className="ml-auto" onClick={() => setAlvo(e)}>
                <RotateCcw size={14} aria-hidden="true" /> Reabrir
              </Button>
            </li>
          ))}
        </ul>
      </Alert>

      <Dialog aberto={alvo !== null} aoFechar={() => (reabrir.isPending ? undefined : setAlvo(null))}>
        <>
          <DialogTitle>Reabrir vulnerabilidade?</DialogTitle>
          <DialogDescription>
            "{alvo?.title}" volta de Corrigida para Em andamento, como uma validação reprovada. O prazo de SLA recomeça e a
            mudança fica na trilha de auditoria.
          </DialogDescription>
          {erro && (
            <Alert tom="perigo" className="mt-4">
              {erro}
            </Alert>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secundario" onClick={() => setAlvo(null)} disabled={reabrir.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => alvo && reabrir.mutate(alvo.promotedVulnerability!.id)} disabled={reabrir.isPending} carregando={reabrir.isPending}>
              {reabrir.isPending ? "Reabrindo..." : "Reabrir"}
            </Button>
          </div>
        </>
      </Dialog>
    </>
  );
}
