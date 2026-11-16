/**
 * components/landing/scene/use-landing-scene.ts
 *
 * O QUE FAZ
 * Monta a cena narrativa da landing: um quad em tela cheia, fixo atrás do
 * conteúdo, que conta o ato atual do scroll (0 a 5 —
 * `docs/LANDING_NARRATIVA.md`). Atos 0–2 em células de caractere ASCII; a
 * partir do ato 3 as células viram pinceladas (`pintura.ts`, ADR-054).
 *
 * POR QUE EXISTE / COMO
 * - Renderer, loop, pausa com aba oculta, perda de contexto, descarte e cores
 *   vêm do kit `src/three/`; o atlas de glifos, de `src/three/ascii.ts`.
 * - Um ScrollTrigger único lê o scroll; `gsap.quickTo` suaviza o valor e o
 *   escreve num objeto simples que o loop lê. Nenhum `setState` por quadro.
 * - Movimento contínuo: desenha todo quadro do loop do kit, a 60 fps (antes
 *   era render sob demanda a 30 fps em "tiques", que passava sensação de
 *   lag). O loop pausa com a aba oculta e com o canvas fora da tela.
 * - O atlas espera a fonte carregar (assíncrono). Se a cena for desmontada
 *   antes, nada é montado e a textura é descartada.
 * - O `<canvas>` é criado aqui a cada montagem e removido no descarte: o
 *   descarte chama `forceContextLoss()`, e reaproveitar o elemento (StrictMode
 *   em desenvolvimento) entregaria à remontagem um contexto já morto.
 *
 * QUEM USA
 * `landing-scene-canvas.tsx`, carregado só por `lazy()`.
 */

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { montarCena, type CenaMontada } from "../../../three/scene-host";
import { descartarCena } from "../../../three/dispose";
import { lerCorDoToken, observarTema } from "../../../three/palette";
import { criarGotas } from "../../../three/gotas";
import { criarGradeDeCelulas } from "../../../three/grade-celulas";
import { criarAtlasAscii, type AtlasAscii } from "../../../three/ascii";
import { criarPintura } from "./pintura";
import { gsap, ScrollTrigger } from "../motion/gsap";
import { EASE_LANDING, SCRUB_LANDING } from "../motion/tokens";
import {
  ALTURA_CELULA_LANDING_PX,
  CELULA_LANDING_PX,
  FONTE_LANDING_PX,
  FPS_CENA,
  GLIFOS,
  MAX_DPR_CENA,
  OPACIDADE_CENA,
  PESO_FONTE_LANDING,
  TIQUES_POR_SEGUNDO,
  calcularMarcos,
  mapearProgresso,
  TRANSICAO_CENA,
} from "./config";
import { FRAGMENT_CELULAS, FRAGMENT_TELA, VERTEX_ASCII } from "./shaders";

interface Opcoes {
  onReady?: () => void;
  onLost?: () => void;
}

/** Tokens lidos em runtime; trocam junto com o tema. */
const TOKENS = {
  uCorBase: "--vx-accent",
  uCorNeon: "--vx-cyan",
  uCorGlitch: "--vx-magenta",
  uCorBaixa: "--color-severity-low",
  uCorMedia: "--color-severity-medium",
  uCorAlta: "--color-severity-high",
  uCorCritica: "--color-severity-critical",
  uCorResolvido: "--color-success",
} as const;

export function useLandingScene(hostRef: RefObject<HTMLElement | null>, opcoes: Opcoes): void {
  const callbacks = useRef(opcoes);
  callbacks.current = opcoes;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.landingScene = "true";
    canvas.dataset.ready = "false";
    canvas.className = "vx-cena-canvas pointer-events-none absolute inset-0 h-full w-full";
    host.append(canvas);

    let cena: CenaMontada | null = null;
    let cenaThree: THREE.Scene | null = null;
    let atlas: AtlasAscii | null = null;
    let parado = false;
    let pronto = false;
    let tempo = 0;
    let redimensionar = true;
    let pararDeObservarTema: (() => void) | undefined;
    let tamanho: ResizeObserver | undefined;
    let gatilho: ScrollTrigger | undefined;
    // Clique no fundo = gota d'água (src/three/gotas.ts).
    const gotas = criarGotas({
      canvas,
      tempoAtual: () => tempo,
      dpr: () => cena?.renderer.getPixelRatio() ?? 1,
    });
    // O loop lê daqui; o ScrollTrigger escreve (suavizado).
    const progresso = { valor: 0 };
    let marcos: number[] = [];
    let atoAnterior: number | null = null;

    const uniformes = {
      uAtlas: { value: null as THREE.Texture | null },
      uTotalGlifos: { value: Array.from(GLIFOS).length },
      uCelula: { value: new THREE.Vector2(CELULA_LANDING_PX, CELULA_LANDING_PX * 2) },
      uResolucao: { value: new THREE.Vector2(1, 1) },
      uProgresso: { value: 0 },
      ...gotas.uniformes,
      uGotasAtivas: { value: 0 },
      uTique: { value: 0 },
      uAlfaSaudavel: { value: OPACIDADE_CENA.saudavel },
      uAlfaDestaque: { value: OPACIDADE_CENA.destaque },
      uAlfaFeixe: { value: OPACIDADE_CENA.feixe },
      uTransicaoInicio: { value: -1e4 },
      uTransicaoSentido: { value: 1 },
      uCorBase: { value: new THREE.Color() },
      uCorNeon: { value: new THREE.Color() },
      uCorGlitch: { value: new THREE.Color() },
      uCorBaixa: { value: new THREE.Color() },
      uCorMedia: { value: new THREE.Color() },
      uCorAlta: { value: new THREE.Color() },
      uCorCritica: { value: new THREE.Color() },
      uCorResolvido: { value: new THREE.Color() },
    };
    // Passada 1 (uma vez por célula) → textura; a passada 2 lê dela. As duas
    // compartilham os mesmos objetos de uniform.
    // Camada de tinta dos atos 3–5; `uVirada` é dela e as duas passadas leem.
    const pintura = criarPintura();
    Object.assign(uniformes, pintura.uniformesDaTela);
    const grade = criarGradeDeCelulas(FRAGMENT_CELULAS, uniformes);
    // O shader ignora a câmera; o renderer só exige uma.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    function aplicarPaleta(): void {
      for (const [uniforme, token] of Object.entries(TOKENS)) {
        lerCorDoToken(canvas, token, uniformes[uniforme as keyof typeof TOKENS].value);
      }
      pintura.aplicarPaleta(canvas);
    }

    function medirMarcos(): void {
      const secoes = Array.from(document.querySelectorAll<HTMLElement>("section[data-ato]"))
        .sort((a, b) => Number(a.dataset.ato) - Number(b.dataset.ato));
      marcos = calcularMarcos(secoes.map((s) => s.getBoundingClientRect().top + window.scrollY), window.innerHeight);
    }

    function desenhar(renderer: THREE.WebGLRenderer, delta: number): void {
      if (!cenaThree || !atlas) return;
      if (redimensionar) {
        const largura = Math.max(1, canvas.clientWidth);
        const altura = Math.max(1, canvas.clientHeight);
        renderer.setSize(largura, altura, false);
        const dpr = renderer.getPixelRatio();
        uniformes.uResolucao.value.set(largura * dpr, altura * dpr);
        // Célula em px CSS × DPR: a grade não adensa em tela de alta densidade.
        uniformes.uCelula.value.set(CELULA_LANDING_PX * dpr, (CELULA_LANDING_PX * dpr) / atlas.proporcao);
        grade.redimensionar(uniformes.uResolucao.value, uniformes.uCelula.value);
        pintura.redimensionar(largura, altura, dpr, grade.uniformes.uGradeTextura.value, uniformes.uCelula.value);
        redimensionar = false;
      }
      // Primeiro quadro: compila os shaders da pintura enquanto o canvas ainda
      // está entrando, e não no meio da virada.
      if (!pronto) pintura.aquecer(renderer);
      tempo += delta;
      const tique = Math.floor(tempo * TIQUES_POR_SEGUNDO);
      const p = progresso.valor;
      // Troca de seção (ato arredondado) dispara a varredura de transição, no
      // sentido da rolagem; nunca na primeira medida nem em rajada.
      const atoAtual = Math.round(p);
      if (atoAnterior === null) atoAnterior = atoAtual;
      else if (atoAtual !== atoAnterior) {
        if (tempo - uniformes.uTransicaoInicio.value > TRANSICAO_CENA.intervaloMinimoS) {
          uniformes.uTransicaoInicio.value = tempo;
          uniformes.uTransicaoSentido.value = atoAtual > atoAnterior ? 1 : -1;
        }
        atoAnterior = atoAtual;
      }
      // Movimento contínuo: desenha todo quadro do loop (até 60 fps).
      uniformes.uProgresso.value = p;
      uniformes.uTempo.value = tempo;
      uniformes.uTique.value = tique;
      uniformes.uGotasAtivas.value = gotas.ativa(tempo) ? 1 : 0;
      pintura.desenhar(renderer, tempo, delta, p);
      // Com a virada completa todas as células estão apagadas: a passada 1 é pulada.
      if (pintura.uniformesDaTela.uVirada.value < 0.999) grade.desenhar(renderer);
      renderer.render(cenaThree, camera);
      if (!pronto) {
        pronto = true;
        canvas.dataset.ready = "true";
        callbacks.current.onReady?.();
      }
    }

    function limpar(): void {
      if (parado) return;
      parado = true;
      grade.descartar();
      pintura.descartar();
      gatilho?.kill();
      gotas.parar();
      gsap.killTweensOf(progresso);
      tamanho?.disconnect();
      pararDeObservarTema?.();
      if (cenaThree) descartarCena(cenaThree);
      // Atlas criado mas cena nunca montada: a textura não está na cena.
      else atlas?.textura.dispose();
      cena?.descartar();
      canvas.remove();
    }

    function falhar(): void {
      canvas.dataset.ready = "false";
      // O pôster continua embaixo: falha da cena não afeta a página.
      callbacks.current.onLost?.();
      limpar();
    }

    async function montar(): Promise<void> {
      try {
        // Atlas a 2× o tamanho final do glifo: nítido sem serrilhar na redução.
        const dprDoAtlas = Math.min(window.devicePixelRatio || 1, MAX_DPR_CENA);
        atlas = await criarAtlasAscii(GLIFOS, Math.round(FONTE_LANDING_PX * dprDoAtlas * 2), {
          largura: CELULA_LANDING_PX / FONTE_LANDING_PX,
          altura: ALTURA_CELULA_LANDING_PX / FONTE_LANDING_PX,
          peso: PESO_FONTE_LANDING,
        });
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
          vertexShader: VERTEX_ASCII,
          fragmentShader: FRAGMENT_TELA,
          // A passada já sai com alfa pré-multiplicado (a tinta chega assim).
          transparent: true,
          premultipliedAlpha: true,
          depthTest: false,
          depthWrite: false,
          // A leitura da tinta por pixel precisa de highp: em mediump a
          // coordenada de uma tela de 1500 px perde resolução.
          precision: "highp",
        }),
      );
      // Posições em coordenadas de recorte; não há o que recortar.
      quadro.frustumCulled = false;
      cenaThree = new THREE.Scene();
      cenaThree.add(quadro);

      try {
        cena = montarCena({
          canvas,
          alvo: canvas,
          fps: FPS_CENA,
          maxDpr: MAX_DPR_CENA,
          // Glifos já vêm suavizados do atlas; MSAA aqui só custaria GPU.
          antialias: false,
          aoQuadro: desenhar,
          aoPerderContexto: falhar,
        });
        if (!cena) throw new Error("WebGL indisponível");
        aplicarPaleta();
        pararDeObservarTema = observarTema(aplicarPaleta);
        tamanho = new ResizeObserver(() => { redimensionar = true; });
        tamanho.observe(canvas);

        const irPara = gsap.quickTo(progresso, "valor", { duration: SCRUB_LANDING.cena, ease: EASE_LANDING.saida });
        medirMarcos();
        gatilho = ScrollTrigger.create({
          start: 0,
          end: "max",
          onRefresh: (self) => {
            // Seções mudam de altura (fontes, FAQ): os marcos acompanham.
            medirMarcos();
            irPara(mapearProgresso(self.scroll(), marcos));
          },
          onUpdate: (self) => irPara(mapearProgresso(self.scroll(), marcos)),
        });
        progresso.valor = mapearProgresso(window.scrollY, marcos);
        cena.iniciar();
      } catch {
        falhar();
      }
    }

    void montar();
    return limpar;
  }, [hostRef]);
}
