/**
 * Atmosfera compartilhada pela página e seus KPIs. Mantém um único canvas
 * lazy e um fallback imediato para poupar GPU e proteger o conteúdo funcional.
 * Consumidores: DashboardPage e FindingsPage; Three permanece no chunk lazy.
 */
import { lazy, Suspense, useContext, useEffect, useState } from "react";
import { useMotion } from "../../../motion/use-motion";
import { AmbientHostContext } from "./ambient-host-context";

// Falha de download de decoração não deve derrubar a área de trabalho.
const Canvas = lazy(() => import("./dashboard-ambient-canvas").catch(() => ({ default: () => <></> })));

export function DashboardAtmosphere({ pausado = false }: { pausado?: boolean }) {
  const layoutPossuiCena = useContext(AmbientHostContext);
  const { reduzido } = useMotion();
  const [estreita, setEstreita] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const atualizar = () => setEstreita(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  if (layoutPossuiCena) return null;

  return (
    <>
      <div aria-hidden="true" className="dashboard-atmosphere-fallback pointer-events-none absolute inset-0" />
      {!pausado && !reduzido && !estreita && <Suspense fallback={null}><Canvas /></Suspense>}
    </>
  );
}
