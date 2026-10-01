/**
 * use-tab-bar-clearance.ts
 *
 * A tab bar virou um pill flutuante (ver app/(tabs)/_layout.tsx) que paira
 * por cima do conteúdo em vez de empurrá-lo pra cima como a barra dockada
 * antiga fazia. Toda tela dentro de (tabs) — inclusive as aninhadas no
 * stack de "Projetos", já que a barra continua visível nelas — precisa
 * desse mesmo respiro no rodapé pra não esconder o último item atrás do
 * vidro. Um hook só em vez de repetir a soma em cada arquivo.
 */

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING, TAB_BAR } from "../theme/tokens";

export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR.bottomMargin + TAB_BAR.height + SPACING[4];
}
