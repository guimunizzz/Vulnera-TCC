/**
 * landing-page.tsx
 *
 * O QUE FAZ
 * Landing pública em "/" — a primeira tela que qualquer visitante (com ou sem
 * sessão) vê ao abrir o Vulnera. Pitch curto do produto + navegação de
 * entrada (login/dashboard e cadastro).
 *
 * POR QUE EXISTE (fix/landing-publica)
 * Antes desta task, "/" redirecionava incondicionalmente para "/dashboard"
 * (App.tsx) — que por sua vez esbarrava no `ProtectedRoute` e jogava qualquer
 * visitante sem sessão para "/login". A banca nunca via uma landing pública
 * porque nenhuma existia: KAN-110 (`PRD_VIVO.md`) sempre esteve pendente, e a
 * auditoria do Checkpoint 0 confirmou que a landing "cena Three.js com efeito
 * ASCII e samurai procedural" descrita na issue original nunca foi
 * implementada neste repositório, em nenhum formato — nem componente React,
 * nem HTML standalone à espera de portabilidade. Não há nada para portar.
 *
 * Por decisão do Rafael (2026-08-18), este arquivo é o placeholder MÍNIMO que
 * corrige a rota agora, sem inventar a cena 3D nesta sessão: reaproveita os
 * mesmos componentes/tokens do design system usados em `plans-page.tsx` e
 * `login-page.tsx`. A landing "cena Three.js" completa vira item novo no
 * `docs/BACKLOG.md`, fora do escopo deste fix.
 *
 * QUEM CONSOME
 * `App.tsx`, rota "/" — pública, fora do `ProtectedRoute`. Não dispara
 * nenhuma chamada autenticada: um visitante sem sessão nunca pode ser
 * "expulso" daqui por um 401 de fundo (ver `lib/api/client.ts`).
 */

import { Link } from "react-router-dom";
import { LinkButton, Card } from "../components/ui";
import { useAuthStore } from "../store/auth.store";
import { StaggerItem, StaggerList } from "../motion/components";

const RECURSOS = [
  {
    titulo: "Findings com CVSS calculado",
    descricao:
      "Cada vulnerabilidade herda a severidade calculada a partir do vetor CVSS 3.1, com override justificado e sempre auditado.",
  },
  {
    titulo: "Relatórios executivos e técnicos",
    descricao:
      "PDFs gerados a partir dos dados reais do projeto: KPIs, top riscos, evidências embutidas e maturidade de segurança.",
  },
  {
    titulo: "Maturidade de segurança",
    descricao:
      "Avaliação por domínio com radar comparativo, acompanhando a evolução da postura de segurança da empresa ao longo do tempo.",
  },
];

export function LandingPage() {
  // Presença de token + usuário no Zustand é o mesmo critério usado pelo
  // ProtectedRoute (components/layout/protected-route.tsx) para decidir se há
  // sessão — mantém as duas fontes de verdade idênticas.
  const estaAutenticado = useAuthStore((s) => Boolean(s.accessToken && s.user));

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-subtle">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-accent-ink">
            Vulnera
          </Link>

          {/* Navbar mínima: sem links de seção pra esconder em tela estreita,
              então o botão de entrada fica sempre visível — nenhum menu extra
              é necessário nos breakpoints pedidos (375/768/1440). */}
          <nav className="flex items-center gap-3" aria-label="Ações de conta">
            {estaAutenticado ? (
              // Com sessão: um único botão preenchido, sem "Entrar" concorrendo.
              <LinkButton to="/dashboard" variant="primario" size="sm">
                Ir para o Dashboard
              </LinkButton>
            ) : (
              <>
                {/* Secundário (contorno) — não compete com a conversão. */}
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
        <section className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-fg">
            Gestão de análises de segurança, do achado ao relatório.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-fg-muted">
            O Vulnera centraliza pentests, findings com severidade calculada, evidências
            e relatórios executivos e técnicos em um único fluxo — para times de
            segurança e para os clientes que acompanham o resultado.
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
                <LinkButton to="/plans" variant="secundario" size="lg">
                  Ver planos
                </LinkButton>
              </>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-24">
          <StaggerList className="grid gap-6 md:grid-cols-3">
            {RECURSOS.map((recurso, i) => (
              <StaggerItem key={recurso.titulo} indice={i}>
                <Card titulo={recurso.titulo} className="h-full">
                  <p className="text-sm text-fg-secondary">{recurso.descricao}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>
        </section>
      </main>

      <footer className="border-t border-subtle px-4 py-6 text-center text-xs text-fg-muted">
        Vulnera — projeto acadêmico de TCC.
      </footer>
    </div>
  );
}
