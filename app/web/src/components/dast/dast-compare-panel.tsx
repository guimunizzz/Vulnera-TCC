/**
 * dast-compare-panel.tsx
 *
 * O QUE FAZ
 * Compara este scan com uma execução ANTERIOR contra o mesmo alvo e mostra o
 * resultado em três grupos: o que foi resolvido, o que apareceu agora e o que
 * continua aberto.
 *
 * POR QUE EXISTE
 * É a resposta à pergunta que fecha o ciclo de um pentest: "a correção
 * funcionou?". Sem isso, provar remediação significava abrir dois relatórios
 * lado a lado e comparar títulos no olho — trabalhoso e sujeito a erro, e é
 * exatamente o que a banca vai querer ver demonstrado.
 *
 * COMO O DIFF SABE QUE DOIS ACHADOS SÃO "O MESMO"
 * Pelo `fingerprint` que o backend já calculava desde a Fase 1:
 * `sha256(pluginId | normalizedUrl | param)`. Ele NÃO inclui a evidência —
 * que muda entre execuções da mesma vulnerabilidade. É por isso que um
 * problema não corrigido aparece como "continua aberto" em vez de virar um
 * par falso de "sumiu um / surgiu outro".
 *
 * QUEM CONSOME
 * `dast-scan-detail-page.tsx`, só quando o scan está COMPLETED.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dastApi } from "../../lib/api/dast.api";
import { Alert } from "../ui/alert";
import { SeverityBadge } from "../ui/badge";
import { EmptyState } from "../ui/empty-state";
import { Skeleton } from "../ui/card";
import type { ScanComparisonEntry } from "../../types/dast.types";

const CLASSE_SELECT = "h-touch rounded-control border border-default bg-surface px-3 text-sm text-fg";

function formatarData(iso: string | null): string {
  if (!iso) return "sem data";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function GrupoDeDiff({
  titulo,
  descricao,
  entradas,
  tom,
}: {
  titulo: string;
  descricao: string;
  entradas: ScanComparisonEntry[];
  tom: "sucesso" | "perigo" | "neutro";
}) {
  const corDaBorda = { sucesso: "border-success", perigo: "border-danger", neutro: "border-subtle" }[tom];
  const corDoNumero = { sucesso: "text-success-ink", perigo: "text-danger-ink", neutro: "text-fg" }[tom];

  return (
    <section className={`rounded-container border-l-4 ${corDaBorda} border-y border-r border-subtle bg-surface p-4`}>
      <header className="flex items-baseline gap-2">
        <span className={`font-mono text-2xl font-bold ${corDoNumero}`} data-numeric>
          {entradas.length}
        </span>
        <h3 className="text-sm font-semibold text-fg">{titulo}</h3>
      </header>
      <p className="mt-1 text-xs text-fg-muted">{descricao}</p>

      {entradas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {entradas.slice(0, 10).map((entrada) => (
            <li key={entrada.fingerprint} className="flex flex-wrap items-center gap-2 text-sm">
              <SeverityBadge severidade={entrada.risk} />
              <span className="text-fg">{entrada.title}</span>
              <span className="max-w-xs truncate font-mono text-xs text-fg-muted" title={entrada.url}>
                {entrada.url}
              </span>
            </li>
          ))}
          {entradas.length > 10 && (
            <li className="text-xs text-fg-muted">e mais {entradas.length - 10}…</li>
          )}
        </ul>
      )}
    </section>
  );
}

export function DastComparePanel({ scanId }: { scanId: string }) {
  const [baseId, setBaseId] = useState("");

  const comparaveisQuery = useQuery({
    queryKey: ["dast", "scans", scanId, "comparable"],
    queryFn: () => dastApi.listComparableScans(scanId),
  });

  const comparacaoQuery = useQuery({
    queryKey: ["dast", "scans", scanId, "compare", baseId],
    queryFn: () => dastApi.compare(scanId, baseId),
    enabled: !!baseId,
  });

  const comparaveis = comparaveisQuery.data ?? [];

  if (comparaveisQuery.isLoading) {
    return <Skeleton className="mt-4 h-16 w-full bg-inset" />;
  }

  // Sem execução anterior do mesmo alvo não há o que comparar — e dizer isso
  // é mais útil que mostrar um seletor vazio.
  if (comparaveis.length === 0) {
    return (
      <EmptyState
        className="mt-4"
        titulo="Ainda não há com o que comparar"
        descricao="Rode um novo scan contra este mesmo alvo depois de corrigir algo — aqui aparecerá o que foi resolvido, o que surgiu e o que continua aberto."
      />
    );
  }

  const comparacao = comparacaoQuery.data;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase text-fg-muted">Comparar com a execução de</span>
          <select className={CLASSE_SELECT} value={baseId} onChange={(e) => setBaseId(e.target.value)}>
            <option value="">Selecione uma execução anterior...</option>
            {comparaveis.map((s) => (
              <option key={s.id} value={s.id}>
                {formatarData(s.finishedAt)} — {s.total} achado{s.total === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        {baseId && comparacaoQuery.isFetching && <span className="text-sm text-fg-muted">Comparando...</span>}
      </div>

      {comparacaoQuery.isError && (
        <Alert tom="perigo">Não foi possível comparar as duas execuções. Tente de novo.</Alert>
      )}

      {comparacao && (
        <>
          <p className="text-sm text-fg-muted">
            Comparando a execução de <strong>{formatarData(comparacao.baseScan.finishedAt)}</strong> (
            {comparacao.baseScan.total} achados) com esta, de{" "}
            <strong>{formatarData(comparacao.headScan.finishedAt)}</strong> ({comparacao.headScan.total} achados).
          </p>

          <div className="grid gap-4 lg:grid-cols-3">
            <GrupoDeDiff
              titulo="Resolvidos"
              descricao="Estavam na execução anterior e não aparecem mais."
              entradas={comparacao.resolved}
              tom="sucesso"
            />
            <GrupoDeDiff
              titulo="Novos"
              descricao="Não existiam antes — regressão ou área que o scan anterior não alcançou."
              entradas={comparacao.introduced}
              tom="perigo"
            />
            <GrupoDeDiff
              titulo="Continuam abertos"
              descricao="Presentes nas duas execuções."
              entradas={comparacao.persisted}
              tom="neutro"
            />
          </div>
        </>
      )}
    </div>
  );
}
