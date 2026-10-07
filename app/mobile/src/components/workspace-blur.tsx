/**
 * Compartilha o fundo desfocado da tela ativa com seus vidros e a barra de abas.
 * Expo exige BlurTargetView no Android; um alvo por tela evita capturas duplicadas.
 * Consumidores: layout autenticado e WorkspaceScreen, sem afetar o login.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { View } from "react-native";

type BlurTarget = RefObject<View | null>;
type ActiveBlur = { target?: BlurTarget; activate: (target: BlurTarget) => void; deactivate: (target: BlurTarget) => void };
const ActiveBlurContext = createContext<ActiveBlur>({ activate: () => {}, deactivate: () => {} });
export const ScreenBlurTargetContext = createContext<BlurTarget | undefined>(undefined);

export function WorkspaceBlurProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<BlurTarget>();
  const activate = useCallback((next: BlurTarget) => setTarget(next), []);
  // O cleanup de uma tela anterior não pode remover o alvo da próxima tela.
  const deactivate = useCallback((previous: BlurTarget) => setTarget((current) => current === previous ? undefined : current), []);
  const value = useMemo(() => ({ target, activate, deactivate }), [target, activate, deactivate]);
  return <ActiveBlurContext.Provider value={value}>{children}</ActiveBlurContext.Provider>;
}

export function useActiveWorkspaceBlur() { return useContext(ActiveBlurContext); }
export function useScreenBlurTarget() { return useContext(ScreenBlurTargetContext); }
