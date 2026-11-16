/**
 * three/acumulacao.ts
 *
 * O QUE FAZ
 * Camada de acumulação: uma "tela" fora da tela onde o que foi desenhado num
 * quadro continua no seguinte, um pouco mais fraco. A cada quadro o conteúdo
 * anterior é copiado esmaecido para um segundo alvo e a cena nova é desenhada
 * por cima; no quadro seguinte os dois alvos trocam de papel (ping-pong).
 *
 * POR QUE EXISTE
 * É o que dá rastro à pintura da landing (ADR-054): a pincelada deixa tinta
 * que desbota em vez de sumir de um quadro para o outro.
 * Por que dois alvos e não um só com um quad escuro por cima: num alvo de 8
 * bits, multiplicar por 0,915 nunca zera valores pequenos (5 × 0,915 arredonda
 * de volta para 5) e sobra uma mancha fantasma para sempre. Lendo o quadro
 * anterior como textura, o shader subtrai um piso fixo e o rastro chega a
 * zero. E não se pode ler e escrever o mesmo alvo no mesmo desenho.
 *
 * FORMATO
 * RGBA8 com alfa pré-multiplicado; quem desenha decide o espaço de cor.
 *
 * QUEM USA
 * `components/landing/scene/pintura.ts` (lazy, com a cena).
 */

import * as THREE from "three";
import { VERTEX_TELA_CHEIA } from "./grade-celulas";

export interface Acumulacao {
  /** Uniform pronto para a passada de tela; aponta sempre para o alvo mais recente. */
  uniforme: { value: THREE.Texture };
  /** Ajusta os alvos (px do buffer) e apaga o que havia. */
  redimensionar(largura: number, altura: number): void;
  /**
   * Um quadro: esmaece o anterior (`manter` = fração que sobra, 0 a 1), desenha
   * `cena` por cima e devolve o renderer ao alvo em que estava.
   */
  pintar(renderer: THREE.WebGLRenderer, cena: THREE.Scene, camera: THREE.Camera, manter: number): void;
  /** Apaga a tinta (ex.: a camada ficou inativa e não deve voltar com rastro velho). */
  limpar(renderer: THREE.WebGLRenderer): void;
  descartar(): void;
}

const FRAGMENT_ESMAECER = /* glsl */ `
uniform sampler2D uAnterior;
uniform vec2 uTamanho;
uniform float uManter;
uniform float uDifusao;
void main() {
  vec2 uv = gl_FragCoord.xy / uTamanho;
  vec4 anterior = texture2D(uAnterior, uv);
  // Mistura molhada: um pouco do quadro anterior escorre para os vizinhos,
  // e pinceladas que se cruzam se fundem em vez de só se empilhar.
  if (uDifusao > 0.0) {
    vec2 px = 1.5 / uTamanho;
    vec4 vizinhos = texture2D(uAnterior, uv + vec2(px.x, 0.0)) + texture2D(uAnterior, uv - vec2(px.x, 0.0))
      + texture2D(uAnterior, uv + vec2(0.0, px.y)) + texture2D(uAnterior, uv - vec2(0.0, px.y));
    anterior = mix(anterior, vizinhos * 0.25, uDifusao);
  }
  // O piso de meio nível garante que o rastro chega a zero em 8 bits.
  gl_FragColor = max(anterior * uManter - 0.002, 0.0);
}
`;

/**
 * `difusao` (0 a 1) liga a mistura molhada: 0 mantém a cópia exata do quadro
 * anterior e não custa nenhuma leitura a mais.
 */
export function criarAcumulacao({ difusao = 0 }: { difusao?: number } = {}): Acumulacao {
  const criarAlvo = () => new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  let leitura = criarAlvo();
  let escrita = criarAlvo();
  const tamanho = new THREE.Vector2(1, 1);
  let sujo = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAnterior: { value: leitura.texture },
      uTamanho: { value: tamanho },
      uManter: { value: 1 },
      uDifusao: { value: difusao },
    },
    vertexShader: VERTEX_TELA_CHEIA,
    fragmentShader: FRAGMENT_ESMAECER,
    // Cópia esmaecida: sobrescreve todos os pixels, sem mistura.
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const quadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quadro.frustumCulled = false;
  const cenaDoEsmaecer = new THREE.Scene();
  cenaDoEsmaecer.add(quadro);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforme = { value: leitura.texture as THREE.Texture };

  function limpar(renderer: THREE.WebGLRenderer): void {
    const anterior = renderer.getRenderTarget();
    for (const alvo of [leitura, escrita]) {
      renderer.setRenderTarget(alvo);
      renderer.clear();
    }
    renderer.setRenderTarget(anterior);
    sujo = false;
  }

  return {
    uniforme,
    redimensionar(largura, altura) {
      tamanho.set(Math.max(1, Math.round(largura)), Math.max(1, Math.round(altura)));
      leitura.setSize(tamanho.x, tamanho.y);
      escrita.setSize(tamanho.x, tamanho.y);
      // Alvo redimensionado nasce com lixo: o próximo `pintar` limpa antes.
      sujo = true;
    },
    pintar(renderer, cena, cameraDaCena, manter) {
      if (sujo) limpar(renderer);
      const alvoAnterior = renderer.getRenderTarget();
      const limpava = renderer.autoClear;
      // O esmaecer já cobre o alvo inteiro; limpar entre os dois desenhos apagaria o rastro.
      renderer.autoClear = false;
      material.uniforms.uAnterior.value = leitura.texture;
      material.uniforms.uManter.value = manter;
      renderer.setRenderTarget(escrita);
      renderer.render(cenaDoEsmaecer, camera);
      renderer.render(cena, cameraDaCena);
      renderer.setRenderTarget(alvoAnterior);
      renderer.autoClear = limpava;
      [leitura, escrita] = [escrita, leitura];
      uniforme.value = leitura.texture;
    },
    limpar,
    descartar() {
      quadro.geometry.dispose();
      material.dispose();
      leitura.dispose();
      escrita.dispose();
    },
  };
}
