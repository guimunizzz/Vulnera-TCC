/**
 * shaders.ts
 *
 * O QUE FAZ
 * As três peças de GLSL da cena do hero: (1) o passe composto que transforma
 * o frame renderizado em ASCII + aberração cromática + scanlines + vinheta,
 * (2) o vertex/fragment das partículas (sakura/cyber-spark) e (3) o "glow
 * shell" aditivo da lâmina wireframe.
 *
 * POR QUE ASCII NÃO É UM PNG
 * Um atlas de glifos gerado em runtime (ver `glyph-atlas.ts`) com a MESMA
 * fonte de dado do design system (JetBrains Mono) evita depender de um
 * asset de imagem versionado — a landing herda a fonte, não inventa uma.
 *
 * POR QUE ABERRAÇÃO CROMÁTICA "BARATA"
 * Em vez de rodar o passe ASCII três vezes (uma por canal), o luma é lido uma
 * única vez no centro da célula e só a AMOSTRAGEM DE COR é deslocada por
 * canal — o glifo (forma) fica estável, só a tinta "sangra" nas bordas. É a
 * mesma ilusão de um CRT desalinhado, por um terço do custo.
 *
 * POR QUE NÃO HÁ UnrealBloomPass
 * Bloom real é 5 render targets extras por frame (downsample + blur em
 * cascata) — caro demais para o orçamento de 60fps do hero. O "glow" da
 * lâmina é uma malha duplicada, maior e com blending aditivo
 * (`buildGlowShell` em `use-hero-scene.ts`) — o mesmo truque usado em boa
 * parte das demos three.js antes do post-processing ficar barato.
 *
 * QUEM USA
 * `use-hero-scene.ts`.
 */

import * as THREE from "three";
import { LANDING_ACCENT, LANDING_VOID } from "./landing-palette";

/* ==========================================================================
   Passe composto: ASCII + aberração cromática + scanlines + vinheta
   ========================================================================== */

export const ASCII_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ASCII_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform sampler2D uGlyphs;
  uniform float uGlyphCount;
  uniform vec2 uResolution;
  uniform float uCellSize;
  uniform float uTime;
  uniform float uAberration;
  uniform float uScanIntensity;
  uniform float uGlitchAmount;
  uniform float uGlitchBandY;
  uniform vec3 uVoidDeep;
  uniform vec3 uGlow;

  varying vec2 vUv;

  /* Hash barato — não precisa de qualidade criptográfica, só quebrar o
     padrão visível de um sin() puro repetindo a cada 2π. */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 fragPx = vUv * uResolution;

    /* Faixa de glitch: um bloco horizontal (uGlitchBandY controla a altura
       normalizada, definida a cada "burst" em JS) desloca a amostragem em X.
       Fora do burst, uGlitchAmount é 0 e este bloco não faz nada. */
    float bandDist = abs(vUv.y - uGlitchBandY);
    float band = step(bandDist, 0.035) * uGlitchAmount;
    float glitchShift = (hash(vec2(floor(uTime * 12.0), uGlitchBandY)) - 0.5) * 0.06 * band;

    vec2 cellPx = floor(fragPx / uCellSize) * uCellSize + uCellSize * 0.5;
    vec2 cellUv = (cellPx / uResolution) + vec2(glitchShift, 0.0);

    /* Direção radial a partir do centro — a aberração "sangra" mais perto
       da borda, como uma lente real, e quase não aparece no centro. */
    vec2 fromCenter = cellUv - 0.5;
    float radial = length(fromCenter);
    vec2 dir = radial > 0.0001 ? fromCenter / radial : vec2(0.0);
    float aberr = uAberration * (0.35 + radial);

    vec3 sceneColor;
    sceneColor.r = texture2D(tDiffuse, cellUv + dir * aberr).r;
    sceneColor.g = texture2D(tDiffuse, cellUv).g;
    sceneColor.b = texture2D(tDiffuse, cellUv - dir * aberr).b;

    float luma = dot(sceneColor, vec3(0.299, 0.587, 0.114));
    float idx = floor(clamp(luma, 0.0, 1.0) * (uGlyphCount - 1.0) + 0.5);

    vec2 local = fract(fragPx / uCellSize);
    local.y = 1.0 - local.y; /* textura tem origem no canto superior */
    vec2 glyphUv = vec2((idx + local.x) / uGlyphCount, local.y);
    float ink = texture2D(uGlyphs, glyphUv).r;

    vec3 tinted = mix(uVoidDeep, sceneColor + uGlow * luma * 0.4, ink);

    /* Scanlines — deslocam devagar pra não ler como flicker estroboscópico
       (WCAG 2.3.1: nada acima de 3 eventos/s aqui, é uma deriva contínua). */
    float scan = sin(fragPx.y * 0.9 - uTime * 40.0) * 0.5 + 0.5;
    tinted *= 1.0 - uScanIntensity * scan * 0.18;

    /* Vinheta: as bordas afundam de volta no void, dando profundidade ao
       quadro sem precisar de uma segunda geometria. */
    float vign = smoothstep(0.92, 0.25, radial);
    vec3 color = mix(uVoidDeep, tinted, vign);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface AsciiPassUniforms {
  // Índice de string: é o que faz este tipo caber no parâmetro `uniforms` do
  // `THREE.ShaderMaterial` (tipado como `{ [uniform: string]: IUniform }`)
  // sem precisar de cast em `use-hero-scene.ts`. Os campos nomeados abaixo
  // continuam dando autocomplete/checagem pra quem usa `asciiUniforms.uTime`.
  [uniform: string]: THREE.IUniform;
  tDiffuse: { value: THREE.Texture | null };
  uGlyphs: { value: THREE.Texture };
  uGlyphCount: { value: number };
  uResolution: { value: THREE.Vector2 };
  uCellSize: { value: number };
  uTime: { value: number };
  uAberration: { value: number };
  uScanIntensity: { value: number };
  uGlitchAmount: { value: number };
  uGlitchBandY: { value: number };
  uVoidDeep: { value: THREE.Color };
  uGlow: { value: THREE.Color };
}

export function createAsciiUniforms(glyphs: THREE.Texture, glyphCount: number): AsciiPassUniforms {
  return {
    tDiffuse: { value: null },
    uGlyphs: { value: glyphs },
    uGlyphCount: { value: glyphCount },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCellSize: { value: 9 },
    uTime: { value: 0 },
    uAberration: { value: 0.0022 },
    uScanIntensity: { value: 1 },
    uGlitchAmount: { value: 0 },
    uGlitchBandY: { value: 0.5 },
    uVoidDeep: { value: new THREE.Color(LANDING_VOID.deep) },
    uGlow: { value: new THREE.Color(LANDING_ACCENT.glow) },
  };
}

/* ==========================================================================
   Partículas — sakura / cyber-spark
   ========================================================================== */

export const PARTICLE_VERTEX_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSeed;
  attribute float aSize;
  attribute float aKind; /* 0 = spark violeta, 1 = sakura rosa */

  varying float vKind;
  varying float vFade;

  /* Turbulência barata: soma de senos em fases/frequências desencontradas.
     Não é simplex noise (sem textura/permutation table), mas para um campo
     de ~200 partículas em loop contínuo a diferença visual é imperceptível
     e o custo é uma fração do de um noise "de verdade". */
  vec3 turbulence(vec3 p, float t) {
    float x = sin(p.y * 0.6 + t * 0.7) * 0.35 + sin(p.z * 1.3 - t * 0.4) * 0.15;
    float y = cos(p.x * 0.5 - t * 0.5) * 0.30 + sin(p.z * 0.9 + t * 0.6) * 0.15;
    float z = sin(p.x * 0.4 + t * 0.3) * 0.25;
    return vec3(x, y, z);
  }

  void main() {
    vKind = aKind;

    float t = uTime * (0.15 + aSeed * 0.1);
    vec3 drifted = position + turbulence(position + aSeed * 10.0, t);

    /* Queda lenta e contínua (sakura caindo / faísca subindo, conforme
       aKind) com wrap-around vertical — evita reiniciar o sistema inteiro
       a cada ciclo, que é o que faria a cena "pular" visivelmente. */
    /* aKind 0 (spark) sobe — fallDir negativo, y cresce; aKind 1 (sakura)
       cai — fallDir positivo, y decresce. Bateu ao contrário na primeira
       versão (mix(1.0,-1.0,...) dava fallDir=+1 pro spark, ou seja, ele
       também caía) — o comentário acima já dizia a intenção certa. */
    float fallDir = mix(-1.0, 1.0, aKind);
    drifted.y -= fallDir * mod(uTime * (0.25 + aSeed * 0.2), 9.0);
    drifted.y = mod(drifted.y + 4.5, 9.0) - 4.5;

    vFade = 0.5 + 0.5 * sin(t * 2.0 + aSeed * 6.2831);

    vec4 mvPosition = modelViewMatrix * vec4(drifted, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    /* 28.0, não 200.0: com a câmera a ~5 unidades e aSize em 3-8, 200.0
       dava 240-560px de gl_PointSize ANTES do clamp de
       ALIASED_POINT_SIZE_RANGE da GPU -- em hardware real isso ainda clampa
       pra um blob enorme; em software rendering (visto rodando de verdade
       em Chromium headless) o clamp e tao baixo que o ponto simplesmente
       some. Com 28.0 o alvo e ~15-45px na tela -- visivel como faisca/petala
       sem virar mancha nem sumir. */
    gl_PointSize = aSize * uPixelRatio * (28.0 / -mvPosition.z);
  }
`;

export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uSparkColor;
  uniform vec3 uSakuraColor;

  varying float vKind;
  varying float vFade;

  void main() {
    vec2 fromCenter = gl_PointCoord - 0.5;
    float d = length(fromCenter);
    float mask = smoothstep(0.5, 0.05, d);
    if (mask <= 0.001) discard;

    vec3 color = mix(uSparkColor, uSakuraColor, vKind);
    float alpha = mask * (0.35 + 0.5 * vFade);
    gl_FragColor = vec4(color, alpha);
  }
`;
