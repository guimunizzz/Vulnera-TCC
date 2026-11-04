/**
 * Atmosfera ASCII da área autenticada: as ondas do fundo antigo desenhadas
 * com glifos, um campo esparso de caracteres e alguns fluxos de dados, sob
 * uma aurora lenta violeta → ciano → magenta, atrás das superfícies do
 * produto. Mesma regra da ADR-041: um canvas, decoração, nada sobre dado.
 *
 * Duas passadas de tela cheia: a lógica roda uma vez por célula numa textura
 * do tamanho da grade (`src/three/grade-celulas.ts`) e a passada de tela só
 * carimba o glifo do atlas de `src/three/ascii.ts`, com o brilho da chuva.
 * Movimento contínuo a 60 fps. Só a troca de glifo segue em tiques.
 *
 * Interação (pedido do Rafael, 2026-11-03): hover discreto — os glifos perto
 * do ponteiro acendem — e uma varredura que desce pela tela na troca de
 * página e, sozinha, a cada `VARREDURA.intervaloS`. A gota do clique ficou só
 * na landing. Números em `atmosfera-config.ts`.
 *
 * Renderer, loop, pausas, contexto perdido, descarte e cores vêm do kit
 * `src/three/`. Consumido somente pelo canvas lazy; não atualiza estado React
 * por quadro.
 */
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { montarCena, type CenaMontada } from "../../../three/scene-host";
import { descartarCena } from "../../../three/dispose";
import { lerCorDoToken, observarTema, temaAtual } from "../../../three/palette";
import { criarAtlasAscii, GLSL_ASCII, type AtlasAscii } from "../../../three/ascii";
import { criarGradeDeCelulas, GLSL_LER_CELULAS, VERTEX_TELA_CHEIA } from "../../../three/grade-celulas";
import {
  CELULA_ATMOSFERA_PX,
  FPS_ATMOSFERA,
  GLIFO_ATMOSFERA as G,
  GLIFOS_ATMOSFERA,
  HOVER,
  LAVAGEM_AURORA,
  MAX_DPR_ATMOSFERA,
  ONDAS,
  OPACIDADE_ATMOSFERA,
  TIQUES_ATMOSFERA,
  VARREDURA,
} from "./atmosfera-config";

export { GLIFOS_ATMOSFERA } from "./atmosfera-config";

interface Options {
  onReady?: () => void;
  onLost?: () => void;
  /** Muda a cada troca de página: dispara a varredura de transição. */
  chaveDeRota?: string;
}

const f = (n: number) => n.toFixed(4);

/**
 * Passada 1: uma execução por célula. Grava
 *   r = (glifo + 128 se a célula brilha) / 255 · g = tinta (apagada → cor)
 *   b = matiz da aurora (0 violeta · 0,5 ciano · 1 magenta) · a = alfa (0–1,
 *   relativo ao teto do tema, aplicado na passada de tela).
 */
const FRAGMENT_CELULAS = /* glsl */ `
${GLSL_ASCII}

uniform float uTique;
uniform float uTempo;
uniform vec3 uPonteiro;
uniform float uRaioHover;
uniform float uVarreduraInicio;

// Curva i das ondas antigas, em coordenadas de recorte (x de -1,2 a 1,2).
float curvaY(float x, float i, float t) {
  return ${f(ONDAS.topo)} - i * ${f(ONDAS.passo)}
    + sin(x * 2.3 + t * 0.22 + i * 0.08) * 0.22
    + cos(x * 4.1 - t * 0.13) * 0.09;
}
float curvaDy(float x, float i, float t) {
  return 2.3 * cos(x * 2.3 + t * 0.22 + i * 0.08) * 0.22 - 4.1 * sin(x * 4.1 - t * 0.13) * 0.09;
}

void main() {
  vec2 celula = floor(gl_FragCoord.xy);
  vec2 grade = gradeDaTela();
  vec2 clip = (celula + 0.5) / grade * 2.0 - 1.0;
  float r = hashCelula(celula);
  float t = uTempo;

  // --- Campo esparso (≈ 20% das células), respirando devagar; troca rara de
  // glifo por tique. Rampa puxada para os glifos leves (. · :).
  float presente = step(0.8, r);
  float cintila = step(0.96, hashCelula(celula + vec2(uTique, 0.0)));
  float sorteio = mix(hashCelula(celula + 29.0), hashCelula(celula + vec2(uTique, 5.0)), cintila);
  float indice = ${G.rampaInicio}.0 + floor(sorteio * sorteio * ${G.rampaTotal}.0);
  float respira = 0.75 + 0.25 * sin(t * 0.9 + r * 6.2832);
  float alfa = presente * 0.6 * respira * mix(0.6, 1.0, (celula.y + 0.5) / grade.y);
  float tinta = step(0.94, r);
  float brilha = 0.0;

  // --- Chuva: poucas colunas (≈ 6%); a cabeça anda em tempo contínuo e
  // acende a próxima célula aos poucos. A célula da cabeça brilha.
  float coluna = hashCelula(vec2(celula.x, 1.0));
  float ativa = step(0.94, coluna);
  float ciclo = grade.y + 14.0;
  float cabeca = mod(t * ${TIQUES_ATMOSFERA.toFixed(1)} * (0.6 + coluna) + coluna * ciclo * 7.0, ciclo);
  float distancia = cabeca - (grade.y - 1.0 - celula.y);
  float rastro = ativa * smoothstep(-1.0, 0.0, distancia) * (1.0 - smoothstep(0.0, 9.0, distancia));
  if (rastro > 0.01) {
    indice = mix(${G.dois_pontos}.0, ${G.barra}.0, step(0.5, hashCelula(celula + vec2(uTique, 9.0))));
    alfa = max(alfa, rastro);
    tinta = max(tinta, rastro);
    brilha = ativa * step(-0.5, distancia) * step(distancia, 0.9);
  }

  // --- Ondas: a curva mais próxima, em células; o glifo segue a inclinação
  // (- / \\) e a linha esmaece entre células, sem andar em degraus.
  float x = clip.x * 1.2;
  float alturaCelula = 2.0 / grade.y;
  float dMin = 1e4;
  float inclinacao = 0.0;
  float curva = 0.0;
  float yTopo = -1e4;
  float yBase = 1e4;
  for (int i = 0; i < ${ONDAS.quantidade}; i++) {
    float fi = float(i);
    float y = curvaY(x, fi, t);
    yTopo = max(yTopo, y);
    yBase = min(yBase, y);
    float d = abs(clip.y - y) / alturaCelula;
    if (d < dMin) { dMin = d; inclinacao = curvaDy(x, fi, t); curva = fi; }
  }
  // Inclinação em px da tela (o glifo "/" é a diagonal da célula).
  float inclinacaoPx = inclinacao * 1.2 * uResolucao.y / uResolucao.x;
  float linha = 1.0 - smoothstep(0.35, 0.85, dMin);
  // Um brilho percorre cada curva devagar: a onda "corre".
  float corre = 0.65 + 0.35 * sin(x * 3.0 - t * 0.8 + curva * 1.7);
  if (linha > 0.02) {
    indice = abs(inclinacaoPx) < 0.22
      ? (step(0.5, hashCelula(celula + 13.0)) > 0.5 ? ${G.traco}.0 : ${G.til}.0)
      : (inclinacaoPx > 0.0 ? ${G.subida}.0 : ${G.descida}.0);
    alfa = max(alfa, linha * corre);
    tinta = max(tinta, linha);
  } else if (clip.y < yTopo && clip.y > yBase && step(0.82, hashCelula(celula + 31.0)) > 0.5) {
    // Entre as curvas, poeira fina: a faixa das ondas tem corpo.
    indice = ${G.rampaInicio}.0;
    alfa = max(alfa, 0.35 * respira);
  }

  // --- Aurora: matiz lento no espaço e no tempo, que tinge o que estiver ali.
  float aurora = 0.5 + 0.5 * sin(clip.x * 1.4 + t * 0.05 + sin(clip.y * 1.9 - t * 0.04) * 1.2);

  // --- Hover discreto: perto do ponteiro, mais glifos aparecem e acendem.
  vec2 centroPx = (celula + 0.5) * uCelula;
  float hover = uPonteiro.z * (1.0 - smoothstep(0.0, uRaioHover, distance(centroPx, uPonteiro.xy)));
  if (hover > 0.01) {
    float revela = step(0.55, r) * hover;
    if (alfa < revela * 0.8) indice = ${G.rampaInicio}.0 + floor(r * r * ${G.rampaTotal}.0);
    alfa = max(alfa, revela * 0.8);
    alfa = min(1.0, alfa * (1.0 + 0.5 * hover));
    tinta = max(tinta, hover);
    aurora = mix(aurora, 0.5, hover * 0.6);
  }

  // --- Varredura: uma faixa desce pela tela (troca de página e periódica).
  float tv = t - uVarreduraInicio;
  if (tv > 0.0 && tv < ${f(VARREDURA.duracao)}) {
    float frente = 1.15 - 2.3 * (tv / ${f(VARREDURA.duracao)});
    float dv = (clip.y - frente) / alturaCelula;
    // Frente nítida, rastro longo para cima.
    float banda = dv < 0.0 ? exp(-dv * dv / 2.0) : exp(-dv / 6.0);
    banda *= 1.0 - 0.4 * (tv / ${f(VARREDURA.duracao)});
    if (banda > 0.04) {
      if (alfa < banda) indice = banda > 0.7 ? ${G.igual}.0 : ${G.traco}.0;
      alfa = max(alfa, banda);
      tinta = max(tinta, banda);
      aurora = mix(aurora, 0.5, banda);
      brilha = max(brilha, step(0.85, banda));
    }
  }

  gl_FragColor = vec4((indice + 128.0 * brilha) / 255.0, tinta, aurora, clamp(alfa, 0.0, 1.0));
}
`;

/** Passada 2: por pixel — lavagem da aurora, cor, glifo do atlas e brilho. */
const FRAGMENT_TELA = /* glsl */ `
${GLSL_ASCII}
${GLSL_LER_CELULAS}

uniform float uAlfa;
uniform vec3 uCorTinta;
uniform vec3 uCorApagada;
uniform vec3 uCorCiano;
uniform vec3 uCorMagenta;
uniform float uTempo;

vec3 corDaAurora(float a) {
  return a < 0.5 ? mix(uCorTinta, uCorCiano, a * 2.0) : mix(uCorCiano, uCorMagenta, a * 2.0 - 1.0);
}

void main() {
  vec4 dado = lerCelula(celulaDaTela());
  float codigo = byte(dado.r);
  float brilha = step(127.5, codigo);
  float indice = codigo - 128.0 * brilha;
  vec3 corAurora = corDaAurora(dado.b);
  vec3 cor = mix(uCorApagada, corAurora, dado.g);
  float glifo = coberturaDoGlifo(indice) * dado.a * uAlfa;

  // Brilho: a célula acesa ganha um halo suave em volta do glifo.
  vec2 local = fract(gl_FragCoord.xy / uCelula) - 0.5;
  float halo = brilha * (1.0 - smoothstep(0.05, 0.75, length(local * vec2(1.0, 0.6)))) * 0.45 * uAlfa;
  if (brilha > 0.5) cor = mix(cor, uCorCiano, 0.5);

  // Lavagem da aurora: manchas grandes e lentas por trás dos glifos.
  vec2 uv = gl_FragCoord.xy / uResolucao;
  float mancha = smoothstep(0.35, 1.0, 0.5 + 0.5 * sin(uv.x * 3.1 + uTempo * 0.06) * cos(uv.y * 2.3 - uTempo * 0.05));
  float lavagem = mancha * ${f(LAVAGEM_AURORA)} * uAlfa;

  float alfa = max(glifo, halo);
  vec3 corFinal = alfa > 0.0001 ? cor : corAurora;
  float alfaFinal = 1.0 - (1.0 - alfa) * (1.0 - lavagem);
  // Pré-mistura simples: a lavagem tinge com a cor da aurora por baixo.
  vec3 mistura = (cor * alfa + corAurora * lavagem * (1.0 - alfa)) / max(alfaFinal, 0.0001);
  gl_FragColor = vec4(alfa > 0.0001 ? mistura : corFinal, alfaFinal);
  #include <colorspace_fragment>
}
`;

export function useDashboardScene(canvasRef: RefObject<HTMLCanvasElement | null>, options: Options): void {
  const callbacks = useRef(options);
  callbacks.current = options;
  // A varredura de transição é pedida pela troca de rota e consumida pelo loop.
  const varreduraPedida = useRef(false);
  const primeiraRota = useRef(true);

  useEffect(() => {
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    varreduraPedida.current = true;
  }, [options.chaveDeRota]);

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
    let ultimaVarredura = Number.NEGATIVE_INFINITY;
    let tamanho: ResizeObserver | undefined;
    let pararDeObservarTema: (() => void) | undefined;
    // Ponteiro em px do buffer (y de baixo para cima) e força-alvo do hover.
    const alvoDoPonteiro = { x: 0, y: 0, forca: 0 };

    const uniformes = {
      uAtlas: { value: null as THREE.Texture | null },
      uTotalGlifos: { value: Array.from(GLIFOS_ATMOSFERA).length },
      uCelula: { value: new THREE.Vector2(CELULA_ATMOSFERA_PX, CELULA_ATMOSFERA_PX * 2) },
      uResolucao: { value: new THREE.Vector2(1, 1) },
      uTique: { value: 0 },
      uTempo: { value: 0 },
      uPonteiro: { value: new THREE.Vector3(0, 0, 0) },
      uRaioHover: { value: HOVER.raioPx as number },
      uVarreduraInicio: { value: -1e4 },
      uAlfa: { value: OPACIDADE_ATMOSFERA.dark as number },
      uCorTinta: { value: new THREE.Color() },
      uCorApagada: { value: new THREE.Color() },
      uCorCiano: { value: new THREE.Color() },
      uCorMagenta: { value: new THREE.Color() },
    };
    // Passada 1 (uma vez por célula) → textura; a passada 2 lê dela.
    const grade = criarGradeDeCelulas(FRAGMENT_CELULAS, uniformes);
    // O shader ignora a câmera; o renderer só exige uma.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    function aplicarPaleta(): void {
      lerCorDoToken(canvas, "--color-ambient-ink", uniformes.uCorTinta.value);
      lerCorDoToken(canvas, "--color-ambient-muted", uniformes.uCorApagada.value);
      lerCorDoToken(canvas, "--color-ambient-cyan", uniformes.uCorCiano.value);
      lerCorDoToken(canvas, "--color-ambient-magenta", uniformes.uCorMagenta.value);
      uniformes.uAlfa.value = OPACIDADE_ATMOSFERA[temaAtual()];
    }

    // Hover: só mouse/caneta (toque não tem "passar por cima"). Lê a caixa no
    // evento, não por quadro.
    function aoMoverPonteiro(evento: PointerEvent): void {
      if (evento.pointerType === "touch") return;
      const caixa = canvas.getBoundingClientRect();
      const dpr = cena?.renderer.getPixelRatio() ?? 1;
      alvoDoPonteiro.x = (evento.clientX - caixa.left) * dpr;
      alvoDoPonteiro.y = (caixa.bottom - evento.clientY) * dpr;
      alvoDoPonteiro.forca = 1;
    }
    function aoSairDaJanela(): void {
      alvoDoPonteiro.forca = 0;
    }
    window.addEventListener("pointermove", aoMoverPonteiro, { passive: true });
    document.documentElement.addEventListener("pointerleave", aoSairDaJanela);

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
        uniformes.uCelula.value.set(CELULA_ATMOSFERA_PX * dpr, (CELULA_ATMOSFERA_PX * dpr) / atlas.proporcao);
        uniformes.uRaioHover.value = HOVER.raioPx * dpr;
        grade.redimensionar(uniformes.uResolucao.value, uniformes.uCelula.value);
        redimensionar = false;
      }
      tempo += delta;

      // Varredura: na troca de página e, sem troca, a cada intervalo.
      if (varreduraPedida.current || tempo - ultimaVarredura > VARREDURA.intervaloS) {
        varreduraPedida.current = false;
        ultimaVarredura = tempo;
        uniformes.uVarreduraInicio.value = tempo;
      }

      // Ponteiro suavizado: o brilho acompanha sem tremer nem dar saltos.
      const ponteiro = uniformes.uPonteiro.value;
      const k = HOVER.suavizacao;
      if (ponteiro.z < 0.001 && alvoDoPonteiro.forca > 0) ponteiro.set(alvoDoPonteiro.x, alvoDoPonteiro.y, 0);
      ponteiro.x += (alvoDoPonteiro.x - ponteiro.x) * k;
      ponteiro.y += (alvoDoPonteiro.y - ponteiro.y) * k;
      ponteiro.z += (alvoDoPonteiro.forca - ponteiro.z) * k * 0.5;

      uniformes.uTique.value = Math.floor(tempo * TIQUES_ATMOSFERA);
      uniformes.uTempo.value = tempo;
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
      window.removeEventListener("pointermove", aoMoverPonteiro);
      document.documentElement.removeEventListener("pointerleave", aoSairDaJanela);
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
          fps: FPS_ATMOSFERA,
          maxDpr: MAX_DPR_ATMOSFERA,
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
