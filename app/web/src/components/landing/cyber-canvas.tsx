/**
 * cyber-canvas.tsx
 *
 * O QUE FAZ
 * O `<canvas>` da cena Three.js do hero (`useHeroScene`), em cross-fade sobre
 * o `HeroFallback` que `landing-page.tsx` já mantém por baixo. `aria-hidden`
 * e `pointer-events-none` — é decoração atmosférica, nunca carrega
 * informação que não esteja também em texto real na página.
 *
 * POR QUE ESTE ARQUIVO É CARREGADO VIA `lazy()` (ver landing-page.tsx)
 * `three` sozinho pesa ~600kB gzip. Importado direto no topo de
 * `landing-page.tsx` (que por sua vez é importada direto em `App.tsx`), esse
 * peso entraria no chunk PRINCIPAL da aplicação — toda rota (dashboard,
 * login, findings) pagaria o download de `three` mesmo nunca usando WebGL.
 * `React.lazy(() => import("./cyber-canvas"))` bota `three` (e os módulos de
 * `three/examples/jsm/postprocessing`) num chunk separado, buscado só quando
 * alguém visita "/" — e mesmo aí, depois do primeiro paint (o `HeroFallback`
 * já preenche a tela por baixo enquanto o chunk baixa).
 *
 * POR QUE O GRADIENTE NÃO MORA MAIS AQUI
 * Ele morava até este componente ganhar `lazy()`: um fallback que só existe
 * DENTRO do chunk que está atrasado não aparece enquanto o chunk não chega —
 * exatamente o "flash" que o fallback deveria evitar. `HeroFallback` foi
 * extraído pra um módulo sem `three`, sempre presente, sempre eager.
 *
 * QUEM USA
 * `landing-page.tsx`, atrás do conteúdo do hero, dentro de um `<Suspense>`.
 */

import { useRef, useState } from "react";
import { useMotion } from "../../motion/use-motion";
import { useHeroScene } from "./use-hero-scene";

export function CyberCanvas() {
  const { reduzido } = useMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);

  useHeroScene(canvasRef, {
    enabled: !reduzido,
    onReady: () => setPronto(true),
    // Contexto morreu depois de pronto (GPU/driver, aba em segundo plano no
    // mobile) — volta pro fallback estático em vez de deixar um canvas
    // opaco e quebrado por cima do gradiente (ver o cabeçalho de
    // use-hero-scene.ts; achado rodando de verdade num Chromium headless).
    onLost: () => setPronto(false),
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-ready={pronto}
      className="landing-canvas pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
