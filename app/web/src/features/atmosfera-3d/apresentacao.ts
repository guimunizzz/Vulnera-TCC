/**
 * features/atmosfera-3d/apresentacao.ts
 *
 * O QUE FAZ
 * Modo apresentação do Dashboard: a área de conteúdo (`#conteudo`, o `<main>`
 * do layout) em tela cheia pela Fullscreen API. Menu e cabeçalho ficam de
 * fora; a atmosfera, que mora dentro do `<main>`, vai junto e troca para o
 * modo imersivo (bloom, clique que pinga, teto de AA).
 *
 * Sair: Esc (nativo do navegador) ou o botão do próprio cabeçalho.
 *
 * QUEM USA
 * `DashboardHeader` (botão) e `AtmosferaDaPlataforma` (modo da cena).
 */

import { useCallback, useEffect, useState } from "react";

export const ID_DA_AREA_DE_CONTEUDO = "conteudo";

const emApresentacao = () => typeof document !== "undefined" && document.fullscreenElement?.id === ID_DA_AREA_DE_CONTEUDO;

export function useApresentacao(): { disponivel: boolean; ativa: boolean; alternar: () => void } {
  const [ativa, setAtiva] = useState(emApresentacao);

  useEffect(() => {
    const atualizar = () => setAtiva(emApresentacao());
    document.addEventListener("fullscreenchange", atualizar);
    return () => document.removeEventListener("fullscreenchange", atualizar);
  }, []);

  const alternar = useCallback(() => {
    if (emApresentacao()) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    // Recusa do navegador (política, iframe) não é erro do usuário: só não entra.
    void document.getElementById(ID_DA_AREA_DE_CONTEUDO)?.requestFullscreen().catch(() => undefined);
  }, []);

  return { disponivel: typeof document !== "undefined" && document.fullscreenEnabled === true, ativa, alternar };
}
