/**
 * use-filtros-metricas.ts
 *
 * O QUE FAZ
 * Mantém o estado dos filtros do dashboard NA URL, e devolve o objeto pronto
 * para o cliente de métricas.
 *
 * 🎯 A URL É A FONTE ÚNICA DA VERDADE. Não há `useState` espelhando o filtro.
 * Isso não é purismo — é o que faz três coisas funcionarem de graça:
 *   1. o link é compartilhável ("olha este recorte");
 *   2. voltar/avançar do navegador desfaz um filtro;
 *   3. recarregar preserva o contexto.
 * Um `useState` paralelo quebraria as três na primeira dessincronização.
 *
 * PERSISTÊNCIA POR APLICAÇÃO
 * O último filtro usado é guardado em `localStorage`, por aplicação, e
 * reaplicado quando se volta à página SEM filtro na URL. ⚠️ A URL SEMPRE VENCE:
 * se ela traz filtro, o storage é ignorado. Sem essa regra, abrir um link
 * compartilhado mostraria o filtro de quem clicou, não o de quem enviou — que é
 * exatamente o oposto do ponto 1.
 *
 * QUEM USA
 * `application-dashboard-page.tsx` e a barra de filtros.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { FiltroMetricas, Granularidade } from "../types/metrics.types";

const CHAVE_STORAGE = (applicationId: string) => `vulnera:filtros:${applicationId}`;

/** Presets de período. `dias: null` = desde sempre. */
export const PRESETS = [
  { id: "7d", rotulo: "7 dias", dias: 7 },
  { id: "30d", rotulo: "30 dias", dias: 30 },
  { id: "90d", rotulo: "90 dias", dias: 90 },
  { id: "365d", rotulo: "1 ano", dias: 365 },
  { id: "tudo", rotulo: "Tudo", dias: null },
] as const;

export type IdPreset = (typeof PRESETS)[number]["id"] | "custom";

/** Parâmetros que este hook administra. Os demais da URL passam intactos. */
const PARAMS = ["periodo", "from", "to", "severity", "status", "owasp", "busca", "comparar", "granularity"] as const;

export interface FiltrosDashboard {
  preset: IdPreset;
  de: string | null;
  ate: string | null;
  severidades: string[];
  status: string[];
  owasp: string[];
  busca: string;
  comparar: boolean;
  granularidade?: Granularidade;
}

export interface ControlesDeFiltro {
  filtros: FiltrosDashboard;
  /** Objeto pronto para `metricsApi.*`. */
  paraApi: FiltroMetricas;
  /** Quantos filtros (fora o período) estão ativos — alimenta os chips. */
  quantidadeAtiva: number;
  definirPreset: (preset: IdPreset, de?: string, ate?: string) => void;
  alternarValor: (campo: "severidades" | "status" | "owasp", valor: string) => void;
  definirBusca: (texto: string) => void;
  alternarComparacao: () => void;
  /** Aplica um recorte inteiro de uma vez — usado pela filtragem cruzada. */
  aplicarRecorte: (recorte: Record<string, string | number>) => void;
  removerFiltro: (campo: keyof FiltrosDashboard, valor?: string) => void;
  limparTudo: () => void;
}

const lerLista = (p: URLSearchParams, chave: string): string[] => {
  const bruto = p.get(chave);
  return bruto ? bruto.split(",").filter(Boolean) : [];
};

function calcularJanela(preset: IdPreset, de: string | null, ate: string | null) {
  if (preset === "custom") return { from: de ?? undefined, to: ate ?? undefined };
  const config = PRESETS.find((p) => p.id === preset);
  if (!config || config.dias === null) return {};
  const agora = new Date();
  return {
    from: new Date(agora.getTime() - config.dias * 86_400_000).toISOString(),
    to: agora.toISOString(),
  };
}

export function useFiltrosMetricas(applicationId: string): ControlesDeFiltro {
  const [params, setParams] = useSearchParams();
  const jaRestaurou = useRef(false);

  const filtros = useMemo<FiltrosDashboard>(
    () => ({
      preset: (params.get("periodo") as IdPreset) ?? "90d",
      de: params.get("from"),
      ate: params.get("to"),
      severidades: lerLista(params, "severity"),
      status: lerLista(params, "status"),
      owasp: lerLista(params, "owasp"),
      busca: params.get("busca") ?? "",
      comparar: params.get("comparar") === "1",
      granularidade: (params.get("granularity") as Granularidade) || undefined,
    }),
    [params],
  );

  /* --- persistência: restaura só quando a URL está limpa ------------------ */
  useEffect(() => {
    if (jaRestaurou.current) return;
    jaRestaurou.current = true;

    const urlTemFiltro = PARAMS.some((p) => params.has(p));
    if (urlTemFiltro) return; // ⚠️ a URL vence — ver o cabeçalho

    try {
      const guardado = localStorage.getItem(CHAVE_STORAGE(applicationId));
      if (!guardado) return;
      const restaurados = new URLSearchParams(guardado);
      if ([...restaurados.keys()].length === 0) return;
      const novos = new URLSearchParams(params);
      restaurados.forEach((v, k) => novos.set(k, v));
      setParams(novos, { replace: true });
    } catch {
      // storage indisponível (modo privado) — o dashboard abre no padrão
    }
  }, [applicationId, params, setParams]);

  useEffect(() => {
    try {
      const aGuardar = new URLSearchParams();
      for (const p of PARAMS) {
        const v = params.get(p);
        if (v) aGuardar.set(p, v);
      }
      localStorage.setItem(CHAVE_STORAGE(applicationId), aGuardar.toString());
    } catch {
      /* idem */
    }
  }, [applicationId, params]);

  /* --- escrita ------------------------------------------------------------ */

  /**
   * `replace: true` em toda alteração de filtro.
   *
   * Com `push`, marcar quatro severidades empilharia quatro entradas no
   * histórico, e sair da página exigiria quatro cliques no "voltar". O botão
   * "voltar" continua desfazendo — só que desfaz a NAVEGAÇÃO, não cada
   * clique num checkbox.
   */
  const escrever = useCallback(
    (mudancas: Record<string, string | null>) => {
      const novos = new URLSearchParams(params);
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null || valor === "") novos.delete(chave);
        else novos.set(chave, valor);
      }
      setParams(novos, { replace: true });
    },
    [params, setParams],
  );

  const definirPreset = useCallback(
    (preset: IdPreset, de?: string, ate?: string) => {
      escrever({
        periodo: preset,
        from: preset === "custom" ? (de ?? null) : null,
        to: preset === "custom" ? (ate ?? null) : null,
      });
    },
    [escrever],
  );

  const alternarValor = useCallback(
    (campo: "severidades" | "status" | "owasp", valor: string) => {
      const chave = { severidades: "severity", status: "status", owasp: "owasp" }[campo];
      const atuais = lerLista(params, chave);
      const novos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];
      escrever({ [chave]: novos.length ? novos.join(",") : null });
    },
    [params, escrever],
  );

  const definirBusca = useCallback((texto: string) => escrever({ busca: texto || null }), [escrever]);

  const alternarComparacao = useCallback(
    () => escrever({ comparar: filtros.comparar ? null : "1" }),
    [escrever, filtros.comparar],
  );

  /**
   * Filtragem cruzada: clicar numa fatia do donut ou numa barra do aging
   * aplica aquele recorte ao painel inteiro.
   *
   * As chaves aceitas são as mesmas que o backend devolve no `filtro` de cada
   * insight — assim um insight clicável e uma fatia de gráfico usam o mesmo
   * caminho, e não há dois vocabulários de filtro no produto.
   */
  const aplicarRecorte = useCallback(
    (recorte: Record<string, string | number>) => {
      const mudancas: Record<string, string | null> = {};
      if (recorte.severity) mudancas.severity = String(recorte.severity);
      if (recorte.status) mudancas.status = String(recorte.status);
      if (recorte.owasp) mudancas.owasp = String(recorte.owasp);
      if (recorte.agingMinDias) {
        // Idade vira janela de período: "aberto há mais de 30 dias" é o mesmo
        // que "criado antes de 30 dias atrás".
        mudancas.periodo = "custom";
        mudancas.to = new Date(Date.now() - Number(recorte.agingMinDias) * 86_400_000).toISOString();
        mudancas.from = null;
      }
      escrever(mudancas);
    },
    [escrever],
  );

  const removerFiltro = useCallback(
    (campo: keyof FiltrosDashboard, valor?: string) => {
      if (campo === "severidades" || campo === "status" || campo === "owasp") {
        if (valor) return alternarValor(campo, valor);
        const chave = { severidades: "severity", status: "status", owasp: "owasp" }[campo];
        return escrever({ [chave]: null });
      }
      if (campo === "busca") return escrever({ busca: null });
      if (campo === "comparar") return escrever({ comparar: null });
      if (campo === "preset") return escrever({ periodo: null, from: null, to: null });
    },
    [alternarValor, escrever],
  );

  const limparTudo = useCallback(() => {
    const novos = new URLSearchParams(params);
    for (const p of PARAMS) novos.delete(p);
    setParams(novos, { replace: true });
  }, [params, setParams]);

  const paraApi = useMemo<FiltroMetricas>(() => {
    const janela = calcularJanela(filtros.preset, filtros.de, filtros.ate);
    return {
      ...janela,
      severity: filtros.severidades.length ? filtros.severidades : undefined,
      status: filtros.status.length ? filtros.status : undefined,
      owasp: filtros.owasp.length ? filtros.owasp : undefined,
      granularity: filtros.granularidade,
      compare: filtros.comparar || undefined,
    };
  }, [filtros]);

  const quantidadeAtiva =
    filtros.severidades.length + filtros.status.length + filtros.owasp.length + (filtros.busca ? 1 : 0);

  return {
    filtros,
    paraApi,
    quantidadeAtiva,
    definirPreset,
    alternarValor,
    definirBusca,
    alternarComparacao,
    aplicarRecorte,
    removerFiltro,
    limparTudo,
  };
}
