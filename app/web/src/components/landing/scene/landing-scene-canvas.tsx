/**
 * components/landing/scene/landing-scene-canvas.tsx
 *
 * O QUE FAZ
 * Contêiner da cena narrativa, fixo atrás do conteúdo. O `<canvas>` é criado
 * pelo hook dentro dele (decorativo: `aria-hidden`, sem foco, sem ponteiro) e
 * avisa quando o primeiro quadro saiu e quando a cena se perdeu, para o pôster
 * sair ou voltar.
 *
 * POR QUE EXISTE
 * É a fronteira do chunk de three: só entra por `lazy()` em
 * `landing-scene.tsx` (o ESLint proíbe import estático deste arquivo).
 *
 * QUEM USA
 * `landing-scene.tsx`.
 */

import { useRef } from "react";
import { useLandingScene } from "./use-landing-scene";

export default function LandingSceneCanvas({ aoFicarPronta, aoPerder }: {
  aoFicarPronta: () => void;
  aoPerder: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useLandingScene(host, { onReady: aoFicarPronta, onLost: aoPerder });
  return <div ref={host} aria-hidden="true" className="pointer-events-none fixed inset-0" />;
}
