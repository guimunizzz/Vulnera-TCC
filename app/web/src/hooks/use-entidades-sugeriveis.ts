/**
 * use-entidades-sugeriveis.ts
 *
 * O QUE FAZ
 * Busca as listas de projeto, aplicação e empresa que a caixa de sugestões da
 * barra oferece — nome na tela, id na expressão.
 *
 * 🎯 SÓ BUSCA O QUE O PAPEL PODE BUSCAR
 * Cada endpoint tem um recorte diferente, e pedir o que o papel não pode
 * resultaria em 403 no console a cada abertura da tela:
 *   - `GET /projects`      → todos os papéis (já escopado pelo backend)
 *   - `GET /applications`  → ADMIN e CLIENT; o service responde FORBIDDEN para
 *                            PENTESTER ("não gerencia applications nesta fase")
 *   - `GET /companies`     → ADMIN apenas (`requireRole` na rota)
 *
 * A consequência é deliberada e está documentada em `query-suggestions.tsx`:
 * um campo que não temos como completar simplesmente NÃO é oferecido. Oferecer
 * `empresa` para um PENTESTER o levaria a digitar um nome que nunca resolve
 * para id — ou seja, a um chip inválido e a um beco sem saída.
 *
 * ⚠️ Estes dados mudam pouco (projeto novo é evento raro) e são lidos a cada
 * tecla na barra, então ficam com `staleTime` alto. Sem isso, abrir a caixa
 * revalidaria três listas a cada foco.
 *
 * QUEM USA
 * `components/findings/findings-table.tsx`.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../lib/api/projects.api";
import { applicationsApi } from "../lib/api/applications.api";
import { companiesApi } from "../lib/api/companies.api";
import { useAuthStore } from "../store/auth.store";
import type { EntidadesSugeriveis } from "../components/findings/query-suggestions";

/** 5 minutos: catálogo, não dado operacional. */
const TEMPO_FRESCO = 5 * 60 * 1000;

export function useEntidadesSugeriveis(camposOcultos: string[] = []): EntidadesSugeriveis {
  const papel = useAuthStore((s) => s.user?.role);

  const querProjeto = !camposOcultos.includes("projeto");
  const querAplicacao = !camposOcultos.includes("aplicacao") && (papel === "ADMIN" || papel === "CLIENT");
  const querEmpresa = !camposOcultos.includes("empresa") && papel === "ADMIN";

  const projetos = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled: querProjeto,
    staleTime: TEMPO_FRESCO,
  });

  const aplicacoes = useQuery({
    queryKey: ["applications"],
    queryFn: applicationsApi.list,
    enabled: querAplicacao,
    staleTime: TEMPO_FRESCO,
  });

  const empresas = useQuery({
    queryKey: ["companies"],
    queryFn: companiesApi.list,
    enabled: querEmpresa,
    staleTime: TEMPO_FRESCO,
  });

  return useMemo(
    () => ({
      // `undefined` (e não lista vazia) quando o papel não pode buscar: é o que
      // a caixa de sugestões lê para NÃO oferecer o campo. Lista vazia
      // significaria "não há nenhum", que é outra coisa.
      projeto: querProjeto ? (projetos.data ?? []).map((p) => ({ id: p.id, nome: p.name })) : undefined,
      aplicacao: querAplicacao ? (aplicacoes.data ?? []).map((a) => ({ id: a.id, nome: a.name })) : undefined,
      empresa: querEmpresa ? (empresas.data ?? []).map((c) => ({ id: c.id, nome: c.name })) : undefined,
    }),
    [querProjeto, querAplicacao, querEmpresa, projetos.data, aplicacoes.data, empresas.data],
  );
}
