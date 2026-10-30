/**
 * components/landing/scene/landing-scene.tsx
 *
 * O QUE FAZ
 * A camada de fundo da landing: o pôster estático sempre pintado e, quando o
 * gate do kit permite, a cena WebGL por cima, carregada só por `lazy()`.
 * Quando o primeiro quadro da cena sai, o pôster esmaece; se a cena se perde,
 * ele volta.
 *
 * POR QUE EXISTE
 * Um único canvas por rota (decisão do refactor web-motion-3d). O gate
 * (`useCenaPermitida`) decide antes do download: com movimento reduzido, tela
 * estreita ou sem WebGL2, o chunk de three nem é pedido.
 *
 * QUEM USA
 * `landing-root.tsx`.
 */

import { lazy, Suspense, useEffect, useState } from "react";
import { useCenaPermitida } from "../../../three/gate";
import { LARGURA_MINIMA_CENA } from "./config";
import { LandingPoster } from "./landing-poster";
import { useAtoAtual } from "./use-ato-atual";

// Falha de download de decoração não pode derrubar a página: o pôster fica.
const Canvas = lazy(() => import("./landing-scene-canvas").catch(() => ({ default: () => <></> })));

export function LandingScene() {
  const permitida = useCenaPermitida({ larguraMinima: LARGURA_MINIMA_CENA });
  const ato = useAtoAtual();
  const [pronta, setPronta] = useState(false);
  // Cena desmontada (ex.: ligou "reduzir movimento"): ao voltar, o pôster só
  // sai quando o novo primeiro quadro for desenhado.
  useEffect(() => {
    if (!permitida) setPronta(false);
  }, [permitida]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" data-landing-cena={permitida ? "webgl" : "poster"}>
      <LandingPoster ato={ato} oculto={permitida && pronta} />
      {permitida && (
        <Suspense fallback={null}>
          <Canvas aoFicarPronta={() => setPronta(true)} aoPerder={() => setPronta(false)} />
        </Suspense>
      )}
    </div>
  );
}
