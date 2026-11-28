/**
 * app-layout.tsx
 *
 * O QUE FAZ
 * A moldura das telas autenticadas com navegação lateral, barra superior e
 * conteúdo. Onboarding e relatório DAST usam somente AuthenticatedLayout,
 * que também mantém a instância do assistente fora das transições de página.
 *
 * O QUE MUDOU NA FASE 6.5
 * - Navegação vira `Drawer` abaixo de `lg` — antes a sidebar de 224px roubava
 *   metade da tela em 375px.
 * - Link "pular para o conteúdo": quem navega por Tab não precisa mais
 *   atravessar a navegação inteira em toda página.
 * - `<main id="conteudo">` com landmarks nomeadas.
 * - Transição de rota por crossfade curto (CP3).
 * - Seletor de tema na barra superior.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - Landmarks: `<nav aria-label="Navegação principal">`, `<main>`,
 *     `<header>`. É como quem usa leitor de tela pula direto ao conteúdo.
 *   - O link de pulo é o PRIMEIRO elemento focável do documento.
 *   - O botão que abre a navegação em telas estreitas tem `aria-expanded` e
 *     `aria-controls`.
 *
 * QUEM USA
 * `App.tsx`, dentro do contêiner autenticado compartilhado.
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Button, Drawer, DrawerBody, DrawerHeader, DropdownMenu, Avatar } from "../ui";
import { ThemeToggle } from "../../design/theme-toggle";
import { NotificationBell } from "../notifications/notification-bell";
import { AccessibilityMenu } from "../../design/accessibility-menu";
import { TransicaoDeRota } from "../../motion/components";
import { useAuthStore } from "../../store/auth.store";
import { authApi } from "../../lib/api/auth.api";
import { AtmosferaDaPlataforma } from "../../features/atmosfera-3d/atmosfera-da-plataforma";
import { ID_DA_AREA_DE_CONTEUDO } from "../../features/atmosfera-3d/apresentacao";
import { AmbientHostContext } from "../dashboard/hero/ambient-host-context";
import { QueryLoadingIndicator } from "./query-loading-indicator";
import { PaletaDeComandos } from "./paleta-de-comandos";
import { Search } from "lucide-react";
import { LimiteDeRota } from "./route-boundary";
import "./operations-backdrop.css";
import "./module-surfaces.css";

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  CLIENT: "Cliente",
  PENTESTER: "Analista",
};

const ROTULO_EMPRESARIAL: Record<string, string | undefined> = { OWNER: "Responsável", MEMBER: "Membro" };

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const companyRoleLabel = user?.role === "CLIENT" ? ROTULO_EMPRESARIAL[user.companyRole ?? ""] : undefined;
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();
  // A saída animada mantém o conteúdo e o contexto da rota anterior;
  // a próxima tela começa suas consultas somente quando entra.
  const outlet = useOutlet();
  const [navAberta, setNavAberta] = useState(false);
  // Paleta de comandos (ADR-062): Ctrl+K de qualquer tela, ou o botão "Buscar".
  const [paletaAberta, setPaletaAberta] = useState(false);
  const [ambientePausado, setAmbientePausado] = useState(false);

  useEffect(() => {
    const atualizar = (event: Event) => setAmbientePausado((event as CustomEvent<boolean>).detail);
    window.addEventListener("vulnera:ambient-pause", atualizar);
    return () => window.removeEventListener("vulnera:ambient-pause", atualizar);
  }, []);

  async function sair(): Promise<void> {
    const sessionVersion = useAuthStore.getState().sessionVersion;
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // mesmo se a chamada falhar, o estado local é limpo do mesmo jeito
      }
    }
    if (useAuthStore.getState().sessionVersion !== sessionVersion) return;
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Primeiro focável do documento — ver `.skip-link` em base.css. */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      {/* Navegação fixa a partir de lg; abaixo disso vira drawer. */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <Drawer aberto={navAberta} aoFechar={() => setNavAberta(false)} lado="esquerda">
        <DrawerHeader>Navegação</DrawerHeader>
        <DrawerBody className="px-2">
          <Sidebar aoNavegar={() => setNavAberta(false)} embutida />
        </DrawerBody>
      </Drawer>

      <PaletaDeComandos aberta={paletaAberta} aoMudar={setPaletaAberta} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Gaps menores abaixo de sm: a 375px os seis controles passavam 4px da tela em todas as páginas (WEB-FUT-08). */}
        <header className="sticky top-0 z-sticky flex h-16 items-center justify-between gap-2 border-b border-subtle bg-canvas px-4 sm:gap-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="fantasma"
              size="sm"
              rotulo="Abrir navegação"
              className="lg:hidden"
              aria-expanded={navAberta}
              aria-controls="navegacao-principal"
              onClick={() => setNavAberta(true)}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </Button>
            {/* Abaixo de sm a marca sai do topo: com o sino (ADR-053) os controles não cabiam em 375 px. */}
            <span className="hidden font-semibold text-fg sm:inline lg:hidden">Vulnera</span>
            <QueryLoadingIndicator />
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              variant="fantasma"
              size="sm"
              rotulo="Buscar ou executar um comando (Ctrl+K)"
              onClick={() => setPaletaAberta(true)}
              className="gap-2"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <kbd className="hidden rounded border border-subtle bg-inset px-[0.375rem] font-mono text-[11px] text-fg-muted md:inline">Ctrl K</kbd>
            </Button>
            <NotificationBell />
            <AccessibilityMenu />
            <ThemeToggle compacto />
            <DropdownMenu
              rotulo="Conta"
              gatilho={
                <Button variant="fantasma" size="sm" className="gap-2">
                  <Avatar nome={user?.name ?? "?"} tamanho="sm" />
                  <span className="hidden text-left sm:flex sm:flex-col">
                    <span className="text-sm text-fg">{user?.name}</span>
                    <span className="text-xs text-fg-muted">
                      {ROTULO_PAPEL[user?.role ?? ""] ?? user?.role}
                      {companyRoleLabel && ` · ${companyRoleLabel}`}
                    </span>
                  </span>
                </Button>
              }
              itens={[{ id: "sair", rotulo: "Sair", destrutivo: true, aoEscolher: sair }]}
            />
          </div>
        </header>

        <main id={ID_DA_AREA_DE_CONTEUDO} tabIndex={-1} className="operations-main relative isolate flex-1 p-4 focus-visible:outline-none lg:p-6">
          <div aria-hidden="true" className="operations-backdrop pointer-events-none absolute inset-0" />
          {/* A atmosfera depende da seção (nebulosa, relevo, ASCII ou nada) — ver features/atmosfera-3d/rotas.ts. */}
          <AtmosferaDaPlataforma pausado={ambientePausado} />
          {/* A chave é o caminho: o crossfade dispara na troca de rota, não a
              cada re-render da mesma rota. */}
          <div className="operations-content relative">
            <AmbientHostContext.Provider value={true}>
              <TransicaoDeRota chave={location.pathname}>
                {/* Dentro da transição: cada rota tem o próprio limite, a saída
                    continua mostrando a página anterior já carregada e só a área
                    de conteúdo espera o chunk — sidebar e cabeçalho ficam. */}
                <LimiteDeRota variante="conteudo">{outlet}</LimiteDeRota>
              </TransicaoDeRota>
            </AmbientHostContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
