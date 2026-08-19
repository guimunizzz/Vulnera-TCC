/**
 * hero-fallback.tsx
 *
 * O QUE FAZ
 * O gradiente CSS + scanlines estáticas que cobrem o hero ATÉ (e mesmo sem)
 * a cena Three.js montar. Deliberadamente um componente separado e SEM
 * dependência de `three` — ver `landing-page.tsx` sobre por que `CyberCanvas`
 * é carregado via `lazy()`: sem essa separação, o fallback ficaria dentro do
 * mesmo chunk que `three` e apareceria em branco até o chunk baixar, que é
 * exatamente o "flash" que este componente existe pra evitar.
 *
 * QUEM USA
 * `landing-page.tsx`, sempre (independente de `CyberCanvas` conseguir montar).
 */

import { LANDING_FALLBACK_GRADIENT } from "./landing-palette";

export function HeroFallback() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundImage: LANDING_FALLBACK_GRADIENT }}
    >
      <div className="landing-fallback-scanlines absolute inset-0" />
    </div>
  );
}
