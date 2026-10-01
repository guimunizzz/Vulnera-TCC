/**
 * query-loading-indicator.tsx
 *
 * Informa buscas e retentativas em andamento sem bloquear a navegação.
 * O atraso evita flashes em respostas rápidas; o espaço reservado mantém a
 * barra superior estável. Consumido pelo AppLayout das telas autenticadas.
 */

import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { cn } from "../../lib/cn";

export function QueryLoadingIndicator() {
  const carregando = useIsFetching() > 0;
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!carregando) {
      setMostrar(false);
      return;
    }

    const timer = window.setTimeout(() => setMostrar(true), 200);
    return () => window.clearTimeout(timer);
  }, [carregando]);

  // Esconde na própria renderização final, sem esperar pelo efeito de limpeza.
  const visivel = carregando && mostrar;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visivel}
      aria-busy={carregando}
      className={cn(
        "pointer-events-none inline-flex min-h-5 min-w-4 shrink-0 items-center gap-2 text-xs text-fg-muted",
        !visivel && "invisible",
      )}
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      />
      <span className="max-sm:sr-only">Carregando dados…</span>
    </div>
  );
}
