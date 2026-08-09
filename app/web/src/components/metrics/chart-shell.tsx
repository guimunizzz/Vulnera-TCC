/**
 * chart-shell.tsx
 *
 * O QUE FAZ
 * A infraestrutura compartilhada por todos os gráficos: cores vindas dos
 * tokens, moldura com título e estados (carregando / vazio / erro), e o
 * tooltip padrão.
 *
 * POR QUE EXISTE
 * O Recharts pinta em SVG e não entende classe do Tailwind — ele precisa de
 * cor concreta. Sem este arquivo, cada gráfico repetiria um hex, e trocar o
 * tema deixaria os gráficos para trás (foi exatamente o que aconteceu na Fase
 * 6: `severity-donut.tsx` tinha `#141414` e `#262626` escritos à mão no
 * tooltip). Aqui a cor é LIDA dos tokens em tempo de execução e recalculada
 * quando o tema muda.
 *
 * REGRAS QUE ESTE ARQUIVO IMPÕE (CP5)
 *   - todo gráfico tem estado vazio DESENHADO, nunca uma área em branco
 *   - o esqueleto tem a FORMA do gráfico final, para não haver salto
 *   - o tooltip mostra valor absoluto E relativo
 *   - eixo e legenda sempre rotulados
 *
 * QUEM USA
 * Todos os gráficos de `components/metrics/`.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "../../design/theme-provider";
import { Card, EmptyState, ErrorState, Skeleton } from "../ui";
import { cn } from "../../lib/cn";

/* ==========================================================================
   Cores a partir dos tokens
   ========================================================================== */

export interface CoresDoGrafico {
  severidade: Record<string, string>;
  serie: string[];
  grade: string;
  eixo: string;
  acento: string;
  sucesso: string;
  perigo: string;
  superficie: string;
  borda: string;
  texto: string;
  textoAtenuado: string;
}

/**
 * Lê um token de cor e devolve `oklch(...)` pronto para o SVG.
 *
 * `getComputedStyle` na raiz é o que dá acesso ao valor JÁ RESOLVIDO pela
 * cascata — inclusive quando o tema mudou o alias por baixo. Ler o token
 * primitivo direto não funcionaria: o componente não sabe (nem deve saber)
 * qual primitivo o tema atual escolheu.
 */
function lerCor(nome: string): string {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return bruto ? `oklch(${bruto})` : "transparent";
}

export function useCoresDoGrafico(): CoresDoGrafico {
  const { resolvido } = useTheme();
  const [cores, setCores] = useState<CoresDoGrafico>(() => coresVazias());

  // Depende de `resolvido`: quando o tema troca, os tokens já mudaram no
  // documento e as cores precisam ser lidas de novo. Sem isso o gráfico
  // continuaria com a paleta do tema anterior até o próximo refetch.
  useEffect(() => {
    setCores({
      severidade: {
        CRITICAL: lerCor("--color-severity-critical"),
        HIGH: lerCor("--color-severity-high"),
        MEDIUM: lerCor("--color-severity-medium"),
        LOW: lerCor("--color-severity-low"),
        NONE: lerCor("--color-severity-info"),
      },
      serie: [1, 2, 3, 4, 5, 6].map((n) => lerCor(`--color-chart-${n}`)),
      grade: lerCor("--color-chart-grid"),
      eixo: lerCor("--color-chart-axis"),
      acento: lerCor("--color-accent"),
      sucesso: lerCor("--color-success"),
      perigo: lerCor("--color-danger"),
      superficie: lerCor("--color-bg-overlay"),
      borda: lerCor("--color-border-subtle"),
      texto: lerCor("--color-text-primary"),
      textoAtenuado: lerCor("--color-text-muted"),
    });
  }, [resolvido]);

  return cores;
}

function coresVazias(): CoresDoGrafico {
  return {
    severidade: {},
    serie: [],
    grade: "transparent",
    eixo: "transparent",
    acento: "transparent",
    sucesso: "transparent",
    perigo: "transparent",
    superficie: "transparent",
    borda: "transparent",
    texto: "transparent",
    textoAtenuado: "transparent",
  };
}

/* ==========================================================================
   Moldura
   ========================================================================== */

export interface ChartShellProps {
  titulo: string;
  descricao?: string;
  /** Ações no canto (seletor de granularidade, exportar). */
  acoes?: ReactNode;
  carregando?: boolean;
  erro?: boolean;
  aoTentarNovamente?: () => void;
  /** `true` = não há dados; desenha o estado vazio em vez do gráfico. */
  vazio?: boolean;
  tituloVazio?: string;
  descricaoVazio?: string;
  /** Altura do gráfico. O esqueleto usa a MESMA — é o que evita o salto. */
  altura?: number;
  children: ReactNode;
  className?: string;
}

export function ChartShell({
  titulo,
  descricao,
  acoes,
  carregando,
  erro,
  aoTentarNovamente,
  vazio,
  tituloVazio = "Sem dados no período",
  descricaoVazio = "Amplie o período ou remova filtros para ver o histórico.",
  altura = 260,
  children,
  className,
}: ChartShellProps) {
  return (
    <Card titulo={titulo} descricao={descricao} acoes={acoes} className={className}>
      <div style={{ minHeight: altura }}>
        {carregando ? (
          <EsqueletoDeGrafico altura={altura} />
        ) : erro ? (
          <ErrorState aoTentarNovamente={aoTentarNovamente} />
        ) : vazio ? (
          <EmptyState compacto titulo={tituloVazio} descricao={descricaoVazio} className="h-full border-0" />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/**
 * Esqueleto com a silhueta de um gráfico de barras.
 *
 * Não é um retângulo cinza: a forma aproximada do resultado faz o cérebro
 * entender "vem um gráfico aqui" antes de o dado chegar, e o crossfade para o
 * conteúdo real não mexe no layout.
 */
export function EsqueletoDeGrafico({ altura = 260 }: { altura?: number }) {
  const alturas = [45, 70, 55, 85, 60, 75, 50, 90, 65, 40, 80, 55];
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-end gap-2" style={{ height: altura - 40 }}>
        {alturas.map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/* ==========================================================================
   Tooltip
   ========================================================================== */

export interface ItemTooltip {
  nome: string;
  valor: number;
  cor: string;
}

/**
 * Tooltip padrão: valor ABSOLUTO e RELATIVO.
 *
 * O relativo não é enfeite. "18 findings" não responde "isso é muito?"; "18
 * findings (44% do total)" responde. É a diferença entre um gráfico que se
 * olha e um gráfico que se usa.
 */
export function TooltipDoGrafico({
  titulo,
  itens,
  total,
  sufixo,
  cores,
}: {
  titulo: string;
  itens: ItemTooltip[];
  /** Base do percentual. Ausente = soma dos itens. */
  total?: number;
  sufixo?: string;
  cores: CoresDoGrafico;
}) {
  const base = total ?? itens.reduce((a, i) => a + i.valor, 0);

  return (
    <div
      className="rounded-container border p-3 text-xs shadow-overlay"
      style={{ background: cores.superficie, borderColor: cores.borda, color: cores.texto }}
    >
      <p className="mb-2 font-semibold">{titulo}</p>
      <ul className="flex flex-col gap-1">
        {itens.map((item) => (
          <li key={item.nome} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.cor }} />
            <span style={{ color: cores.textoAtenuado }}>{item.nome}</span>
            <span className="ml-auto font-mono tabular-nums">
              {item.valor}
              {sufixo}
              {base > 0 && !sufixo && (
                <span style={{ color: cores.textoAtenuado }}> ({Math.round((item.valor / base) * 100)}%)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Responsividade
   ========================================================================== */

/**
 * `true` quando a tela é estreita demais para um gráfico ser legível.
 *
 * O CP5 é explícito: em tela estreita o gráfico vira LISTA ou some com aviso —
 * nunca encolhe até virar ilegível. 640px é o ponto em que um eixo com 12
 * rótulos deixa de caber sem sobreposição.
 */
export function useTelaEstreita(limite = 640): boolean {
  const [estreita, setEstreita] = useState(() => typeof window !== "undefined" && window.innerWidth < limite);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${limite - 1}px)`);
    const aoMudar = (e: MediaQueryListEvent) => setEstreita(e.matches);
    setEstreita(mql.matches);
    mql.addEventListener("change", aoMudar);
    return () => mql.removeEventListener("change", aoMudar);
  }, [limite]);

  return estreita;
}

/** Substituto textual de um gráfico em tela estreita. */
export function ListaEmVezDeGrafico({
  itens,
  className,
}: {
  itens: { rotulo: string; valor: number; cor?: string }[];
  className?: string;
}) {
  const total = itens.reduce((a, i) => a + i.valor, 0);
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-3 text-sm">
          {i.cor && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: i.cor }} />}
          <span className="flex-1 text-fg">{i.rotulo}</span>
          <span className="font-mono text-fg-muted" data-numeric>
            {i.valor}
            {total > 0 && ` (${Math.round((i.valor / total) * 100)}%)`}
          </span>
        </li>
      ))}
    </ul>
  );
}
