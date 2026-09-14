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

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FindingsTable } from "../components/findings/findings-table";
import { useFindings } from "../hooks/use-findings";
import { SeverityBadge } from "../components/ui/badge";
import { SEVERIDADES } from "../lib/finding-query";

export function FindingsPage() {
  const [params] = useSearchParams();

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
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Findings</h1>
        <p className="mt-1 text-fg-muted">
          {erro
            ? "A busca não chegou ao servidor"
            : !sabeOTotal
              ? "Carregando findings…"
              : total === 0
                ? "Nenhum finding no recorte atual"
                : `${total} finding${total === 1 ? "" : "s"} no recorte atual`}
        </p>

        {/* ⚠️ `<dl>` e não `<div>`: cada item é um par rótulo/valor, e é assim
            que o leitor de tela anuncia "Crítica: 5" em vez de duas coisas
            soltas. O espaçamento é assimétrico de propósito — `gap-2` cola o
            número na severidade a que ele pertence, `gap-x-6` separa os pares
            entre si. Com o mesmo gap nos dois, "5 Alta" se lê como um par, e
            a leitura inteira sai trocada. */}
        {porSeveridade && total > 0 && (
          <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            {severidadesDoResumo
              .filter((s) => (porSeveridade[s] ?? 0) > 0)
              .map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <dt>
                    <SeverityBadge severidade={s} />
                  </dt>
                  <dd className="text-sm font-medium text-fg" data-numeric>
                    {porSeveridade[s]}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </header>

      <FindingsTable syncToUrl exportavel />
    </div>
  );
}
