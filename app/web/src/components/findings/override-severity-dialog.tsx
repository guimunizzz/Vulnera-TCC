/**
 * override-severity-dialog.tsx
 *
 * Modal de override manual de severidade (RN10/RN21) — justificativa com
 * contador de caracteres, botão desabilitado abaixo de 20 (mesmo limite
 * validado no backend).
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { useApiError } from "../../hooks/use-api-error";
import { cn } from "../../lib/cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Alert } from "../ui/alert";
import type { VulnerabilitySeverity } from "../../types/vulnerability.types";

const SEVERITIES: VulnerabilitySeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const MIN_JUSTIFICATION_LENGTH = 20;
// Espelha FIELD_LIMITS.justificationMax do backend. A justificativa vai
// inteira pro diffJson do AuditLog e pra trilha impressa no PDF Técnico.
const MAX_JUSTIFICATION_LENGTH = 1000;

export function OverrideSeverityDialog({
  vulnerabilityId,
  currentSeverity,
  open,
  onOpenChange,
}: {
  vulnerabilityId: string;
  currentSeverity: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [newSeverity, setNewSeverity] = useState<VulnerabilitySeverity>(
    SEVERITIES.includes(currentSeverity as VulnerabilitySeverity) ? (currentSeverity as VulnerabilitySeverity) : "LOW",
  );
  const [justification, setJustification] = useState("");
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => vulnerabilitiesApi.overrideSeverity(vulnerabilityId, newSeverity, justification),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vulnerabilities", vulnerabilityId] });
      setJustification("");
      onOpenChange(false);
    },
  });

  const trimmedLength = justification.trim().length;
  const isTooShort = trimmedLength < MIN_JUSTIFICATION_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Override de severidade</DialogTitle>
        <DialogDescription>
          A severidade calculada pelo CVSS continua registrada — isso muda só a severidade final exibida, com
          justificativa auditada (AuditLog SEVERITY_OVERRIDE).
        </DialogDescription>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {mutation.isError && <Alert>{getErrorMessage(mutation.error)}</Alert>}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-foreground" htmlFor="override-severity">
              Nova severidade
            </label>
            <select
              id="override-severity"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value as VulnerabilitySeverity)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-foreground" htmlFor="override-justification">
              Justificativa
            </label>
            <Textarea
              id="override-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              maxLength={MAX_JUSTIFICATION_LENGTH}
              placeholder="Explique por que a severidade final diverge da calculada pelo CVSS (mínimo 20 caracteres)..."
            />
            <span className={cn("text-xs", isTooShort ? "text-severity-critical" : "text-severity-low")}>
              {isTooShort
                ? `${trimmedLength}/${MIN_JUSTIFICATION_LENGTH} caracteres mínimos`
                : `${trimmedLength} caracteres (máximo ${MAX_JUSTIFICATION_LENGTH})`}
            </span>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isTooShort || mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Confirmar override"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
