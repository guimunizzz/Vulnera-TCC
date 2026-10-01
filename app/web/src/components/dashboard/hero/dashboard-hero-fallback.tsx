/**
 * dashboard-hero-fallback.tsx
 *
 * O QUE FAZ
 * Desenha a iluminação e a malha CSS estática que aparecem imediatamente no
 * hero, antes e também na ausência do WebGL.
 *
 * POR QUE EXISTE
 * O fallback precisa ser eager e independente de Three.js para nunca deixar o
 * cabeçalho vazio enquanto o chunk visual carrega.
 *
 * QUEM USA
 * `dashboard-hero.tsx` nos dashboards ADMIN, CLIENT e PENTESTER.
 */

export function DashboardHeroFallback() {
  return (
    <div
      aria-hidden="true"
      data-testid="dashboard-hero-fallback"
      className="dashboard-hero-fallback pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="dashboard-hero-grid absolute inset-0" />
      <div className="dashboard-hero-orbit absolute" />
    </div>
  );
}
