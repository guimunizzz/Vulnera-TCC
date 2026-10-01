/**
 * audit-trail.tsx
 *
 * O QUE FAZ
 * A trilha de auditoria de um finding: criação, mudanças de status,
 * sobrescritas de severidade — com autor e data.
 *
 * POR QUE EXISTE
 * O `AuditLog` era gravado desde a Fase 5 e nunca lido por ninguém: a única
 * forma de auditar um finding era abrir o banco. Um sistema de gestão de
 * segurança que registra a história e não a mostra tem uma trilha que só
 * serve para quem tem acesso ao MySQL — o que é o oposto do ponto.
 *
 * ACESSIBILIDADE
 * `<ol>` de verdade: a ordem é o conteúdo. O leitor de tela anuncia "item 2 de
 * 5", que é exatamente a informação que a linha vertical dá para quem vê.
 */

import { useQuery } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { Skeleton } from "../ui/card";
import { cn } from "../../lib/cn";
import type { AuditLogEntry } from "../../types/audit-log.types";

/** Como cada ação se apresenta. Ação desconhecida cai no neutro, nunca some. */
const ACOES: Record<string, { texto: string; tom: string }> = {
  CREATE: { texto: "Finding registrado", tom: "bg-accent" },
  UPDATE: { texto: "Finding editado", tom: "bg-severity-info" },
  STATUS_CHANGE: { texto: "Status alterado", tom: "bg-warning" },
  SEVERITY_CHANGE: { texto: "Severidade recalculada pelo CVSS", tom: "bg-warning" },
  SEVERITY_OVERRIDE: { texto: "Severidade sobrescrita manualmente", tom: "bg-severity-critical" },
  SEVERITY_OVERRIDE_RESET: { texto: "Sobrescrita descartada", tom: "bg-severity-info" },
  DELETE: { texto: "Finding removido", tom: "bg-severity-critical" },
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function AuditTrail({ vulnerabilityId }: { vulnerabilityId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vulnerabilities", vulnerabilityId, "audit-log"],
    queryFn: () => vulnerabilitiesApi.auditLog(vulnerabilityId),
    enabled: Boolean(vulnerabilityId),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-fg-muted">Não foi possível carregar a trilha de auditoria.</p>;
  }

  if (!data || data.length === 0) {
    // Acontece de verdade: findings criados por seed ou migração não passaram
    // pelo service, então não geraram evento. Dizer isso é melhor que uma
    // caixa vazia que parece defeito.
    return <p className="text-sm text-fg-muted">Nenhum evento registrado para este finding.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {data.map((evento) => (
        <li key={evento.id} className="flex gap-3">
          <span
            aria-hidden="true"
            className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", ACOES[evento.action]?.tom ?? "bg-severity-info")}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">{ACOES[evento.action]?.texto ?? evento.action}</p>
            <p className="text-xs text-fg-muted">
              {evento.actorName} · <time dateTime={evento.createdAt}>{dataHora(evento.createdAt)}</time>
            </p>
            <DetalheDoEvento evento={evento} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * O `diffJson` de cada ação tem forma própria. Em vez de imprimir o JSON cru,
 * cada forma conhecida vira uma frase; o que não for reconhecido não aparece —
 * um blob de JSON na tela não informa ninguém e ainda vaza estrutura interna.
 */
function DetalheDoEvento({ evento }: { evento: AuditLogEntry }) {
  const diff = evento.diff as Record<string, unknown> | null;
  if (!diff || typeof diff !== "object") return null;

  const texto = (chave: string) => (typeof diff[chave] === "string" ? (diff[chave] as string) : undefined);

  if (evento.action === "STATUS_CHANGE" && texto("from") && texto("to")) {
    return (
      <p className="mt-1 text-xs text-fg-secondary">
        {texto("from")} → <strong className="font-medium">{texto("to")}</strong>
      </p>
    );
  }

  if (evento.action === "SEVERITY_OVERRIDE") {
    return (
      <div className="mt-1 text-xs text-fg-secondary">
        <p>
          {texto("from")} → <strong className="font-medium">{texto("to")}</strong>
        </p>
        {texto("reason") && <p className="mt-1 italic">“{texto("reason")}”</p>}
      </div>
    );
  }

  if (evento.action === "SEVERITY_CHANGE") {
    return (
      <p className="mt-1 text-xs text-fg-secondary">
        {texto("from")} → <strong className="font-medium">{texto("to")}</strong>
        {diff.fromScore != null && diff.toScore != null && (
          <span data-numeric>
            {" "}
            (CVSS {String(diff.fromScore)} → {String(diff.toScore)})
          </span>
        )}
      </p>
    );
  }

  if (evento.action === "SEVERITY_OVERRIDE_RESET" && texto("discardedJustification")) {
    return (
      <p className="mt-1 text-xs text-fg-secondary">
        A justificativa “{texto("discardedJustification")}” deixou de valer — o vetor CVSS mudou.
      </p>
    );
  }

  if (evento.action === "CREATE" && texto("severity")) {
    return <p className="mt-1 text-xs text-fg-secondary">Severidade inicial: {texto("severity")}</p>;
  }

  return null;
}
