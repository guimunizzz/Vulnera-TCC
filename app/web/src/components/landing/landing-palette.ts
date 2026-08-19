/**
 * landing-palette.ts
 *
 * O QUE FAZ
 * Paleta hex "cyber-samurai" exclusiva da landing pública (`/`). Fonte única
 * para as três superfícies que NÃO leem `oklch(var(--token))` do Tailwind:
 * o gradiente CSS de fallback (`style={{}}` inline), o `clearColor` do
 * WebGLRenderer e os `uniform vec3` dos shaders GLSL em `shaders.ts`.
 *
 * POR QUE FORA DE `tokens.css` (ver ADR-026)
 * `tokens.css` é a fonte de verdade do PRODUTO — dashboards, findings,
 * relatórios — e sua regra inviolável ("componente usa só semântico") é
 * imposta em build pelo `tailwind.config.ts`, que não expõe primitivo nenhum.
 * Essa regra é sobre componente de produto consumindo primitivo via classe
 * Tailwind; este arquivo não é isso — é o mesmo padrão de
 * `src/lib/severity-colors.ts` (que existe porque Recharts e pdf-lib pintam
 * via canvas/SVG e exigem hex cru). Se um dia outra tela precisar desta
 * paleta, ela vira token de verdade — até lá, é decoração de uma tela só.
 *
 * QUEM USA
 * `cyber-canvas.tsx`, `use-hero-scene.ts`, `shaders.ts`, `glitch-text.tsx`.
 */

/** Ancorado perto de `--iris-950` (#1f0a45) do design system, mas bem mais
 * escuro — a landing força `data-theme="dark"` (ADR-026 §1) e não precisa
 * caber na "espinha de lightness" que o produto compartilha entre matizes. */
export const LANDING_VOID = {
  /** Canto mais escuro do gradiente do hero — quase preto, leve violeta. */
  deep: "#05010b",
  /** Canto mais claro — onde a cena 3D "respira" mais luz. */
  shallow: "#0d041a",
  /** Meio-tom usado pelo `clearColor` do renderer (entre os dois acima). */
  mid: "#0a0313",
} as const;

/** Mesmo violeta de ação do produto (`--iris-500`/`--iris-400`), repetido em
 * hex aqui porque o shader GLSL não lê custom property — não é uma cor nova. */
export const LANDING_ACCENT = {
  glow: "#a38bf9", // ~--iris-400
  core: "#855fea", // ~--iris-500
} as const;

/** Canais de "RGB split" do glitch (aberração cromática / glitch de texto).
 * Cyan e magenta são o par clássico de deslocamento de canal — a mesma
 * ilusão de um monitor CRT desalinhado. Não competem com a severidade
 * (vermelho/laranja/âmbar/azul/verde já são todos reservados no produto). */
export const LANDING_GLITCH = {
  cyan: "#3ff3ff",
  magenta: "#ff3fd8",
} as const;

/** Faíscas/partículas: violeta claro para "cyber-spark", rosa pétala para a
 * variante "sakura" — a mesma lógica de "clareado o suficiente pra ler sobre
 * o void sem virar branco puro" que as rampas de `tokens.css` já usam. */
export const LANDING_PARTICLE = {
  spark: "#c9b6ff",
  sakura: "#ffb3d9",
} as const;

/** Gradiente CSS de fallback — usado sempre que a cena 3D não monta (sem
 * WebGL2, `prefers-reduced-motion`, ou jsdom em teste; ver ADR-026 §4). */
export const LANDING_FALLBACK_GRADIENT =
  `radial-gradient(120% 90% at 50% -10%, ${LANDING_VOID.shallow} 0%, ${LANDING_VOID.deep} 55%, #000000 100%)`;
