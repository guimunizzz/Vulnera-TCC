/**
 * use-analises-do-grafo.tsx
 *
 * O QUE FAZ
 * Junta as três análises do Exposure Graph (ADR-061) num lugar, para a página
 * só encaixar as peças: o modo ativo (na URL, `?analise=`, para dar para
 * compartilhar o link), as consultas de cada análise (só a do modo ativo
 * roda), os dados que o grafo desenha (o passado, na máquina do tempo), os
 * nós em destaque, a barra do grafo e o painel lateral.
 *
 * QUEM USA
 * `exposure-graph-page.tsx`.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApiError } from "../../../hooks/use-api-error";
import { exposureGraphApi } from "../../../lib/api/exposure-graph.api";
import type { CombinacaoToxica, ExposureGraph } from "../../../types/exposure-graph.types";
import { exposicaoNoInstante, intervaloDoHistorico } from "../exposicao-no-tempo";
import { ID_EMPRESA, idDaAplicacao, idDaCategoria } from "../exposure-graph-model";
import { ControleDoTempo, PainelDoTempo } from "./maquina-do-tempo";
import { PainelCombinacoes } from "./painel-combinacoes";
import { alvoDaChave } from "./alvo-de-impacto";
import { PainelImpacto, SeletorDeImpacto } from "./raio-de-impacto";
import { SeletorDeAnalise, type ModoDeAnalise } from "./seletor-de-analise";

const MODOS: readonly ModoDeAnalise[] = ["atual", "toxicas", "impacto", "tempo"];

export interface AnalisesDoGrafo {
  modo: ModoDeAnalise;
  /** O que o grafo desenha: hoje, ou o dia escolhido na máquina do tempo. */
  dadosExibidos: ExposureGraph | undefined;
  destaque: ReadonlySet<string> | null;
  barra: ReactNode;
  /** Painel da análise; null = o painel normal da seleção. */
  painel: ReactNode | null;
}

export function useAnalisesDoGrafo(dados: ExposureGraph | undefined, aoSelecionar: (id: string | null) => void): AnalisesDoGrafo {
  const [params, setParams] = useSearchParams();
  const mensagemDeErro = useApiError();
  const pedido = params.get("analise");
  const modo: ModoDeAnalise = MODOS.includes(pedido as ModoDeAnalise) ? (pedido as ModoDeAnalise) : "atual";
  const alvoChave = params.get("alvo");
  const alvo = alvoChave ? alvoDaChave(alvoChave) : null;
  const [instante, setInstante] = useState<number | null>(null);
  const [combinacao, setCombinacao] = useState<string | null>(null);
  const temDados = !!dados && dados.aplicacoes.length > 0;

  const mudarModo = (novo: ModoDeAnalise) => {
    setParams(
      (p) => {
        if (novo === "atual") p.delete("analise");
        else p.set("analise", novo);
        p.delete("alvo");
        return p;
      },
      { replace: true },
    );
    setInstante(null);
    setCombinacao(null);
    aoSelecionar(null);
  };

  const combinacoes = useQuery({
    queryKey: ["exposure-graph", "toxicas"],
    queryFn: exposureGraphApi.combinacoesToxicas,
    enabled: temDados && modo === "toxicas",
  });
  const opcoes = useQuery({
    queryKey: ["exposure-graph", "impacto", "opcoes"],
    queryFn: exposureGraphApi.opcoesDeImpacto,
    enabled: temDados && modo === "impacto",
  });
  const impacto = useQuery({
    queryKey: ["exposure-graph", "impacto", alvo?.tipo, alvo?.valor],
    queryFn: () => exposureGraphApi.impacto(alvo!.tipo, alvo!.valor),
    enabled: temDados && modo === "impacto" && !!alvo,
  });
  const historico = useQuery({
    queryKey: ["exposure-graph", "historico"],
    queryFn: exposureGraphApi.historico,
    enabled: temDados && modo === "tempo",
  });

  const fimDoTempo = historico.data ? intervaloDoHistorico(historico.data).fim : Date.now();
  const noPassado = modo === "tempo" && !!historico.data && instante !== null && instante < fimDoTempo;
  const dadosExibidos = useMemo(
    () => (noPassado && dados && historico.data ? exposicaoNoInstante(dados, historico.data, new Date(instante!)) : dados),
    [noPassado, dados, historico.data, instante],
  );

  const destaque = useMemo<ReadonlySet<string> | null>(() => {
    if (modo === "toxicas" && combinacoes.data && combinacoes.data.total > 0) {
      const ids = new Set<string>([ID_EMPRESA]);
      for (const c of combinacoes.data.combinacoes) {
        ids.add(idDaAplicacao(c.aplicacao.id));
        ids.add(idDaCategoria(c.owaspCategory));
      }
      return ids;
    }
    if (modo === "impacto" && alvo && impacto.data) {
      const ids = new Set<string>([ID_EMPRESA, ...impacto.data.aplicacoes.map((a) => idDaAplicacao(a.id))]);
      if (alvo.tipo === "CATEGORIA") ids.add(idDaCategoria(alvo.valor));
      return ids;
    }
    return null;
  }, [modo, combinacoes.data, alvo, impacto.data]);

  const escolherCombinacao = (c: CombinacaoToxica) => {
    setCombinacao(c.vulnerabilityId);
    aoSelecionar(idDaAplicacao(c.aplicacao.id));
  };

  const barra = (
    <div className="flex flex-wrap items-center gap-3">
      <SeletorDeAnalise valor={modo} aoMudar={mudarModo} />
      {modo === "impacto" && (
        <SeletorDeImpacto
          opcoes={opcoes.data}
          carregando={opcoes.isLoading}
          valor={alvoChave}
          aoMudar={(chave) => {
            setParams(
              (p) => {
                p.set("alvo", chave);
                return p;
              },
              { replace: true },
            );
            aoSelecionar(null);
          }}
        />
      )}
      {modo === "tempo" && historico.data && (
        <div className="min-w-0 flex-1">
          <ControleDoTempo historico={historico.data} instante={instante ?? fimDoTempo} aoMudar={setInstante} />
        </div>
      )}
      {modo === "tempo" && historico.isLoading && <p className="text-xs text-fg-muted">Carregando o histórico…</p>}
    </div>
  );

  let painel: ReactNode | null = null;
  if (modo === "toxicas") {
    painel = (
      <PainelCombinacoes
        dados={combinacoes.data}
        carregando={combinacoes.isLoading}
        erro={combinacoes.isError ? mensagemDeErro(combinacoes.error) : null}
        aoTentarDeNovo={() => void combinacoes.refetch()}
        escolhida={combinacao}
        aoEscolher={escolherCombinacao}
      />
    );
  } else if (modo === "impacto") {
    painel = (
      <PainelImpacto
        alvo={alvo}
        dados={impacto.data}
        carregando={impacto.isLoading}
        erro={impacto.isError ? mensagemDeErro(impacto.error) : null}
        aoTentarDeNovo={() => void impacto.refetch()}
        aoSelecionar={aoSelecionar}
      />
    );
  } else if (modo === "tempo" && noPassado && dados && dadosExibidos) {
    painel = (
      <PainelDoTempo
        noInstante={dadosExibidos}
        hoje={dados}
        instante={instante!}
        semTrilha={historico.data!.vulnerabilidades.filter((v) => v.mudancas.length === 0 && v.status !== "OPEN").length}
      />
    );
  }

  return { modo, dadosExibidos, destaque, barra, painel };
}
