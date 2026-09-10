/**
 * dast-status-banner.tsx
 *
 * O QUE FAZ
 * Mostra, no topo da tela de DAST, o estado do MÓDULO (não de um scan): se o
 * Docker está acessível, quantos scans estão rodando contra o limite de vagas,
 * quantos esperam na fila e os avisos recentes do watchdog.
 *
 * POR QUE EXISTE
 * Até 2026-09-09 um scan simulado e um scan real eram indistinguíveis na
 * aplicação inteira (docs/DAST-DOCKER-GAP.md §5): quem usava o produto não
 * tinha como saber que o OWASP ZAP nem chegou a rodar. Este banner é a metade
 * preventiva dessa correção — avisa ANTES de o usuário clicar em "Novo scan".
 * A metade retroativa é o selo "simulado" no scan já concluído.
 *
 * QUEM CONSOME
 * `dast-page.tsx` (banner completo) e `dast-scan-detail-page.tsx` (só a
 * posição na fila, via `useDastStatus`).
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { dastApi } from "../../lib/api/dast.api";
import { Alert } from "../ui/alert";
import type { DastModuleStatus } from "../../types/dast.types";

/**
 * Polling de 5s enquanto houver scan vivo, 30s em repouso. As duas telas do
 * módulo chamam este hook com a MESMA queryKey — o react-query desduplica, e
 * não vira uma requisição por tela.
 */
export function useDastStatus(): UseQueryResult<DastModuleStatus> {
  return useQuery({
    queryKey: ["dast", "status"],
    queryFn: dastApi.getStatus,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 30000;
      return data.runningCount > 0 || data.queuedCount > 0 ? 5000 : 30000;
    },
  });
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DastStatusBanner({ status }: { status: DastModuleStatus | undefined }) {
  if (!status) return null;

  const { dockerAvailable, runningCount, queuedCount, maxConcurrent, alerts } = status;
  const vagasLivres = Math.max(0, maxConcurrent - runningCount);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {!dockerAvailable && (
        <Alert tom="atencao" titulo="Modo de demonstração — o OWASP ZAP não vai ser executado">
          O Docker não está acessível para a API neste momento, então qualquer scan novo devolve um conjunto de
          achados de demonstração em vez de analisar o alvo de verdade. Os resultados continuam navegáveis (útil
          para conhecer a tela), mas <strong>não descrevem o alvo informado</strong>.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-container border border-subtle bg-surface px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${dockerAvailable ? "bg-success" : "bg-warning"}`}
          />
          <span className="text-fg-muted">Motor:</span>
          <span className="font-medium text-fg">{dockerAvailable ? "OWASP ZAP via Docker" : "simulado"}</span>
        </span>

        <span className="text-fg-muted">
          Em execução:{" "}
          <span className="font-mono font-medium text-fg" data-numeric>
            {runningCount}/{maxConcurrent}
          </span>{" "}
          {vagasLivres > 0 ? `(${vagasLivres} vaga${vagasLivres > 1 ? "s" : ""} livre${vagasLivres > 1 ? "s" : ""})` : "(sem vaga livre)"}
        </span>

        <span className="text-fg-muted">
          Na fila:{" "}
          <span className="font-mono font-medium text-fg" data-numeric>
            {queuedCount}
          </span>
        </span>
      </div>

      {alerts.length > 0 && (
        <Alert tom={alerts.some((a) => a.level === "error") ? "perigo" : "atencao"} titulo="Avisos recentes do watchdog">
          <ul className="flex flex-col gap-1">
            {alerts.slice(0, 4).map((alerta) => (
              <li key={`${alerta.at}-${alerta.scanId ?? "geral"}`} className="text-sm">
                <span className="font-mono text-xs text-fg-muted" data-numeric>
                  {formatarHora(alerta.at)}
                </span>{" "}
                {alerta.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
