/**
 * Contexto legado de blur das telas autenticadas, mantido enxuto e sem estado
 * reativo por foco para eliminar re-renders da barra inferior durante a troca
 * de abas e evitar múltiplas capturas offscreen simultâneas no Android.
 * Consumidores: layout autenticado (compatibilidade de árvore).
 */
import { type ReactNode } from "react";

export function WorkspaceBlurProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
