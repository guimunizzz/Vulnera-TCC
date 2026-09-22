/**
 * Atmosfera compartilhada pela página e seus KPIs. Mantém um único canvas
 * lazy e um fallback imediato para poupar GPU e proteger o conteúdo funcional.
 * Consumidor: DashboardPage; nenhuma dependência de Three neste módulo eager.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useMotion } from "../../../motion/use-motion";

// Falha de download de decoração não deve derrubar a área de trabalho.
const Canvas = lazy(() => import("./dashboard-ambient-canvas").catch(() => ({ default: () => <></> })));

export function DashboardAtmosphere() {
  const { reduzido } = useMotion();
  const [estreita, setEstreita] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const atualizar = () => setEstreita(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  return (
    <>
      <div aria-hidden="true" className="dashboard-atmosphere-fallback pointer-events-none absolute inset-0" />
      {!reduzido && !estreita && <Suspense fallback={null}><Canvas /></Suspense>}
    </>
  );
}
