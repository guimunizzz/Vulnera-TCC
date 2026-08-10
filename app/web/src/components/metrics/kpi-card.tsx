/**
 * kpi-card.tsx
 *
 * O QUE FAZ
 * Cartão de indicador: número grande animado, variação em relação ao período
 * anterior e micro-sparkline.
 *
 * O DETALHE QUE FAZ DIFERENÇA — a direção do "bom"
 * Nem toda subida é boa. "Taxa de remediação subiu 12%" é positivo; "risk score
 * subiu 12%" é péssimo. O componente recebe `subirEhBom` e pinta a variação de
 * acordo. Pintar toda subida de verde é o erro que faz um dashboard mentir
 * exatamente na métrica que mais importa.
 *
 * ACESSIBILIDADE
 *   - A variação tem SETA (▲/▼) além da cor — cor sozinha reprovaria WCAG 1.4.1.
 *   - O texto da variação é lido por extenso ("aumento de 12% em relação ao
 *     período anterior"), porque "▲ 12%" é lido como "12%" e perde o sinal.
 *   - A sparkline é `aria-hidden`: é reforço visual de uma tendência que já
 *     está no número.
 *
 * QUEM USA
 * A aba "Postura atual" do dashboard.
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card, Tooltip } from "../ui";
import { NumeroAnimado } from "../../motion/components";
import { useCoresDoGrafico } from "./chart-shell";
import type { Delta } from "../../types/metrics.types";

export interface KpiCardProps {
  rotulo: string;
  valor: number;
  /** Como escrever o número. Padrão: inteiro em pt-BR. */
  formatar?: (n: number) => string;
  casas?: number;
  /** Variação vinda de `compare=previous`. */
  delta?: Delta;
  /** `true` quando subir é bom (remediação). `false` para risco e abertos. */
  subirEhBom?: boolean;
  /** Série curta para a sparkline. */
  serie?: number[];
  /** Explicação da métrica — vira tooltip no ícone de ajuda. */
  ajuda?: string;
  /** Destaque quando o valor é preocupante. */
  alerta?: boolean;
  icone?: ReactNode;
}

export function KpiCard({
  rotulo,
  valor,
  formatar,
  casas = 0,
  delta,
  subirEhBom = false,
  serie,
  ajuda,
  alerta,
}: KpiCardProps) {
  const cores = useCoresDoGrafico();

  const subiu = delta ? delta.variacao > 0 : false;
  const mudou = delta ? delta.variacao !== 0 : false;
  const bom = subiu === subirEhBom;

  return (
    <Card className={cn("flex flex-col gap-3", alerta && "border-severity-critical")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-fg-muted">{rotulo}</p>
        {ajuda && (
          <Tooltip conteudo={ajuda}>
            <button
              type="button"
              aria-label={`O que é ${rotulo}`}
              className="alvo-estendido shrink-0 rounded-full text-fg-muted transition-colors duration-fast hover:text-fg"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.3 11h1.4v1.4H7.3V11Zm2.4-4.1c0 .9-.5 1.3-1 1.7-.4.3-.6.5-.6 1H6.8c0-.9.4-1.4.9-1.8.4-.3.6-.5.6-.9 0-.5-.4-.8-.9-.8s-.9.3-.9.9H5.2c0-1.3 1-2.1 2.2-2.1s2.3.7 2.3 2Z" />
              </svg>
            </button>
          </Tooltip>
        )}
      </div>

      <p className={cn("text-3xl font-bold", alerta ? "text-severity-critical-ink" : "text-fg")}>
        <NumeroAnimado valor={valor} formatar={formatar} casas={casas} />
      </p>

      <div className="flex items-end justify-between gap-3">
        {delta ? (
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              !mudou ? "text-fg-muted" : bom ? "text-success-ink" : "text-danger-ink",
            )}
          >
            <span aria-hidden="true">{!mudou ? "—" : subiu ? "▲" : "▼"}</span>
            <span aria-hidden="true">
              {delta.variacaoPercentual !== null
                ? `${Math.abs(delta.variacaoPercentual)}%`
                : `${Math.abs(delta.variacao)}`}
            </span>
            {/* Texto por extenso para leitor de tela — a seta não é lida. */}
            <span className="sr-only">
              {!mudou
                ? "sem variação em relação ao período anterior"
                : `${subiu ? "aumento" : "queda"} de ${
                    delta.variacaoPercentual !== null
                      ? `${Math.abs(delta.variacaoPercentual)} por cento`
                      : `${Math.abs(delta.variacao)}`
                  } em relação ao período anterior`}
            </span>
            <span className="font-regular text-fg-muted" aria-hidden="true">
              vs. anterior
            </span>
          </p>
        ) : (
          <span />
        )}

        {serie && serie.length > 1 && (
          <Sparkline valores={serie} cor={bom || !delta ? cores.acento : cores.perigo} />
        )}
      </div>
    </Card>
  );
}

/**
 * Micro-gráfico de tendência, desenhado à mão em SVG.
 *
 * Sem Recharts de propósito: um `ResponsiveContainer` por KPI custaria quatro
 * observers de redimensionamento numa linha de quatro cartões, para desenhar
 * uma polyline de 12 pontos. São 15 linhas de `path`.
 */
function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  const largura = 72;
  const altura = 24;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amplitude = max - min || 1;

  const pontos = valores
    .map((v, i) => {
      const x = (i / (valores.length - 1)) * largura;
      const y = altura - ((v - min) / amplitude) * altura;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true" className="shrink-0 overflow-visible">
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
