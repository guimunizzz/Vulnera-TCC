/**
 * landing-page.tsx
 *
 * O QUE FAZ
 * Landing pública em "/" — a primeira tela de qualquer visitante (com ou sem
 * sessão). Cena de abertura 3D + seções de apresentação (hero, problema, como
 * funciona, recursos, comparativo, demo, maturidade, planos, FAQ, time, CTA).
 *
 * IDENTIDADE VISUAL — POR QUE ESTA TELA "FOGE" DO DESIGN SYSTEM
 * `docs/DESIGN_SYSTEM.md` é "instrumento, não painel de marketing" — a direção
 * certa para dashboard/findings, usados por horas seguidas. A landing é o
 * oposto: 30 segundos de primeira impressão, material de apresentação da banca
 * (ADR-026). A paleta "cyber" (`--vx-*`) vive escopada em `.vx-landing` dentro
 * de `components/landing/landing.css`, fora de `tokens.css` — do mesmo jeito
 * que `severity-colors.ts` já vive fora dele para o Recharts. O tema
 * claro/escuro continua vindo do `ThemeProvider` do app (a landing só troca a
 * paleta, não o mecanismo).
 *
 * QUEM CONSOME
 * `App.tsx`, rota "/" — pública, fora do `ProtectedRoute`. Não dispara nenhuma
 * chamada autenticada: um visitante sem sessão nunca é "expulso" daqui por um
 * 401 de fundo. Os planos exibidos são conteúdo fixo desta branch (ver o TODO
 * em `components/landing/sections/pricing.tsx`).
 *
 * PESO
 * `three` + `@react-three/*` + `gsap` + `framer` + as 11 seções entrariam no
 * chunk PRINCIPAL do app se importados direto — toda rota pagaria o download.
 * `lazy()` põe a landing inteira num chunk à parte, buscado só quando "/" é
 * visitada. O CSS da paleta é carregado aqui (eager, ~4 kB) para o fallback
 * já aparecer no tom certo.
 */

import { lazy, Suspense } from "react";
import "../components/landing/landing.css";

const LandingRoot = lazy(() => import("../components/landing/landing-root"));

export function LandingPage() {
  return (
    <div data-testid="landing" className="vx-landing min-h-dvh">
      <Suspense fallback={<div className="min-h-dvh bg-[var(--vx-bg)]" aria-hidden="true" />}>
        <LandingRoot />
      </Suspense>
    </div>
  );
}
