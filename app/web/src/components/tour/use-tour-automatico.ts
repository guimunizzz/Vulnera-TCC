/**
 * use-tour-automatico.ts — abre o tour na primeira visita (por usuário, neste
 * navegador) e permite repetir. Separado do componente para o fast-refresh.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../../store/auth.store";
import { marcarTourVisto, tourJaVisto, type ResultadoTour } from "../../lib/tour";

/**
 * Abre o tour sozinho na primeira vez (por usuário, neste navegador), quando
 * `pronto` diz que a tela já tem o que mostrar. `abrir()` repete o tour pelo
 * botão "Ver tour".
 */
export function useTourAutomatico(tourId: string, pronto: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!pronto || tourJaVisto(tourId, userId)) return;
    // Espera a tela assentar (skeleton → conteúdo, entrada animada).
    const t = window.setTimeout(() => setAberto(true), 600);
    return () => window.clearTimeout(t);
  }, [pronto, tourId, userId]);

  const fechar = useCallback(
    (resultado: ResultadoTour | null) => {
      setAberto(false);
      if (resultado) marcarTourVisto(tourId, userId, resultado);
    },
    [tourId, userId],
  );

  return { aberto, abrir: () => setAberto(true), fechar };
}

