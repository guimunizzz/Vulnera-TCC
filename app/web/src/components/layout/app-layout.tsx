/**
 * app-layout.tsx
 *
 * O QUE FAZ
 * A moldura de toda tela autenticada: navegação lateral, barra superior com
 * usuário e tema, e a área de conteúdo.
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
 * `App.tsx`, envolvendo todas as rotas autenticadas.
 */

import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Button, Drawer, DrawerBody, DrawerHeader, DropdownMenu, Avatar } from "../ui";
import { ThemeToggle } from "../../design/theme-toggle";
import { TransicaoDeRota } from "../../motion/components";
import { useAuthStore } from "../../store/auth.store";
import { authApi } from "../../lib/api/auth.api";

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  CLIENT: "Cliente",
  PENTESTER: "Analista",
};

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const [navAberta, setNavAberta] = useState(false);

  async function sair(): Promise<void> {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // mesmo se a chamada falhar, o estado local é limpo do mesmo jeito
      }
    }
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex h-16 items-center justify-between gap-4 border-b border-subtle bg-canvas px-4 lg:px-6">
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
            <span className="font-semibold text-fg lg:hidden">Vulnera</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle compacto />
            <DropdownMenu
              rotulo="Conta"
              gatilho={
                <Button variant="fantasma" size="sm" className="gap-2">
                  <Avatar nome={user?.name ?? "?"} tamanho="sm" />
                  <span className="hidden text-left sm:flex sm:flex-col">
                    <span className="text-sm text-fg">{user?.name}</span>
                    <span className="text-xs text-fg-muted">{ROTULO_PAPEL[user?.role ?? ""] ?? user?.role}</span>
                  </span>
                </Button>
              }
              itens={[{ id: "sair", rotulo: "Sair", destrutivo: true, aoEscolher: sair }]}
            />
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="flex-1 p-4 focus-visible:outline-none lg:p-6">
          {/* A chave é o caminho: o crossfade dispara na troca de rota, não a
              cada re-render da mesma rota. */}
          <TransicaoDeRota chave={location.pathname}>
            <Outlet />
          </TransicaoDeRota>
        </main>
      </div>
    </div>
  );
}
