/**
 * three/grade-celulas.ts
 *
 * O QUE FAZ
 * Primeira passada das cenas ASCII: um shader roda UMA vez por célula de
 * caractere e grava o resultado (glifo, cor, alfa) numa textura do tamanho
 * da grade. A segunda passada, na tela, só lê essa textura e o atlas.
 *
 * POR QUE EXISTE
 * A lógica da cena (atos, falhas, grupos, chuva, respiração) só muda por
 * célula, mas rodava por pixel: uma célula de 12 × 21 px repetia o mesmo
 * cálculo ~250 vezes. A 60 fps e com a composição da rolagem, a GPU
 * integrada caía para 31 fps com 51% dos quadros acima de 25 ms (medido em
 * 2026-11-03). Com a grade, o trabalho pesado vai de ~1,3 milhão de pixels
 * para ~5 mil células.
 *
 * FORMATO DA TEXTURA (RGBA8, sem filtro)
 *   r = índice do glifo / 255 · g = cor (id ou mistura, a cena decide) / 255
 *   ou 0–1 · b = alfa (0–1) · a = 1
 *
 * QUEM USA
 * `use-landing-scene.ts` e `use-dashboard-scene.ts`, ambos lazy.
 */

import * as THREE from "three";

export interface GradeDeCelulas {
  /** Uniforms para a passada de tela: a textura e o tamanho dela em células. */
  uniformes: {
    uCelulas: { value: THREE.Texture };
    uGradeTextura: { value: THREE.Vector2 };
  };
  /** Ajusta a textura à tela: uma célula por texel, cobrindo células parciais da borda. */
  redimensionar(resolucaoPx: THREE.Vector2, celulaPx: THREE.Vector2): void;
  /** Roda a passada de células e devolve o renderer ao alvo anterior. */
  desenhar(renderer: THREE.WebGLRenderer): void;
  descartar(): void;
}

export const VERTEX_TELA_CHEIA = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * GLSL da passada de tela: `lerCelula(celula)` devolve o texel da célula e
 * `byte(v)` desfaz o /255 do índice ou do id de cor.
 */
export const GLSL_LER_CELULAS = /* glsl */ `
uniform sampler2D uCelulas;
uniform vec2 uGradeTextura;
vec4 lerCelula(vec2 celula) { return texture2D(uCelulas, (celula + 0.5) / uGradeTextura); }
float byte(float v) { return floor(v * 255.0 + 0.5); }
`;

export function criarGradeDeCelulas(fragmento: string, uniformes: Record<string, THREE.IUniform>): GradeDeCelulas {
  const alvo = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: false,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: uniformes,
    vertexShader: VERTEX_TELA_CHEIA,
    fragmentShader: fragmento,
    // Dado empacotado, não cor: sem mistura, sem conversão de espaço de cor.
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    // Os hashes por célula precisam de highp; com ~5 mil células o custo some.
    precision: "highp",
  });
  const quadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quadro.frustumCulled = false;
  const cena = new THREE.Scene();
  cena.add(quadro);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tamanho = new THREE.Vector2(1, 1);

  return {
    uniformes: {
      uCelulas: { value: alvo.texture },
      uGradeTextura: { value: tamanho },
    },
    redimensionar(resolucaoPx, celulaPx) {
      tamanho.set(Math.max(1, Math.ceil(resolucaoPx.x / celulaPx.x)), Math.max(1, Math.ceil(resolucaoPx.y / celulaPx.y)));
      alvo.setSize(tamanho.x, tamanho.y);
    },
    desenhar(renderer) {
      const anterior = renderer.getRenderTarget();
      renderer.setRenderTarget(alvo);
      renderer.render(cena, camera);
      renderer.setRenderTarget(anterior);
    },
    descartar() {
      quadro.geometry.dispose();
      material.dispose();
      alvo.dispose();
    },
  };
}
