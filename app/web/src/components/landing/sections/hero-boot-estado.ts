/**
 * hero-boot-estado.ts — quando o boot do hero toca (fora do componente, para o
 * fast refresh do Vite e para os testes). Ver `hero-boot.tsx`.
 */

import { movimentoReduzido } from "../../../design/accessibility";
import { BOOT_LANDING } from "../motion/tokens";

/** Decide ANTES do primeiro paint se o boot toca (evita o hero piscar). */
export function deveTocarBoot(): boolean {
  if (typeof window === "undefined" || movimentoReduzido() || window.location.hash) return false;
  try {
    return window.sessionStorage.getItem(BOOT_LANDING.chaveSessao) !== "1";
  } catch {
    return false;
  }
}

export function marcarBootVisto(): void {
  try {
    window.sessionStorage.setItem(BOOT_LANDING.chaveSessao, "1");
  } catch {
    /* sessionStorage indisponível: só não lembra */
  }
}
