/**
 * dashboard-ambient-canvas.tsx
 *
 * O QUE FAZ
 * Renderiza o canvas decorativo da página e faz o cross-fade quando a cena está
 * pronta. O componente inteiro pertence ao chunk lazy que contém Three.js.
 *
 * POR QUE EXISTE
 * Impede que `three` entre no bundle inicial e mantém o fallback CSS visível
 * durante carregamento, falha de GPU ou perda de contexto.
 *
 * QUEM USA
 * `dashboard-atmosphere.tsx`, exclusivamente via React.lazy().
 */

import { useRef, useState } from "react";
import { useTheme } from "../../../design/theme-provider";
import { useDashboardScene } from "./use-dashboard-scene";

function DashboardAmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  const { resolvido } = useTheme();

  useDashboardScene(canvasRef, {
    theme: resolvido,
    onReady: () => setPronto(true),
    onLost: () => setPronto(false),
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-dashboard-ambient="true"
      data-ready={pronto}
      className="dashboard-ambient-canvas pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export default DashboardAmbientCanvas;
