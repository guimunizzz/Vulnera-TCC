/**
 * charts.tsx
 *
 * O QUE FAZ
 * Os gráficos do dashboard analítico: donut de severidade, aging, burndown,
 * criados × resolvidos e risk score no tempo.
 *
 * POR QUE NUM ARQUIVO SÓ
 * Os cinco compartilham a mesma moldura (`ChartShell`), a mesma paleta
 * (`useCoresDoGrafico`), o mesmo tooltip e a mesma regra de tela estreita.
 * Separados, o import de cada um seria maior que o próprio componente e a
 * primeira mudança de eixo teria que ser replicada cinco vezes.
 *
 * FILTRAGEM CRUZADA
 * Donut e aging recebem `aoSelecionar`: clicar numa fatia ou numa barra aplica
 * aquele recorte ao painel inteiro (CP6). É o que transforma o dashboard de
 * relatório em ferramenta.
 *
 * MOVIMENTO
 * O desenho progressivo roda UMA VEZ (`useDesenhoInicial`). Sem isso, o
 * Recharts reanima a cada re-render, e com filtros isso significa a linha se
 * redesenhando inteira a cada tecla digitada na busca.
 *
 * QUEM USA
 * `application-dashboard-page.tsx`.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ROTULO_SEVERIDADE, type Severidade } from "../ui";
import { useDesenhoInicial } from "../../motion/components";
import {
  ChartShell,
  ListaEmVezDeGrafico,
  TooltipDoGrafico,
  useCoresDoGrafico,
  useTelaEstreita,
  type CoresDoGrafico,
} from "./chart-shell";
import type { Aging, ContagemPorChave, PontoDaSerie } from "../../types/metrics.types";

const ORDEM_SEVERIDADE: Severidade[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];

/** Eixos com os mesmos valores em todos os gráficos — nunca repetidos à mão. */
function propsDeEixo(cores: CoresDoGrafico) {
  return {
    stroke: cores.eixo,
    fontSize: 11,
    tickLine: false,
    axisLine: { stroke: cores.grade },
  };
}

/** Rótulo curto de período para o eixo X. */
function rotuloDePeriodo(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

interface BaseProps {
  carregando?: boolean;
  erro?: boolean;
  aoTentarNovamente?: () => void;
}

/* ==========================================================================
   1. Donut de severidade
   ========================================================================== */

export function DonutDeSeveridade({
  porSeveridade,
  aoSelecionar,
  severidadeSelecionada,
  ...base
}: BaseProps & {
  porSeveridade: ContagemPorChave;
  aoSelecionar?: (severidade: string) => void;
  severidadeSelecionada?: string;
}) {
  const cores = useCoresDoGrafico();
  const estreita = useTelaEstreita();

  const dados = useMemo(
    () =>
      ORDEM_SEVERIDADE.map((s) => ({ chave: s, nome: ROTULO_SEVERIDADE[s], valor: porSeveridade[s] ?? 0 })).filter(
        (d) => d.valor > 0,
      ),
    [porSeveridade],
  );
  const total = dados.reduce((a, d) => a + d.valor, 0);
  const { animar, duracaoMs } = useDesenhoInicial(dados.length > 0);

  return (
    <ChartShell
      titulo="Distribuição por severidade"
      descricao={aoSelecionar ? "Clique numa fatia para filtrar o painel." : undefined}
      vazio={dados.length === 0}
      tituloVazio="Nenhum finding aberto"
      descricaoVazio="Não há findings em aberto no período e nos filtros selecionados."
      altura={240}
      {...base}
    >
      {estreita ? (
        // Em 375px o donut fica com 120px de diâmetro e a legenda não cabe —
        // a lista diz a mesma coisa e continua legível.
        <ListaEmVezDeGrafico
          itens={dados.map((d) => ({ rotulo: d.nome, valor: d.valor, cor: cores.severidade[d.chave] }))}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="h-52 w-52 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius={54}
                  outerRadius={86}
                  paddingAngle={2}
                  isAnimationActive={animar}
                  animationDuration={duracaoMs}
                  // O Recharts tipa o handler com `PieSectorDataItem`, que não
                  // conhece os campos do NOSSO dado — mas em tempo de execução
                  // o objeto recebido é o item que passamos em `data`. Daí a
                  // asserção pontual, em vez de espalhar `any`.
                  onClick={(d) => {
                    const item = d as unknown as { chave?: string };
                    if (item.chave) aoSelecionar?.(item.chave);
                  }}
                >
                  {dados.map((d) => (
                    <Cell
                      key={d.chave}
                      fill={cores.severidade[d.chave]}
                      stroke="none"
                      // A fatia selecionada mantém opacidade cheia; as demais
                      // recuam. Selecionar sem sinal visual é o mesmo que não
                      // selecionar.
                      opacity={!severidadeSelecionada || severidadeSelecionada === d.chave ? 1 : 0.35}
                      cursor={aoSelecionar ? "pointer" : undefined}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ payload }) =>
                    payload?.[0] ? (
                      <TooltipDoGrafico
                        titulo={String(payload[0].name)}
                        itens={[
                          {
                            nome: "Findings abertos",
                            valor: Number(payload[0].value),
                            cor: cores.severidade[(payload[0].payload as { chave: string }).chave],
                          },
                        ]}
                        total={total}
                        cores={cores}
                      />
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda é <ul> de verdade, e cada item é botão quando há filtro —
              uma legenda clicável precisa ser alcançável por teclado. */}
          <ul className="flex flex-col gap-2 text-sm">
            {dados.map((d) => (
              <li key={d.chave}>
                <button
                  type="button"
                  disabled={!aoSelecionar}
                  onClick={() => aoSelecionar?.(d.chave)}
                  aria-pressed={severidadeSelecionada === d.chave}
                  className="flex items-center gap-2 rounded-control px-1 py-1 transition-colors duration-fast hover:bg-hovered disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: cores.severidade[d.chave] }} />
                  <span className="text-fg">{d.nome}</span>
                  <span className="font-mono text-fg-muted" data-numeric>
                    {d.valor} ({Math.round((d.valor / total) * 100)}%)
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartShell>
  );
}

/* ==========================================================================
   2. Aging — a dívida de segurança
   ========================================================================== */

const FAIXAS_AGING: { chave: keyof Aging; rotulo: string; dias: number }[] = [
  { chave: "ate7Dias", rotulo: "< 7 dias", dias: 0 },
  { chave: "de7A30Dias", rotulo: "7–30 dias", dias: 7 },
  { chave: "de30A90Dias", rotulo: "30–90 dias", dias: 30 },
  { chave: "mais90Dias", rotulo: "> 90 dias", dias: 90 },
];

export function GraficoDeAging({
  aging,
  aoSelecionar,
  ...base
}: BaseProps & { aging: Aging; aoSelecionar?: (diasMinimos: number) => void }) {
  const cores = useCoresDoGrafico();
  const dados = FAIXAS_AGING.map((f) => ({ ...f, valor: aging[f.chave] }));
  const total = dados.reduce((a, d) => a + d.valor, 0);
  const { animar, duracaoMs } = useDesenhoInicial(total > 0);

  /**
   * A cor SOBE com a idade — verde para o recente, vermelho para o antigo.
   * O sentido é deliberado: idade É risco nesta métrica, e usar a mesma escala
   * de severidade faz o olho ler "> 90 dias" com o mesmo peso de "crítico",
   * que é exatamente a mensagem.
   */
  const corDaFaixa = [cores.sucesso, cores.severidade.MEDIUM, cores.severidade.HIGH, cores.severidade.CRITICAL];

  return (
    <ChartShell
      titulo="Idade dos findings abertos"
      descricao="Dívida de segurança por faixa de tempo em aberto. Clique numa barra para filtrar."
      vazio={total === 0}
      tituloVazio="Nenhum finding em aberto"
      descricaoVazio="Toda a dívida do período foi remediada."
      altura={240}
      {...base}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid horizontal={false} stroke={cores.grade} />
          <XAxis type="number" {...propsDeEixo(cores)} allowDecimals={false} label={{ value: "Findings", position: "insideBottom", offset: -4, fill: cores.eixo, fontSize: 11 }} />
          <YAxis type="category" dataKey="rotulo" width={80} {...propsDeEixo(cores)} />
          <Tooltip
            cursor={{ fill: cores.grade, opacity: 0.4 }}
            content={({ payload, label }) =>
              payload?.[0] ? (
                <TooltipDoGrafico
                  titulo={`Abertos há ${label}`}
                  itens={[{ nome: "Findings", valor: Number(payload[0].value), cor: String(payload[0].color) }]}
                  total={total}
                  cores={cores}
                />
              ) : null
            }
          />
          <Bar
            dataKey="valor"
            radius={[0, 4, 4, 0]}
            isAnimationActive={animar}
            animationDuration={duracaoMs}
            // Mesma razão do donut: o tipo do Recharts não descreve o payload.
            onClick={(d) => {
              const item = d as unknown as { dias?: number };
              if (item.dias !== undefined) aoSelecionar?.(item.dias);
            }}
            cursor={aoSelecionar ? "pointer" : undefined}
          >
            {dados.map((d, i) => (
              <Cell key={d.chave} fill={corDaFaixa[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* ==========================================================================
   3. Burndown — abertos acumulados
   ========================================================================== */

export function GraficoDeBurndown({ pontos, ...base }: BaseProps & { pontos: PontoDaSerie[] }) {
  const cores = useCoresDoGrafico();
  const temDados = pontos.some((p) => p.abertosAcumulados > 0 || p.criados > 0);
  const { animar, duracaoMs } = useDesenhoInicial(temDados);

  return (
    <ChartShell
      titulo="Findings em aberto ao longo do tempo"
      descricao="A linha que responde se a postura está melhorando ou piorando."
      vazio={!temDados}
      altura={280}
      {...base}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={pontos} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="grad-burndown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cores.acento} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cores.acento} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={cores.grade} />
          <XAxis dataKey="periodo" tickFormatter={rotuloDePeriodo} {...propsDeEixo(cores)} minTickGap={24} />
          <YAxis {...propsDeEixo(cores)} allowDecimals={false} width={36} />
          <Tooltip
            content={({ payload, label }) =>
              payload?.[0] ? (
                <TooltipDoGrafico
                  titulo={String(label)}
                  itens={[
                    { nome: "Em aberto", valor: Number(payload[0].value), cor: cores.acento },
                    { nome: "Criados no período", valor: (payload[0].payload as PontoDaSerie).criados, cor: cores.severidade.HIGH },
                    { nome: "Resolvidos no período", valor: (payload[0].payload as PontoDaSerie).resolvidos, cor: cores.sucesso },
                  ]}
                  sufixo=""
                  cores={cores}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="abertosAcumulados"
            name="Em aberto"
            stroke={cores.acento}
            strokeWidth={2}
            fill="url(#grad-burndown)"
            isAnimationActive={animar}
            animationDuration={duracaoMs}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* ==========================================================================
   4. Criados × resolvidos — barras divergentes
   ========================================================================== */

export function GraficoCriadosVersusResolvidos({ pontos, ...base }: BaseProps & { pontos: PontoDaSerie[] }) {
  const cores = useCoresDoGrafico();
  // Resolvidos vão NEGATIVOS para o eixo — é o que produz o espelhamento em
  // torno do zero e faz "está entrando mais do que sai?" ser respondido de
  // relance, sem comparar alturas de barras lado a lado.
  const dados = useMemo(() => pontos.map((p) => ({ ...p, resolvidosNegativo: -p.resolvidos })), [pontos]);
  const temDados = pontos.some((p) => p.criados > 0 || p.resolvidos > 0);
  const { animar, duracaoMs } = useDesenhoInicial(temDados);

  return (
    <ChartShell titulo="Criados × resolvidos" descricao="Acima do eixo, findings que entraram; abaixo, os que saíram." vazio={!temDados} altura={280} {...base}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dados} stackOffset="sign" margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke={cores.grade} />
          <XAxis dataKey="periodo" tickFormatter={rotuloDePeriodo} {...propsDeEixo(cores)} minTickGap={24} />
          <YAxis {...propsDeEixo(cores)} allowDecimals={false} width={36} tickFormatter={(v: number) => String(Math.abs(v))} />
          <ReferenceLine y={0} stroke={cores.eixo} />
          <Tooltip
            cursor={{ fill: cores.grade, opacity: 0.4 }}
            content={({ payload, label }) =>
              payload?.length ? (
                <TooltipDoGrafico
                  titulo={String(label)}
                  itens={[
                    { nome: "Criados", valor: (payload[0].payload as PontoDaSerie).criados, cor: cores.severidade.HIGH },
                    { nome: "Resolvidos", valor: (payload[0].payload as PontoDaSerie).resolvidos, cor: cores.sucesso },
                  ]}
                  cores={cores}
                />
              ) : null
            }
          />
          <Bar dataKey="criados" name="Criados" fill={cores.severidade.HIGH} radius={[4, 4, 0, 0]} isAnimationActive={animar} animationDuration={duracaoMs} />
          <Bar dataKey="resolvidosNegativo" name="Resolvidos" fill={cores.sucesso} radius={[0, 0, 4, 4]} isAnimationActive={animar} animationDuration={duracaoMs} />
        </BarChart>
      </ResponsiveContainer>
      <ul className="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: cores.severidade.HIGH }} /> Criados
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: cores.sucesso }} /> Resolvidos
        </li>
      </ul>
    </ChartShell>
  );
}

/* ==========================================================================
   5. Risk score no tempo
   ========================================================================== */

export function GraficoDeRiskScore({
  pontos,
  referencia,
  ...base
}: BaseProps & { pontos: PontoDaSerie[]; referencia?: number }) {
  const cores = useCoresDoGrafico();
  const temDados = pontos.some((p) => p.riskScore > 0);
  const { animar, duracaoMs } = useDesenhoInicial(temDados);

  return (
    <ChartShell
      titulo="Risk score ao longo do tempo"
      descricao="Soma ponderada por CVSS dos findings em aberto. A faixa é a média do período."
      vazio={!temDados}
      altura={240}
      {...base}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={pontos} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke={cores.grade} />
          <XAxis dataKey="periodo" tickFormatter={rotuloDePeriodo} {...propsDeEixo(cores)} minTickGap={24} />
          <YAxis {...propsDeEixo(cores)} width={44} />
          {referencia !== undefined && (
            // Uma linha sem referência não diz se 212 é bom ou ruim. A média do
            // próprio período é a referência mais honesta disponível — não há
            // benchmark de indústria para uma métrica interna.
            <ReferenceLine
              y={referencia}
              stroke={cores.textoAtenuado}
              strokeDasharray="4 4"
              label={{ value: "média", position: "right", fill: cores.textoAtenuado, fontSize: 11 }}
            />
          )}
          <Tooltip
            content={({ payload, label }) =>
              payload?.[0] ? (
                <TooltipDoGrafico
                  titulo={String(label)}
                  itens={[{ nome: "Risk score", valor: Math.round(Number(payload[0].value) * 10) / 10, cor: cores.serie[0] ?? cores.acento }]}
                  sufixo=" pts"
                  cores={cores}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="riskScore"
            name="Risk score"
            stroke={cores.serie[0] ?? cores.acento}
            strokeWidth={2}
            dot={false}
            isAnimationActive={animar}
            animationDuration={duracaoMs}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
