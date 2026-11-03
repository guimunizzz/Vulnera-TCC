/**
 * Atmosfera ASCII da área autenticada: um campo esparso de caracteres de
 * terminal e alguns fluxos de dados lentos, em baixo contraste, atrás das
 * superfícies opacas do produto. Substitui as ondas e órbitas (refactor
 * web-motion-3d, Fase 4) com a mesma regra da ADR-041: um canvas, decoração,
 * nada sobre dado. Duas passadas de tela cheia: a lógica roda uma vez por
 * célula numa textura do tamanho da grade (`src/three/grade-celulas.ts`) e a
 * passada de tela só carimba o glifo do atlas de `src/three/ascii.ts`.
 * Movimento contínuo a 60 fps (pedido do Rafael, 2026-11-03: os "tiques"
 * davam sensação de lag): o campo respira, a chuva desce sem degraus e a
 * gota do clique (`src/three/gotas.ts`) ondula. Só a troca de glifo segue em
 * tiques — trocar caractere é discreto por natureza. O loop do kit pausa com
 * a aba oculta e com o canvas fora da tela. Consumido somente pelo canvas lazy; não atualiza
 * estado React por frame. Renderer, loop, pausas, contexto perdido, descarte
 * e cores vêm do kit `src/three/`.
 */
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { montarCena, type CenaMontada } from "../../../three/scene-host";
import { descartarCena } from "../../../three/dispose";
import { lerCorDoToken, observarTema, temaAtual } from "../../../three/palette";
import { criarAtlasAscii, GLSL_ASCII, type AtlasAscii } from "../../../three/ascii";
import { criarGotas, GLSL_GOTAS, GOTA } from "../../../three/gotas";
import { criarGradeDeCelulas, GLSL_LER_CELULAS, VERTEX_TELA_CHEIA } from "../../../three/grade-celulas";

interface Options {
  onReady?: () => void;
  onLost?: () => void;
}

const FPS = 60;
const MAX_DPR = 1.5;
/** Largura da célula em px CSS: maior que a da landing — aqui é só textura. */
const CELULA_PX = 14;
/** Ritmo das trocas de glifo e da velocidade-base da chuva (linhas/s). */
const TIQUES_POR_SEGUNDO = 4;
/**
 * Rampa calma e o traço dos fluxos. Sem dígitos: no produto número é dado, e
 * um "0" ou "1" solto ao lado de um KPI, rótulo ou aba seria lido como tal.
 * Nada de alerta ou severidade no fundo do produto.
 */
export const GLIFOS_ATMOSFERA = " .·:-+|";
/**
 * Opacidade máxima dos glifos por tema. Subiu a pedido do Rafael (o fundo
 * estava difícil de ver) até o limite em que o texto secundário do produto
 * segue AA mesmo com um glifo cruzando a letra (7,7:1 no escuro, 6,2:1 no
 * claro); cabeçalhos soltos sobre o fundo têm véu (`.atmosfera-veu`).
 */
const OPACIDADE = { dark: 0.3, light: 0.24 } as const;

/**
 * Passada 1: uma execução por célula (`src/three/grade-celulas.ts`). Grava
 * glifo, mistura apagada→tinta (0–1) e alfa. Por pixel, esta lógica custava
 * ~200× mais do que precisa (14 × 25 px por célula).
 */
const FRAGMENT_CELULAS = /* glsl */ `
${GLSL_ASCII}

uniform float uTique;
uniform float uTempo;

void main() {
  vec2 celula = floor(gl_FragCoord.xy);
  vec2 grade = gradeDaTela();
  float r = hashCelula(celula);

  // Campo estático esparso (≈ 20% das células), com troca rara de glifo por
  // tique. Rampa puxada para os glifos leves (. · :).
  float presente = step(0.8, r);
  float cintila = step(0.96, hashCelula(celula + vec2(uTique, 0.0)));
  float sorteio = mix(hashCelula(celula + 29.0), hashCelula(celula + vec2(uTique, 5.0)), cintila);
  float indice = 1.0 + floor(sorteio * sorteio * 5.0);

  // Fluxos de dados: poucas colunas (≈ 6%) com um rastro descendo devagar.
  // A cabeça anda em tempo contínuo e acende a próxima célula aos poucos:
  // a descida não tem degraus mesmo com o glifo preso à grade.
  float coluna = hashCelula(vec2(celula.x, 1.0));
  float ativa = step(0.94, coluna);
  float ciclo = grade.y + 14.0;
  float cabeca = mod(uTempo * ${TIQUES_POR_SEGUNDO.toFixed(1)} * (0.6 + coluna) + coluna * ciclo * 7.0, ciclo);
  float distancia = cabeca - (grade.y - 1.0 - celula.y);
  float rastro = ativa * smoothstep(-1.0, 0.0, distancia) * (1.0 - smoothstep(0.0, 9.0, distancia));
  // O rastro alterna ":" e "|": chuva de terminal, sem caractere legível.
  if (rastro > 0.01) indice = mix(3.0, 6.0, step(0.5, hashCelula(celula + vec2(uTique, 9.0))));

  // Respiração lenta e dessincronizada do campo: brilho contínuo, sem salto.
  float respira = 0.75 + 0.25 * sin(uTempo * 0.9 + r * 6.2832);
  float alfa = max(presente * 0.75 * respira, rastro);
  // Mais presente no topo, sem sumir embaixo.
  float altura = (celula.y + 0.5) / grade.y;
  alfa *= mix(0.6, 1.0, altura);
  float tinta = max(rastro, step(0.94, r));

  // Alfa relativo (0–1): o teto por tema (uAlfa) entra na passada de tela.
  gl_FragColor = vec4(indice / 255.0, tinta, clamp(alfa, 0.0, 1.0), 1.0);
}
`;

/** Passada 2: por pixel — onda da gota, cor e glifo do atlas. */
const FRAGMENT_TELA = /* glsl */ `
${GLSL_ASCII}
${GLSL_GOTAS}
${GLSL_LER_CELULAS}

uniform float uGotasAtivas;
uniform float uAlfa;
uniform vec3 uCorTinta;
uniform vec3 uCorApagada;

void main() {
  // Água: a onda das gotas desloca a leitura da grade (refração). Sem gota
  // viva, o laço das gotas nem roda.
  vec4 onda = uGotasAtivas > 0.5 ? ondaDasGotas(gl_FragCoord.xy) : vec4(0.0);
  vec2 pos = gl_FragCoord.xy - onda.xy * uCelula.x * ${GOTA.deslocamentoCelulas.toFixed(2)};
  vec4 dado = lerCelula(celulaEm(pos));
  float indice = byte(dado.r);
  vec3 cor = mix(uCorApagada, uCorTinta, dado.g);
  float alfa = dado.b * uAlfa;

  // Crista da onda: anel de glifos da rampa na cor de tinta. Limitado a uAlfa,
  // o mesmo teto do campo (o contraste do texto não muda com a gota).
  // A altura raramente passa de 0,5 longe do centro: normaliza para o anel aparecer.
  float crista = smoothstep(0.04, 0.45, onda.z);
  if (uAlfa * crista > alfa) {
    indice = 1.0 + floor(crista * 4.99);
    cor = uCorTinta;
    alfa = uAlfa * crista;
  }
  alfa = max(alfa, min(alfa * (1.0 + 0.6 * onda.w), uAlfa));

  gl_FragColor = vec4(cor, coberturaDoGlifoEm(indice, pos) * alfa);
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
    let redimensionar = true;
    let tamanho: ResizeObserver | undefined;
    let pararDeObservarTema: (() => void) | undefined;

    // Clique no fundo = gota d'água.
    const gotas = criarGotas({
      canvas,
      tempoAtual: () => tempo,
      dpr: () => cena?.renderer.getPixelRatio() ?? 1,
    });

    const uniformes = {
      ...gotas.uniformes,
      uGotasAtivas: { value: 0 },
      uAtlas: { value: null as THREE.Texture | null },
      uTotalGlifos: { value: Array.from(GLIFOS_ATMOSFERA).length },
      uCelula: { value: new THREE.Vector2(CELULA_PX, CELULA_PX * 2) },
      uResolucao: { value: new THREE.Vector2(1, 1) },
      uTique: { value: 0 },
      uAlfa: { value: OPACIDADE.dark as number },
      uCorTinta: { value: new THREE.Color() },
      uCorApagada: { value: new THREE.Color() },
    };
    // Passada 1 (uma vez por célula) → textura; a passada 2 lê dela.
    const grade = criarGradeDeCelulas(FRAGMENT_CELULAS, uniformes);
    // O shader ignora a câmera; o renderer só exige uma.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    function aplicarPaleta(): void {
      lerCorDoToken(canvas, "--color-ambient-ink", uniformes.uCorTinta.value);
      lerCorDoToken(canvas, "--color-ambient-muted", uniformes.uCorApagada.value);
      uniformes.uAlfa.value = OPACIDADE[temaAtual()];
    }

    // Desenha todo quadro do loop (até 60 fps): o movimento é contínuo.
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
        grade.redimensionar(uniformes.uResolucao.value, uniformes.uCelula.value);
        redimensionar = false;
      }
      tempo += delta;
      uniformes.uTique.value = Math.floor(tempo * TIQUES_POR_SEGUNDO);
      uniformes.uTempo.value = tempo;
      uniformes.uGotasAtivas.value = gotas.ativa(tempo) ? 1 : 0;
      grade.desenhar(renderer);
      renderer.render(cenaThree, camera);
      if (!pronto) {
        pronto = true;
        callbacks.current.onReady?.();
      }
    }

    function cleanup(): void {
      if (parado) return;
      parado = true;
      gotas.parar();
      grade.descartar();
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
          uniforms: { ...uniformes, ...grade.uniformes },
          vertexShader: VERTEX_TELA_CHEIA,
          fragmentShader: FRAGMENT_TELA,
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
