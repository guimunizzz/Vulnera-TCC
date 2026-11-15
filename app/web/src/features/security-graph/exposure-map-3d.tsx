/**
 * exposure-map-3d.tsx
 *
 * O QUE FAZ
 * Mapa 3D da superfície de ataque da empresa: bairros por ambiente, um prédio
 * por aplicação (altura = abertas, base = criticidade, cor = pior severidade,
 * antena = exposta à Internet). Clique num prédio seleciona a aplicação (a
 * mesma seleção do grafo 2D e do painel); arrastar gira, roda aproxima.
 *
 * POR QUE EXISTE
 * É a visão de apresentação da empresa: a forma da cidade já conta onde está
 * o risco antes de qualquer número. Substitui o antigo Security Graph 3D do
 * scan (ADR-051), que repetia o 2D com menos legibilidade. Cada eixo visual é
 * um campo real; nada é decorativo a ponto de parecer dado. A cena é
 * imperativa, pelo kit `src/three/` (ADR-050), em `exposure-map-scene.ts`.
 *
 * Acessibilidade: o canvas não é navegável por teclado, então a lista de
 * prédios abaixo dele (botões) faz o mesmo papel; o painel lateral mostra o
 * detalhe. Movimento reduzido desliga o pulso da antena e o voo da câmera.
 * Sem WebGL2 ou abaixo de 768 px (o limite do kit), fica só a lista.
 *
 * QUEM USA
 * `exposure-graph-page.tsx`, via React.lazy() — `three` só baixa nesta aba.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useMotion } from "../../motion/use-motion";
import { LARGURA_MINIMA_PADRAO, suportaWebGL2 } from "../../three/gate";
import type { AplicacaoExposta, ExposureGraph } from "../../types/exposure-graph.types";
import { idDaAplicacao } from "./exposure-graph-model";
import { montarCidade } from "./exposure-map-layout";
import { montarMapa, TOKEN_DA_SEVERIDADE, TOKEN_NEUTRO, type MapaMontado } from "./exposure-map-scene";
import { ROTULO_RISCO } from "./node-visual";

const css = (token: string) => `oklch(var(${token}))`;

function useLargo(): boolean {
  const consulta = `(min-width: ${LARGURA_MINIMA_PADRAO}px)`;
  const [largo, setLargo] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const media = window.matchMedia(consulta);
    const atualizar = () => setLargo(media.matches);
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, [consulta]);
  return largo;
}

export default function ExposureMap3D({
  dados,
  selecionadoId,
  aoSelecionar,
}: {
  dados: ExposureGraph;
  selecionadoId: string | null;
  aoSelecionar(id: string | null): void;
}) {
  const { reduzido } = useMotion();
  const largo = useLargo();
  const [falhou, setFalhou] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotulosRef = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaMontado | null>(null);
  // Espelhos: a cena é montada uma vez e chama sempre a versão atual.
  const aoSelecionarRef = useRef(aoSelecionar);
  aoSelecionarRef.current = aoSelecionar;
  const selecionadoRef = useRef(selecionadoId);
  selecionadoRef.current = selecionadoId;

  const cidade = useMemo(() => montarCidade(dados.aplicacoes), [dados.aplicacoes]);
  const podeDesenhar = largo && suportaWebGL2() && !falhou;
  const expostas = dados.aplicacoes.filter((a) => a.internetFacing).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    const camada = rotulosRef.current;
    if (!podeDesenhar || !canvas || !camada) return;
    const montado = montarMapa({
      canvas,
      camadaRotulos: camada,
      cidade,
      reduzido,
      aoSelecionar: (id) => aoSelecionarRef.current(id),
      aoFalhar: () => setFalhou(true),
    });
    if (!montado) {
      setFalhou(true);
      return;
    }
    montado.selecionar(selecionadoRef.current);
    mapa.current = montado;
    return () => {
      montado.descartar();
      mapa.current = null;
    };
  }, [podeDesenhar, cidade, reduzido]);

  useEffect(() => {
    mapa.current?.selecionar(selecionadoId);
  }, [selecionadoId]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative overflow-hidden rounded-container border border-subtle bg-canvas">
        {podeDesenhar ? (
          <>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Mapa 3D da superfície de ataque: ${dados.aplicacoes.length} aplicações em ${cidade.bairros.length} ambientes, ${expostas} expostas à Internet. A lista abaixo do mapa tem as mesmas aplicações.`}
              className="block h-[34rem] w-full touch-none"
            />
            {/* Nomes dos prédios (CSS2D): seguem a câmera, sem receber clique. */}
            <div ref={rotulosRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" />
            <div className="absolute right-3 top-3">
              <Button
                variant="secundario"
                size="sm"
                onClick={() => {
                  aoSelecionar(null);
                  mapa.current?.recentralizar();
                }}
                iconeInicio={<LocateFixed className="h-4 w-4" aria-hidden="true" />}
              >
                Recentralizar
              </Button>
            </div>
          </>
        ) : (
          <div role="status" className="flex h-[12rem] items-center justify-center p-6 text-center text-sm text-fg-muted">
            {falhou || !suportaWebGL2()
              ? "Este navegador não conseguiu iniciar o WebGL. O grafo 2D e a lista abaixo mostram os mesmos dados."
              : "O mapa 3D aparece em telas a partir de 768 px. A lista abaixo e o grafo 2D mostram os mesmos dados."}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/85 px-3 py-2 text-xs text-fg-muted backdrop-blur">
          <span>Altura: abertas</span>
          <span>Base: criticidade</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: css("--color-accent") }} />
            Antena: exposta à Internet
          </span>
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[0.125rem]" style={{ background: css(TOKEN_DA_SEVERIDADE[s]) }} />
              {ROTULO_RISCO[s]}
            </span>
          ))}
        </div>
      </div>
      <ListaDePredios aplicacoes={dados.aplicacoes} selecionadoId={selecionadoId} aoSelecionar={aoSelecionar} />
    </div>
  );
}

/** O mesmo conteúdo do mapa, navegável por teclado e leitor de tela. */
function ListaDePredios({
  aplicacoes,
  selecionadoId,
  aoSelecionar,
}: {
  aplicacoes: AplicacaoExposta[];
  selecionadoId: string | null;
  aoSelecionar(id: string): void;
}) {
  return (
    <ul aria-label="Aplicações no mapa" className="flex flex-wrap gap-2">
      {aplicacoes.map((a) => {
        const id = idDaAplicacao(a.id);
        return (
          <li key={a.id}>
            <button
              type="button"
              aria-pressed={selecionadoId === id}
              onClick={() => aoSelecionar(id)}
              className="alvo-estendido flex items-center gap-2 rounded-full border border-subtle px-3 py-1 text-xs text-fg transition-colors hover:bg-inset aria-pressed:border-accent aria-pressed:bg-accent/10"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: css(a.piorSeveridade ? TOKEN_DA_SEVERIDADE[a.piorSeveridade] : TOKEN_NEUTRO) }}
                aria-hidden="true"
              />
              {a.name}
              <span className="font-mono text-fg-muted" data-numeric>
                {a.totalAbertas}
              </span>
              {a.internetFacing && <span className="sr-only">, exposta à Internet</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
