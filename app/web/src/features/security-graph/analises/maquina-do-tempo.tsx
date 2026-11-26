/**
 * maquina-do-tempo.tsx
 *
 * O QUE FAZ
 * A máquina do tempo do Exposure Graph (ADR-061). Na barra do grafo: um
 * controle deslizante por dia, do primeiro registro até hoje, com a curva de
 * abertas (e de críticas) desenhada por trás, e um botão que reproduz a
 * história. No painel lateral: o retrato daquele dia comparado com hoje.
 *
 * A reconstrução em si é pura e testada (`exposicao-no-tempo.ts`); aqui só a
 * interface. Movimento reduzido: o botão de reproduzir não anima — salta para
 * o fim, e o controle continua livre.
 *
 * QUEM USA
 * `exposure-graph-page.tsx` (modo "Máquina do tempo").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Pause, Play } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { useMotion } from "../../../motion/use-motion";
import type { ExposureGraph, HistoricoDaExposicao } from "../../../types/exposure-graph.types";
import { intervaloDoHistorico, linhaDoTempo } from "../exposicao-no-tempo";
import { cor } from "../node-visual";

const DIA_MS = 86_400_000;
/** Duração da reprodução inteira, do primeiro dia até hoje. */
const DURACAO_REPRODUCAO_MS = 9000;

const formatarDia = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function ControleDoTempo({
  historico,
  instante,
  aoMudar,
}: {
  historico: HistoricoDaExposicao;
  instante: number;
  aoMudar(instante: number): void;
}) {
  const { reduzido } = useMotion();
  const { inicio, fim } = useMemo(() => intervaloDoHistorico(historico), [historico]);
  const pontos = useMemo(() => linhaDoTempo(historico, inicio, fim, 120), [historico, inicio, fim]);
  const dias = Math.max(1, Math.round((fim - inicio) / DIA_MS));
  const diaAtual = Math.round((Math.min(instante, fim) - inicio) / DIA_MS);
  const [tocando, setTocando] = useState(false);
  const quadro = useRef(0);

  // Reprodução: percorre do dia em que está (ou do começo, se já estava no fim) até hoje.
  useEffect(() => {
    if (!tocando) return;
    if (reduzido) {
      aoMudar(fim);
      setTocando(false);
      return;
    }
    const partida = diaAtual >= dias ? 0 : diaAtual;
    const t0 = performance.now();
    const passo = (agora: number) => {
      const progresso = Math.min(1, (agora - t0) / (DURACAO_REPRODUCAO_MS * ((dias - partida) / dias)));
      const dia = Math.round(partida + (dias - partida) * progresso);
      aoMudar(dia >= dias ? fim : inicio + dia * DIA_MS);
      if (progresso < 1) quadro.current = requestAnimationFrame(passo);
      else setTocando(false);
    };
    quadro.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro.current);
    // A reprodução começa do dia em que o controle estava no clique; não reinicia a cada passo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocando]);

  // A curva por trás do controle: abertas (área) e críticas (linha).
  const maximo = Math.max(1, ...pontos.map((p) => p.abertas));
  const x = (i: number) => (i / Math.max(1, pontos.length - 1)) * 100;
  const y = (n: number) => 28 - (n / maximo) * 26;
  const area = `M 0 28 ${pontos.map((p, i) => `L ${x(i)} ${y(p.abertas)}`).join(" ")} L 100 28 Z`;
  const criticas = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.criticas)}`).join(" ");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secundario"
        size="sm"
        rotulo={tocando ? "Pausar a reprodução" : "Reproduzir a história até hoje"}
        aria-pressed={tocando}
        onClick={() => setTocando((t) => !t)}
      >
        {tocando ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </Button>
      <div className="relative min-w-[12rem] flex-1">
        <svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-1 h-[1.75rem] w-full">
          <path d={area} fill={cor("--color-accent", 0.16)} />
          <path d={criticas} fill="none" stroke={cor("--color-severity-critical")} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <line x1={(diaAtual / dias) * 100} x2={(diaAtual / dias) * 100} y1={0} y2={28} stroke={cor("--color-accent-ink")} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <input
          type="range"
          min={0}
          max={dias}
          step={1}
          value={diaAtual}
          onChange={(e) => {
            setTocando(false);
            const dia = Number(e.target.value);
            aoMudar(dia >= dias ? fim : inicio + dia * DIA_MS);
          }}
          aria-label="Dia mostrado no grafo"
          aria-valuetext={formatarDia(instante)}
          className="relative mt-6 w-full accent-[oklch(var(--color-accent))]"
        />
      </div>
      <p className="flex items-center gap-1 font-mono text-xs text-fg-secondary" aria-live="polite" data-numeric>
        <Clock3 className="h-4 w-4" aria-hidden="true" />
        {instante >= fim ? "Hoje" : formatarDia(instante)}
      </p>
    </div>
  );
}

const somaAbertas = (dados: ExposureGraph) => dados.aplicacoes.reduce((s, a) => s + a.totalAbertas, 0);
const somaCriticas = (dados: ExposureGraph) => dados.aplicacoes.reduce((s, a) => s + a.abertas.CRITICAL, 0);

function Diferenca({ antes, hoje }: { antes: number; hoje: number }) {
  const d = hoje - antes;
  if (d === 0) return <span className="text-fg-muted">igual a hoje</span>;
  // Menos aberta hoje que no passado é melhora: verde; mais, piora.
  return <span className={d < 0 ? "text-success-ink" : "text-danger-ink"}>{d < 0 ? `${-d} a menos hoje` : `${d} a mais hoje`}</span>;
}

export function PainelDoTempo({ noInstante, hoje, instante, semTrilha }: { noInstante: ExposureGraph; hoje: ExposureGraph; instante: number; semTrilha: number }) {
  const linhas = [
    { rotulo: "Abertas", antes: somaAbertas(noInstante), agora: somaAbertas(hoje) },
    { rotulo: "Críticas abertas", antes: somaCriticas(noInstante), agora: somaCriticas(hoje) },
    { rotulo: "Aplicações com algo aberto", antes: noInstante.aplicacoes.filter((a) => a.totalAbertas > 0).length, agora: hoje.aplicacoes.filter((a) => a.totalAbertas > 0).length },
  ];
  return (
    <aside aria-label="Máquina do tempo" className="space-y-4 rounded-container border border-subtle bg-surface p-4 shadow-raised lg:sticky lg:top-4 lg:self-start">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
          <Clock3 className="h-4 w-4" aria-hidden="true" /> Máquina do tempo
        </p>
        <h3 className="text-lg font-semibold text-fg">{formatarDia(instante)}</h3>
        <p className="text-sm text-fg-secondary">O grafo como ele estava neste dia, reconstruído da criação e das mudanças de status de cada vulnerabilidade.</p>
      </div>
      <dl className="space-y-2">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-2 rounded-control border border-subtle bg-inset px-3 py-2">
            <dt className="text-sm text-fg-secondary">{l.rotulo}</dt>
            <dd className="text-right">
              <span className="font-mono text-base font-semibold text-fg" data-numeric>
                {l.antes}
              </span>
              <span className="block text-xs">
                <Diferenca antes={l.antes} hoje={l.agora} />
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-fg-muted">
        O contexto das aplicações (exposição, ambiente) é o de hoje.
        {semTrilha > 0 && ` ${semTrilha} vulnerabilidade${semTrilha === 1 ? "" : "s"} sem trilha de status entra${semTrilha === 1 ? "" : "m"} pelo estado atual.`}
      </p>
    </aside>
  );
}
