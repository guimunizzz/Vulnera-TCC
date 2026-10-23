/**
 * Atmosfera compartilhada pela página e seus KPIs. Mantém um único canvas
 * lazy e um fallback imediato para poupar GPU e proteger o conteúdo funcional.
 * Consumidores: DashboardPage e FindingsPage; Three permanece no chunk lazy.
 */
import { lazy, Suspense, useContext } from "react";
import { useCenaPermitida } from "../../../three/gate";
import { AmbientHostContext } from "./ambient-host-context";

// Falha de download de decoração não deve derrubar a área de trabalho.
const Canvas = lazy(() => import("./dashboard-ambient-canvas").catch(() => ({ default: () => <></> })));

export function DashboardAtmosphere({ pausado = false }: { pausado?: boolean }) {
  const layoutPossuiCena = useContext(AmbientHostContext);
  // Movimento reduzido, viewport < 768 px ou sem WebGL2: o chunk de three
  // nem é baixado e o fallback CSS fica sozinho.
  const cenaPermitida = useCenaPermitida();

  if (layoutPossuiCena) return null;

  return (
    <>
      <div aria-hidden="true" className="dashboard-atmosphere-fallback pointer-events-none absolute inset-0" />
      {!pausado && cenaPermitida && <Suspense fallback={null}><Canvas /></Suspense>}
    </>
  );
}
