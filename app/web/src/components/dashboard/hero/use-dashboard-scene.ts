/**
 * Atmosfera ASCII da área autenticada: um campo esparso de caracteres de
 * terminal e alguns fluxos de dados lentos, em baixo contraste, atrás das
 * superfícies opacas do produto. Substitui as ondas e órbitas (refactor
 * web-motion-3d, Fase 4) com a mesma regra da ADR-041: um canvas, decoração,
 * nada sobre dado. Um quad em tela cheia e uma draw call; o glifo é decidido
 * por célula no shader, com o atlas de `src/three/ascii.ts`.
 * Render sob demanda: só redesenha em poucos "tiques" por segundo, na troca
 * de tema ou de tamanho. Consumido somente pelo canvas lazy; não atualiza
 * estado React por frame. Renderer, loop, pausas, contexto perdido, descarte
 * e cores vêm do kit `src/three/`.
 */
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { montarCena, type CenaMontada } from "../../../three/scene-host";
import { descartarCena } from "../../../three/dispose";
import { lerCorDoToken, observarTema, temaAtual } from "../../../three/palette";
import { criarAtlasAscii, GLSL_ASCII, type AtlasAscii } from "../../../three/ascii";

interface Options {
  onReady?: () => void;
  onLost?: () => void;
}

const FPS = 30;
const MAX_DPR = 1.5;
/** Largura da célula em px CSS: maior que a da landing — aqui é só textura. */
const CELULA_PX = 14;
/** Poucos tiques: o campo muda devagar e a GPU fica quase ociosa. */
const TIQUES_POR_SEGUNDO = 4;
/**
 * Rampa calma e o traço dos fluxos. Sem dígitos: no produto número é dado, e
 * um "0" ou "1" solto ao lado de um KPI, rótulo ou aba seria lido como tal.
 * Nada de alerta ou severidade no fundo do produto.
 */
export const GLIFOS_ATMOSFERA = " .·:-+|";
/** Opacidade máxima dos glifos por tema (o claro precisa de menos). */
const OPACIDADE = { dark: 0.24, light: 0.16 } as const;

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${GLSL_ASCII}

uniform float uTique;
uniform float uAlfa;
uniform vec3 uCorTinta;
uniform vec3 uCorApagada;

void main() {
  vec2 celula = celulaDaTela();
  vec2 grade = gradeDaTela();
  float r = hashCelula(celula);

  // Campo estático esparso (≈ 12% das células), com cintilar raro por tique.
  // Rampa puxada para os glifos leves (. · :).
  float presente = step(0.88, r);
  float cintila = step(0.92, hashCelula(celula + vec2(uTique, 0.0)));
  float sorteio = mix(hashCelula(celula + 29.0), hashCelula(celula + vec2(uTique, 5.0)), cintila);
  float indice = 1.0 + floor(sorteio * sorteio * 5.0);

  // Fluxos de dados: poucas colunas (≈ 6%) com um rastro descendo devagar.
  float coluna = hashCelula(vec2(celula.x, 1.0));
  float ativa = step(0.94, coluna);
  float ciclo = grade.y + 14.0;
  float cabeca = mod(uTique * (0.6 + coluna) + coluna * ciclo * 7.0, ciclo);
  float distancia = cabeca - (grade.y - 1.0 - celula.y);
  float rastro = ativa * step(0.0, distancia) * (1.0 - smoothstep(0.0, 9.0, distancia));
  // O rastro alterna ":" e "|": chuva de terminal, sem caractere legível.
  if (rastro > 0.01) indice = mix(3.0, 6.0, step(0.5, hashCelula(celula + vec2(uTique, 9.0))));

  float alfa = max(presente * 0.55, rastro) * uAlfa;
  // Mais presente no topo (atrás do cabeçalho da página), some para baixo.
  float altura = (celula.y + 0.5) / grade.y;
  alfa *= mix(0.35, 1.0, altura);
  vec3 cor = mix(uCorApagada, uCorTinta, max(rastro, step(0.97, r)));

  gl_FragColor = vec4(cor, coberturaDoGlifo(indice) * alfa);
  #include <colorspace_fragment>
}
`;

export function useDashboardScene(canvasRef: RefObject<HTMLCanvasElement | null>, options: Options): void {
  const callbacks = useRef(options);
  callbacks.current = options;

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const canvas: HTMLCanvasElement = element;
    let cena: CenaMontada | null = null;
    let cenaThree: THREE.Scene | null = null;
    let atlas: AtlasAscii | null = null;
    let parado = false;
    let pronto = false;
    let tempo = 0;
    let ultimoTique = -1;
    let redimensionar = true;
    let sujo = true;
    let tamanho: ResizeObserver | undefined;
    let pararDeObservarTema: (() => void) | undefined;

    const uniformes = {
      uAtlas: { value: null as THREE.Texture | null },
      uTotalGlifos: { value: Array.from(GLIFOS_ATMOSFERA).length },
      uCelula: { value: new THREE.Vector2(CELULA_PX, CELULA_PX * 2) },
      uResolucao: { value: new THREE.Vector2(1, 1) },
      uTique: { value: 0 },
      uAlfa: { value: OPACIDADE.dark as number },
      uCorTinta: { value: new THREE.Color() },
      uCorApagada: { value: new THREE.Color() },
    };
    // O shader ignora a câmera; o renderer só exige uma.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    function aplicarPaleta(): void {
      lerCorDoToken(canvas, "--color-ambient-ink", uniformes.uCorTinta.value);
      lerCorDoToken(canvas, "--color-ambient-muted", uniformes.uCorApagada.value);
      uniformes.uAlfa.value = OPACIDADE[temaAtual()];
      sujo = true;
    }

    function draw(renderer: THREE.WebGLRenderer, delta: number): void {
      if (!cenaThree || !atlas) return;
      if (redimensionar) {
        // No layout global o conteúdo pode ter milhares de pixels de altura.
        // O buffer WebGL segue o tamanho visível do canvas, nunca a página toda.
        const largura = Math.max(1, canvas.clientWidth);
        const altura = Math.max(1, canvas.clientHeight);
        renderer.setSize(largura, altura, false);
        const dpr = renderer.getPixelRatio();
        uniformes.uResolucao.value.set(largura * dpr, altura * dpr);
        uniformes.uCelula.value.set(CELULA_PX * dpr, (CELULA_PX * dpr) / atlas.proporcao);
        redimensionar = false;
        sujo = true;
      }
      tempo += delta;
      const tique = Math.floor(tempo * TIQUES_POR_SEGUNDO);
      if (pronto && !sujo && tique === ultimoTique) return;
      uniformes.uTique.value = tique;
      ultimoTique = tique;
      sujo = false;
      renderer.render(cenaThree, camera);
      if (!pronto) {
        pronto = true;
        callbacks.current.onReady?.();
      }
    }

    function cleanup(): void {
      if (parado) return;
      parado = true;
      tamanho?.disconnect();
      pararDeObservarTema?.();
      if (cenaThree) descartarCena(cenaThree);
      // Atlas criado mas cena nunca montada: a textura não está na cena.
      else atlas?.textura.dispose();
      cena?.descartar();
    }

    function falhar(): void {
      // O fallback já está pintado: falha da GPU nunca afeta queries ou rotas.
      callbacks.current.onLost?.();
      cleanup();
    }

    async function montar(): Promise<void> {
      try {
        atlas = await criarAtlasAscii(GLIFOS_ATMOSFERA);
      } catch {
        falhar();
        return;
      }
      if (parado) {
        atlas.textura.dispose();
        return;
      }
      uniformes.uAtlas.value = atlas.textura;
      const quadro = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: uniformes,
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          precision: "mediump",
        }),
      );
      quadro.frustumCulled = false;
      cenaThree = new THREE.Scene();
      cenaThree.add(quadro);

      try {
        cena = montarCena({
          canvas,
          alvo: canvas.parentElement ?? canvas,
          fps: FPS,
          maxDpr: MAX_DPR,
          antialias: false,
          aoQuadro: draw,
          aoPerderContexto: falhar,
        });
        if (!cena) throw new Error("WebGL indisponível");
        aplicarPaleta();
        pararDeObservarTema = observarTema(aplicarPaleta);
        tamanho = new ResizeObserver(() => { redimensionar = true; });
        tamanho.observe(canvas);
        cena.iniciar();
      } catch {
        falhar();
      }
    }

    void montar();
    return cleanup;
  }, [canvasRef]);
}
