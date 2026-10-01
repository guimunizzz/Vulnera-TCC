/**
 * lib/haptics.ts
 *
 * Wrapper fino sobre expo-haptics — centraliza os 3 níveis que o app usa
 * (toque leve de navegação, sucesso, aviso) num nome só por intenção, em
 * vez de espalhar `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`
 * cru pelas telas. Silencioso em qualquer ambiente sem suporte (web,
 * simulador sem motor de vibração) — best-effort, nunca trava a ação.
 */

import * as Haptics from "expo-haptics";

function safe(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export const haptics = {
  /** Navegação leve — trocar de aba, abrir um card. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Ação confirmada — login com sucesso, atualizar lista. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Ação destrutiva ou de atenção — logout, erro de formulário. */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
