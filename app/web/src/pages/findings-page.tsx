/**
 * findings-page.tsx
 *
 * O QUE FAZ
 * A página global de findings: todos os achados que o ator pode ver, de todos
 * os projetos, num lugar só — com filtros, busca e URL compartilhável.
 *
 * QUEM ENTRA
 * PENTESTER e ADMIN. O CLIENT não vê o item no menu e é barrado na rota
 * (`ProtectedRoute roles`), pelo mesmo caminho que `/admin/subscriptions` já
 * usa. ⚠️ Isso NÃO é o isolamento — o isolamento é do backend, e lá o CLIENT
 * continua podendo listar os findings da PRÓPRIA empresa (RN16), que é o que
 * o dashboard dele e o app mobile consomem. A guarda aqui é de produto: uma
 * varredura entre empresas é ferramenta de quem analisa, não de quem contrata.
 *
 * ESTADO NA URL
 * `syncToUrl` — colar a URL em outra aba reproduz a mesma lista, e voltar do
 * navegador desfaz o último filtro. Ver `use-findings-filters.ts`.
 *
 * QUEM USA
 * Rota `/findings` (App.tsx).
 */

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useSearchParams } from "react-router-dom";
import { FindingsTable } from "../components/findings/findings-table";
import { SavedQueriesBar } from "../components/findings/saved-queries-bar";
import { useFindings } from "../hooks/use-findings";
import { SeverityBadge } from "../components/ui/badge";
import { SEVERIDADES } from "../lib/finding-query";
import { Button } from "../components/ui/button";
import { DashboardAtmosphere } from "../components/dashboard/hero/dashboard-atmosphere";
import { NumeroAnimado } from "../motion/components";
import { useMotion } from "../motion/use-motion";
import "../components/dashboard/hero/dashboard-hero.css";
import "./findings-page.css";

export function FindingsPage() {
  const [params] = useSearchParams();
  const [pausado, setPausado] = useState(false);
  const { item, lista, reduzido } = useMotion();

  // O cabeçalho lê o MESMO recorte que a tabela — é a mesma queryKey do
  // TanStack Query, então não custa uma segunda requisição: o total e as
  // facetas já estão em cache quando a tabela termina de buscar.
  const paramsDoResumo = useMemo(() => {
    const copia = new URLSearchParams(params);
    copia.set("page", String(Math.max(1, Number(params.get("page")) || 1)));
    copia.set("pageSize", params.get("pageSize") ?? "25");
    copia.set("sortBy", params.get("sortBy") ?? "createdAt");
    copia.set("sortOrder", params.get("sortOrder") ?? "desc");
    return copia;
  }, [params]);

  const { dados, erro } = useFindings(paramsDoResumo);
  const total = dados?.pagination.total ?? 0;
  // Sem resposta ainda (ou falhou) o cabeçalho não afirma nada: dizer "nenhum
  // finding" quando o dado não chegou é a mesma mentira que a tabela dava.
  const sabeOTotal = dados !== undefined;

  /**
   * As severidades a mostrar no resumo.
   *
   * ⚠️ A faceta de severidade IGNORA o próprio filtro de severidade — é o que
   * permite marcar uma segunda severidade depois da primeira (ver
   * `use-findings-filters.ts`). Isso está certo nos controles de filtro e
   * ERRADO aqui: com `severidade = HIGH, CRITICAL` o cabeçalho mostraria
   * "MÉDIA 4" ao lado de "9 findings no recorte atual", e 4+5+4 não dá 9.
   *
   * Quando há filtro de severidade, o resumo mostra só as severidades
   * filtradas — e aí as contagens fecham com o total, porque a contagem de uma
   * severidade SELECIONADA já é a contagem dela dentro dos demais filtros.
   */
  const severidadesDoResumo = useMemo(() => {
    const filtradas = (params.get("severity") ?? "").split(",").filter(Boolean);
    return filtradas.length > 0 ? SEVERIDADES.filter((s) => filtradas.includes(s)) : SEVERIDADES;
  }, [params]);

  const porSeveridade = dados?.facets.severity;

  return (
    <div className="findings-workspace relative isolate" data-motion={pausado || reduzido ? "paused" : "running"}>
      <div aria-hidden="true" className="findings-page-glow pointer-events-none absolute inset-0" />
      <div className="findings-overview relative isolate">
        <DashboardAtmosphere pausado={pausado} />
        <motion.header className="findings-hero relative overflow-hidden rounded-container border border-subtle" variants={item} initial="inicial" animate="visivel">
          <div aria-hidden="true" className="findings-hero-orbits"><span /><span /><span /></div>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">Análise de exposição</p>
            {!reduzido && (
              <Button variant="sutil" size="sm" aria-pressed={pausado} onClick={() => setPausado((atual) => !atual)}>
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
                  {pausado ? <path d="M5 3v10l8-5Z" /> : <path d="M4 3h3v10H4zm5 0h3v10H9z" />}
                </svg>
                {pausado ? "Retomar animações" : "Pausar animações"}
              </Button>
            )}
          </div>
          <div className="relative mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Findings</h1>
              <p className="mt-3 text-sm leading-6 text-fg-secondary">Encontre os achados que precisam de atenção e acompanhe o risco entre projetos.</p>
            </div>
            <div className="findings-total shrink-0">
              <p className="font-mono text-4xl font-medium tracking-tight text-fg" data-numeric>
                {sabeOTotal && !erro ? total.toLocaleString("pt-BR") : "—"}
              </p>
              <p className="mt-2 text-xs text-fg-muted">
                {erro
                  ? "A busca não chegou ao servidor"
                  : !sabeOTotal
                    ? "Carregando findings…"
                    : total === 0
                      ? "Nenhum finding no recorte atual"
                      : `finding${total === 1 ? "" : "s"} no recorte atual`}
              </p>
            </div>
          </div>
        </motion.header>

        {/* Cada card continua sendo um par rótulo/valor no mesmo dl. A órbita
            é decorativa; só a resposta da busca alimenta as contagens. */}
        {porSeveridade && !erro && total > 0 && (
          <motion.dl aria-label="Findings por severidade no recorte atual" className="findings-severity-grid mt-4 grid gap-3" variants={lista} initial="inicial" animate="visivel">
            {severidadesDoResumo
              .filter((s) => (porSeveridade[s] ?? 0) > 0)
              .map((s) => (
                <motion.div key={s} variants={item} data-ambient-card className="findings-severity-card relative overflow-hidden rounded-container border border-subtle p-4">
                  <div aria-hidden="true" className="findings-card-orbit" />
                  <dt className="relative">
                    <SeverityBadge severidade={s} />
                  </dt>
                  <dd className="relative mt-4 font-mono text-2xl font-semibold text-fg">
                    {pausado ? <span data-numeric>{porSeveridade[s]}</span> : <NumeroAnimado valor={porSeveridade[s]} />}
                  </dd>
                </motion.div>
              ))}
          </motion.dl>
        )}
      </div>

      {/* Buscas salvas (CP-6): atalhos para o recorte atual. Ficam ACIMA
          da tabela porque são um ponto de partida, não um resultado. */}
      <section aria-labelledby="findings-saved-heading" className="findings-saved-panel relative mt-5 rounded-container border border-subtle p-4">
        <h2 id="findings-saved-heading" className="text-sm font-semibold text-fg">Buscas salvas</h2>
        <p className="mb-3 mt-1 text-xs text-fg-muted">Seus atalhos para retomar análises com os mesmos filtros.</p>
        <SavedQueriesBar />
      </section>

      <div className="findings-console relative mt-5">
        <FindingsTable syncToUrl exportavel />
      </div>
    </div>
  );
}
