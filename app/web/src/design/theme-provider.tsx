/**
 * theme-provider.tsx
 *
 * O QUE FAZ
 * Envolve a aplicação e expõe `useTheme()`: o tema escolhido, o tema resolvido
 * e a função de troca.
 *
 * POR QUE EXISTE
 * O tema já foi aplicado ao `<html>` pelo script inline do `index.html` antes
 * do React montar. Este provider NÃO reaplica na montagem — ele apenas assume o
 * controle a partir dali. Reaplicar causaria exatamente o flash que o script
 * inline evita.
 *
 * QUEM USA
 * `main.tsx` (o provider) e qualquer componente que precise saber ou trocar o
 * tema — hoje o `ThemeToggle` e o `/styleguide`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  aplicarTema,
  lerTemaGuardado,
  guardarTema,
  observarTemaDoSistema,
  resolverTema,
  type Theme,
  type ThemeResolvido,
} from "./theme";

interface ContextoTema {
  /** O que a pessoa escolheu — pode ser "system". */
  tema: Theme;
  /** O que está de fato na tela — nunca "system". */
  resolvido: ThemeResolvido;
  definirTema: (tema: Theme) => void;
}

const Contexto = createContext<ContextoTema | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Estado inicial vem do storage, não de um valor fixo: se começasse em "dark"
  // e corrigisse no efeito, quem escolheu claro veria um quadro escuro.
  const [tema, setTema] = useState<Theme>(() => lerTemaGuardado());
  const [resolvido, setResolvido] = useState<ThemeResolvido>(() => resolverTema(lerTemaGuardado()));

  const definirTema = useCallback((novo: Theme) => {
    setTema(novo);
    guardarTema(novo);
    setResolvido(aplicarTema(novo));
  }, []);

  // Só reage ao SO quando a escolha é "system". Quem escolheu explicitamente
  // não quer que o pôr do sol troque a interface no meio de uma análise.
  useEffect(() => {
    if (tema !== "system") return;
    return observarTemaDoSistema(() => setResolvido(aplicarTema("system")));
  }, [tema]);

  // Sincroniza entre abas: trocar o tema numa aba troca em todas. `storage`
  // só dispara em OUTRAS abas, então não há laço.
  useEffect(() => {
    const aoMudarStorage = (e: StorageEvent) => {
      if (e.key !== "vulnera:theme" || !e.newValue) return;
      const novo = e.newValue as Theme;
      setTema(novo);
      setResolvido(aplicarTema(novo));
    };
    window.addEventListener("storage", aoMudarStorage);
    return () => window.removeEventListener("storage", aoMudarStorage);
  }, []);

  const valor = useMemo<ContextoTema>(() => ({ tema, resolvido, definirTema }), [tema, resolvido, definirTema]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTheme(): ContextoTema {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
