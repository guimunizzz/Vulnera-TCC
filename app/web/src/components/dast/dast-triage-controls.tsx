/**
 * dast-triage-controls.tsx
 *
 * O QUE FAZ
 * Os controles de triagem de UM finding, dentro da linha expandida da tabela:
 * quatro botões de status (por triar / confirmado / falso-positivo / risco
 * aceito) e um campo de nota que só aparece quando há o que anotar.
 *
 * POR QUE EXISTE
 * Um scan real devolve dezenas de alertas e o ZAP não sabe quais importam.
 * Sem um lugar pra registrar "já olhei este, é falso-positivo", o pentester
 * revisa 40 achados hoje e recomeça do zero amanhã — e não tem como mostrar
 * ao colega (ou à banca) o que já foi analisado. Ver ADR-032.
 *
 * DECISÃO DE UX: salva no clique, sem botão "salvar"
 * Triagem é uma ação de um toque, repetida dezenas de vezes seguidas.
 * Obrigar a clicar o status e depois "salvar" dobraria os cliques da tarefa
 * mais repetitiva da tela. A nota é a exceção: texto livre precisa de um
 * commit explícito (salva no blur ou no botão), senão salvaria a cada tecla.
 *
 * QUEM CONSOME
 * `dast-scan-detail-page.tsx`, na linha expandida de cada finding.
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dastApi } from "../../lib/api/dast.api";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Field } from "../ui/field";
import { DAST_TRIAGE_LABELS, type DastFinding, type DastTriageStatus } from "../../types/dast.types";

const ORDEM_STATUS: DastTriageStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "ACCEPTED_RISK"];

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function DastTriageControls({ finding, aoErro }: { finding: DastFinding; aoErro: (mensagem: string | null) => void }) {
  const queryClient = useQueryClient();
  const [nota, setNota] = useState(finding.triageNote ?? "");

  // O polling da tela pode trazer uma versão nova do finding (outra aba, o
  // ADMIN triando junto). Sincroniza o rascunho local quando isso acontece —
  // mas só quando o valor do SERVIDOR muda, pra não apagar o que a pessoa
  // está digitando agora.
  useEffect(() => {
    setNota(finding.triageNote ?? "");
  }, [finding.triageNote]);

  const mutation = useMutation({
    mutationFn: (input: { status: DastTriageStatus; note: string | null }) =>
      dastApi.triage(finding.id, input.status, input.note),
    onSuccess: () => {
      aoErro(null);
      queryClient.invalidateQueries({ queryKey: ["dast", "scans", finding.scanId, "findings"] });
    },
    onError: () => aoErro("Não foi possível salvar a triagem. Tente de novo."),
  });

  const notaMudou = (finding.triageNote ?? "") !== nota.trim();

  return (
    <div className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-fg-muted">Triagem</span>
        {ORDEM_STATUS.map((status) => {
          const ativo = finding.triageStatus === status;
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={ativo ? "primario" : "secundario"}
              aria-pressed={ativo}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ status, note: nota.trim() || null })}
            >
              {DAST_TRIAGE_LABELS[status]}
            </Button>
          );
        })}
      </div>

      {finding.triagedByName && finding.triagedAt && (
        <p className="text-xs text-fg-muted">
          Triado por {finding.triagedByName} em {formatarData(finding.triagedAt)}
        </p>
      )}

      <Field rotulo="Nota da triagem" dica="Por que este achado é falso-positivo, ou o que precisa ser verificado.">
        {(attrs) => (
          <Textarea
            {...attrs}
            rows={2}
            value={nota}
            maxLength={2000}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Opcional — fica registrado junto com o status."
          />
        )}
      </Field>

      {notaMudou && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ status: finding.triageStatus, note: nota.trim() || null })}
          >
            {mutation.isPending ? "Salvando..." : "Salvar nota"}
          </Button>
          <Button type="button" size="sm" variant="fantasma" onClick={() => setNota(finding.triageNote ?? "")}>
            Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
