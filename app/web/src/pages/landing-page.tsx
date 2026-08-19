/**
 * landing-page.tsx
 *
 * O QUE FAZ
 * Landing pública em "/" — a primeira tela de qualquer visitante (com ou sem
 * sessão). Executa a task 8.12 do `docs/BACKLOG.md`: a cena Three.js
 * (ASCII + aberração cromática + partículas + lâmina wireframe) que
 * `fix/landing-publica` (2026-08-18) deixou como placeholder mínimo,
 * documentando a decisão de NÃO a construir naquela sessão.
 *
 * IDENTIDADE VISUAL — POR QUE ESTA TELA "FOGE" DO DESIGN SYSTEM
 * `docs/DESIGN_SYSTEM.md` é "instrumento, não painel de marketing" — a
 * direção certa para dashboard/findings, usados por horas seguidas. A
 * landing é o oposto: 30 segundos de primeira impressão, material de
 * apresentação da banca. Ver `docs/Vulnera/07-Decisoes/ADR-026...md` para a
 * decisão completa: a raiz força `data-theme="dark"` (subárvore, não o app
 * inteiro) e a paleta "cyber" vive fora de `tokens.css`
 * (`components/landing/landing-palette.ts`), do mesmo jeito que
 * `severity-colors.ts` já existe pra Recharts/pdf-lib. Os componentes
 * REAPROVEITADOS do produto (`Button`, `Card`, `SeverityBadge`) continuam
 * 100% no vocabulário semântico — só o fundo atmosférico e o glitch são
 * exclusivos desta tela.
 *
 * INTRO DE ABERTURA
 * `<BootIntro>` cobre a tela por ~2,5s (pulável, e pulado por completo com
 * `prefers-reduced-motion` ou depois da primeira vez na aba — ver o
 * cabeçalho de `boot-intro.tsx`). Enquanto ativo, o resto da página fica
 * `inert` (mesma lógica de foco dos overlays do design system, aplicada aqui
 * à mão porque `_internal/use-dismiss.ts` é maquinaria de overlay via
 * portal, não API pública desta tela).
 *
 * QUEM CONSOME
 * `App.tsx`, rota "/" — pública, fora do `ProtectedRoute`. Não dispara
 * nenhuma chamada autenticada: um visitante sem sessão nunca pode ser
 * "expulso" daqui por um 401 de fundo (ver `lib/api/client.ts`). O fetch de
 * planos é público (mesmo endpoint sem auth que `plans-page.tsx` usa).
 */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LinkButton, Card, Skeleton, SeverityBadge } from "../components/ui";
import { NumeroAnimado, StaggerItem, StaggerList } from "../motion/components";
import { plansApi } from "../lib/api/plans.api";
import { useAuthStore } from "../store/auth.store";
import { HeroFallback } from "../components/landing/hero-fallback";
import { GlitchText } from "../components/landing/glitch-text";
import { BootIntro } from "../components/landing/boot-intro";
import "../components/landing/landing.css";

/**
 * `three` sozinho pesa ~600kB gzip — carregado direto, entraria no chunk
 * PRINCIPAL da aplicação e toda rota pagaria o download (ver o cabeçalho de
 * `cyber-canvas.tsx`). `lazy()` bota a cena 3D num chunk à parte, buscado só
 * quando "/" é visitada; `HeroFallback` (sem `three`) cobre a tela enquanto
 * ele chega.
 */
const CyberCanvas = lazy(() =>
  import("../components/landing/cyber-canvas").then((m) => ({ default: m.CyberCanvas })),
);

/* ==========================================================================
   Conteúdo — copy institucional (ver docs/Vulnera/01-Contexto/)
   ========================================================================== */

const RECURSOS = [
  {
    titulo: "SAST & DAST estruturados",
    descricao:
      "Escopo de projeto, findings com severidade calculada a partir do vetor CVSS 3.1 e categorização OWASP Top 10 — nada de planilha solta.",
  },
  {
    titulo: "Matriz de maturidade",
    descricao:
      "Checklist por domínio (7 domínios, escala 1–5) com radar comparativo, acompanhando a evolução da postura de segurança da empresa.",
  },
  {
    titulo: "Relatórios executivos e técnicos",
    descricao:
      "PDF gerado 100% client-side: KPIs, top riscos, evidências embutidas e radar de maturidade — sem depender de serviço externo.",
  },
  {
    titulo: "Auditoria & MTTR em tempo real",
    descricao:
      "Toda criação e mudança de severidade fica na trilha de auditoria. MTTR por severidade e aging de abertos calculados continuamente.",
  },
] as const;

/** Achados ilustrativos do mockup de risk score — não são dados de cliente
 * real, é a mesma fórmula que roda em produção aplicada a uma amostra fixa. */
const AMOSTRA_RISK_SCORE = [
  { severidade: "CRITICAL", cvss: 9.8 },
  { severidade: "HIGH", cvss: 7.5 },
  { severidade: "HIGH", cvss: 7.1 },
  { severidade: "MEDIUM", cvss: 5.3 },
  { severidade: "LOW", cvss: 3.1 },
] as const;

/**
 * A MESMA fórmula de `app/api/src/models/metrics.model.ts` (`calcularRiskScore`):
 * soma de `cvss² / 10` por finding aberto, arredondada a 2 casas. Reimplementada
 * aqui porque `app/web` não importa `app/api` — os dois workspaces não
 * compartilham runtime. Se a fórmula da API mudar, esta cópia tem que
 * acompanhar (R5 do CLAUDE.md: código é a verdade, dos dois lados).
 */
function calcularRiskScorePreview(amostra: readonly { cvss: number }[]): number {
  const total = amostra.reduce((acc, { cvss }) => acc + (cvss * cvss) / 10, 0);
  return Math.round(total * 100) / 100;
}

function contarPorSeveridade(amostra: readonly { severidade: string }[]): Record<string, number> {
  return amostra.reduce<Record<string, number>>((acc, { severidade }) => {
    acc[severidade] = (acc[severidade] ?? 0) + 1;
    return acc;
  }, {});
}

function formatarPreco(preco: number): string {
  if (preco <= 0) return "Sob consulta";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Classe LITERAL por severidade — nunca `` `bg-severity-${x}` ``: o Tailwind
 * varre o código-fonte como texto em busca de strings completas, então uma
 * classe montada em runtime não é encontrada e a barra fica sem cor
 * nenhuma no build de produção (o dev server mascara isso porque também
 * varre o texto-fonte, não o valor em runtime — o bug só aparece depois do
 * build, no pior momento pra descobrir). */
const BARRA_SEVERIDADE: Record<string, string> = {
  CRITICAL: "bg-severity-critical",
  HIGH: "bg-severity-high",
  MEDIUM: "bg-severity-medium",
  LOW: "bg-severity-low",
};

/* ==========================================================================
   Página
   ========================================================================== */

export function LandingPage() {
  // Mesmo critério do ProtectedRoute (components/layout/protected-route.tsx)
  // pra decidir se há sessão — as duas fontes de verdade ficam idênticas.
  const estaAutenticado = useAuthStore((s) => Boolean(s.accessToken && s.user));

  // `BootIntro` decide sozinho se roda ou pula (reduced-motion, já visto na
  // sessão) — `introAtivo` só reflete o resultado, pra `inert` do resto da
  // página. Começa `true` (otimista: cobre o "flash" de conteúdo real antes
  // do BootIntro decidir na montagem).
  const [introAtivo, setIntroAtivo] = useState(true);
  const conteudoRef = useRef<HTMLDivElement>(null);

  // `inert` via `setAttribute`, não prop JSX — mesmo mecanismo de
  // `_internal/use-dismiss.ts` (useInertForaDe), que o cabeçalho desta tela
  // documenta não reaproveitar por não ser API pública. Setar direto no DOM
  // evita depender de suporte de `inert` como prop no @types/react em uso.
  useEffect(() => {
    const el = conteudoRef.current;
    if (!el) return;
    if (introAtivo) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [introAtivo]);

  const { data: planos, isLoading: carregandoPlanos } = useQuery({
    queryKey: ["plans"],
    queryFn: plansApi.list,
  });
  const planosOrdenados = [...(planos ?? [])].sort((a, b) => a.maxApplications - b.maxApplications);

  const riskScore = calcularRiskScorePreview(AMOSTRA_RISK_SCORE);
  const porSeveridade = contarPorSeveridade(AMOSTRA_RISK_SCORE);
  const totalAmostra = AMOSTRA_RISK_SCORE.length;

  return (
    // `data-theme="dark"` força o tema escuro NESTA subárvore, independente
    // da preferência salva de quem visita — ver ADR-026 §1. `isolate` cria
    // um novo stacking context: o `CyberCanvas` do hero (position: absolute)
    // não pode vazar atrás/na frente de outra seção por acidente de z-index.
    <div data-theme="dark" className="isolate min-h-dvh bg-canvas text-fg">
      <BootIntro onFinished={() => setIntroAtivo(false)} />

      {/* `inert` enquanto o BootIntro está de pé — ver o `useEffect` acima.
          `ref` num `<div>` só, não em cada seção: `inert` se propaga pra
          toda a subárvore sozinho. */}
      <div ref={conteudoRef}>
        {/* ------------------------------------------------------------------
            Navbar
            ------------------------------------------------------------------ */}
        <header className="sticky top-0 z-sticky border-b border-subtle bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-lg font-bold tracking-tight text-accent-ink">
                <GlitchText text="Vulnera" variante="auto" />
              </Link>
              {/* Chip decorativo de "status" — flavor HUD, não um monitor real
                  (Prometheus/Grafana estão fora do escopo, ver Fora do Escopo.md). */}
              <span className="hidden items-center gap-2 rounded-full border border-subtle bg-surface px-3 py-1 font-mono text-xs text-success-ink sm:inline-flex">
                <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-success" />
                OPERACIONAL // SUÍTE APPSEC
              </span>
            </div>

            <nav aria-label="Seções da página" className="hidden items-center gap-6 text-sm text-fg-secondary md:flex">
              <a href="#recursos" className="press transition-colors duration-fast hover:text-fg">
                Recursos
              </a>
              <a href="#metodologia" className="press transition-colors duration-fast hover:text-fg">
                Metodologia
              </a>
              <a href="#planos" className="press transition-colors duration-fast hover:text-fg">
                Planos
              </a>
            </nav>

            <nav className="flex items-center gap-3" aria-label="Ações de conta">
              {estaAutenticado ? (
                <LinkButton to="/dashboard" variant="primario" size="sm">
                  Ir para o Dashboard
                </LinkButton>
              ) : (
                <>
                  <LinkButton to="/login" variant="secundario" size="sm">
                    Entrar
                  </LinkButton>
                  <LinkButton to="/register" variant="primario" size="sm">
                    Iniciar Análise
                  </LinkButton>
                </>
              )}
            </nav>
          </div>
        </header>

        <main>
          {/* --------------------------------------------------------------
              Hero
              -------------------------------------------------------------- */}
          <section className="relative overflow-hidden">
            <HeroFallback />
            <Suspense fallback={null}>
              <CyberCanvas />
            </Suspense>

            <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:py-24">
              <GlitchText
                as="h1"
                variante="auto"
                text="Encontre. Priorize. Remedie."
                className="text-3xl font-bold uppercase tracking-tight text-fg sm:text-4xl"
              />
              <p className="mx-auto mt-6 max-w-2xl text-base text-fg-secondary">
                O Vulnera unifica achados de SAST e DAST, escopo de projeto, trilha de auditoria e postura de risco
                calculada continuamente — para times de segurança e para os clientes que acompanham o resultado.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {estaAutenticado ? (
                  <LinkButton to="/dashboard" variant="primario" size="lg">
                    Ir para o Dashboard
                  </LinkButton>
                ) : (
                  <>
                    <LinkButton to="/register" variant="primario" size="lg">
                      Iniciar Análise
                    </LinkButton>
                    <LinkButton to="/login" variant="secundario" size="lg">
                      Explorar Demonstração
                    </LinkButton>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------------
              Recursos
              -------------------------------------------------------------- */}
          <section id="recursos" className="mx-auto max-w-6xl px-4 py-20">
            <header className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-bold text-fg sm:text-2xl">Uma suíte, do achado ao relatório</h2>
              <p className="mt-3 text-sm text-fg-muted">
                Cada peça abaixo já roda em produção no Vulnera — não é roadmap.
              </p>
            </header>

            <StaggerList className="mt-10 grid gap-6 sm:grid-cols-2">
              {RECURSOS.map((recurso, i) => (
                <StaggerItem key={recurso.titulo} indice={i}>
                  <Card titulo={recurso.titulo} className="glitch-hover h-full">
                    <p className="text-sm text-fg-secondary">{recurso.descricao}</p>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerList>
          </section>

          {/* --------------------------------------------------------------
              Metodologia — preview interativo de risk score
              -------------------------------------------------------------- */}
          <section id="metodologia" className="border-y border-subtle bg-surface/40 px-4 py-20">
            <div className="mx-auto max-w-4xl">
              <header className="mx-auto max-w-2xl text-center">
                <h2 className="text-xl font-bold text-fg sm:text-2xl">Postura de risco, calculada — não estimada</h2>
                <p className="mt-3 text-sm text-fg-muted">
                  A mesma fórmula que roda no dashboard: cada finding aberto contribui com{" "}
                  <code className="font-mono text-fg-secondary">CVSS² ÷ 10</code>. Amostra abaixo, não dado de cliente.
                </p>
              </header>

              <Card className="mt-10" semPadding>
                <div className="grid gap-8 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="text-center sm:text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Risk score</p>
                    <p className="mt-1 text-4xl font-bold text-accent-ink">
                      <NumeroAnimado valor={riskScore} casas={2} />
                    </p>
                    <p className="mt-1 text-xs text-fg-muted">{totalAmostra} findings nesta amostra</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((severidade) => {
                      const contagem = porSeveridade[severidade] ?? 0;
                      const largura = totalAmostra > 0 ? (contagem / totalAmostra) * 100 : 0;
                      const destacar = severidade === "CRITICAL" || severidade === "HIGH";
                      return (
                        <div key={severidade} className="flex items-center gap-3">
                          <span className={destacar ? "glitch-hover" : undefined}>
                            <SeverityBadge severidade={severidade} className="w-24 shrink-0 justify-center" />
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-inset">
                            <div
                              className={`h-full rounded-full ${BARRA_SEVERIDADE[severidade]}`}
                              style={{ width: `${largura}%` }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right text-xs text-fg-muted" data-numeric>
                            {contagem}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* --------------------------------------------------------------
              Planos
              -------------------------------------------------------------- */}
          <section id="planos" className="mx-auto max-w-6xl px-4 py-20">
            <header className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-bold text-fg sm:text-2xl">Planos</h2>
              <p className="mt-3 text-sm text-fg-muted">
                Do time enxerga o primeiro pentest até a operação com múltiplos squads.
              </p>
            </header>

            <div className="mx-auto mt-10 max-w-5xl">
              {carregandoPlanos && (
                <div className="grid gap-6 sm:grid-cols-3" aria-busy="true">
                  <span className="sr-only">Carregando planos</span>
                  {/* A FORMA do card real (título, preço, 3 linhas, botão) —
                      não um bloco único. `h-64` não existiria na escala custom
                      de espaçamento deste projeto (o maior passo nomeado é
                      `24` = 96px; ver tailwind.config.ts), e mesmo se existisse
                      um retângulo só "pula" mais quando troca pelo card real
                      do que um esqueleto com a mesma silhueta. */}
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-4 rounded-container border border-subtle bg-surface p-6">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-8 w-24" />
                      <div className="flex flex-col gap-2 pt-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                      <Skeleton className="mt-4 h-10 w-full" />
                    </div>
                  ))}
                </div>
              )}

              {!carregandoPlanos && planosOrdenados.length > 0 && (
                <StaggerList className="grid gap-6 sm:grid-cols-3">
                  {planosOrdenados.map((plano, i) => (
                    <StaggerItem key={plano.id} indice={i}>
                      <Card className="glitch-hover flex h-full flex-col">
                        <h3 className="text-sm font-semibold uppercase text-accent-ink">{plano.name}</h3>
                        <p className="mt-1 text-2xl font-bold text-fg" data-numeric>
                          {formatarPreco(plano.price)}
                          {plano.price > 0 && <span className="text-sm font-regular text-fg-muted">/mês</span>}
                        </p>

                        <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm text-fg-secondary">
                          <li>
                            Até <strong className="font-semibold text-fg">{plano.maxApplications}</strong> aplicações
                          </li>
                          <li>
                            Até <strong className="font-semibold text-fg">{plano.maxProjects}</strong> projetos
                            simultâneos
                          </li>
                          <li>{plano.includesRemediation ? "Remediação incluída" : "Sem remediação incluída"}</li>
                        </ul>

                        <Link
                          to="/register"
                          className="press mt-6 inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg shadow-raised transition-colors duration-fast hover:bg-accent-hover"
                        >
                          Começar com {plano.name}
                        </Link>
                      </Card>
                    </StaggerItem>
                  ))}
                </StaggerList>
              )}
            </div>
          </section>
        </main>

        {/* ------------------------------------------------------------------
            Footer
            ------------------------------------------------------------------ */}
        <footer className="border-t border-subtle px-4 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-xs text-fg-muted sm:flex-row sm:justify-between sm:text-left">
            <p>Vulnera — projeto acadêmico de TCC. Não executa ataques reais; gestão do serviço de consultoria.</p>
            {/* Sem link "Entrar" aqui: a navbar já mostra a ação certa pro
                estado de sessão (Entrar/Iniciar Análise OU Dashboard), e um
                segundo "Entrar" fixo no rodapé ignoraria esse mesmo estado —
                apareceria até pra quem já está logado. */}
            <nav aria-label="Links do rodapé" className="flex items-center gap-4">
              <Link to="/plans" className="press hover:text-fg-secondary">
                Planos
              </Link>
              <span className="inline-flex items-center gap-2 font-mono">
                <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-success" />
                status: operacional
              </span>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
