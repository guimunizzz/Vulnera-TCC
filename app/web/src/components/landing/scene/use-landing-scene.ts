/**
 * components/landing/scene/use-landing-scene.ts
 *
 * O QUE FAZ
 * Monta a cena narrativa ASCII da landing: um quad em tela cheia, fixo atrás
 * do conteúdo, em que cada célula de caractere conta o ato atual do scroll
 * (0 a 5 — `docs/LANDING_NARRATIVA.md`).
 *
 * POR QUE EXISTE / COMO
 * - Renderer, loop, pausa com aba oculta, perda de contexto, descarte e cores
 *   vêm do kit `src/three/`; o atlas de glifos, de `src/three/ascii.ts`.
 * - Um ScrollTrigger único lê o scroll; `gsap.quickTo` suaviza o valor e o
 *   escreve num objeto simples que o loop lê. Nenhum `setState` por quadro.
 * - Render sob demanda: o loop do kit roda no orçamento de 30 fps, mas só
 *   desenha quando o progresso, o tema ou o tamanho mudam, ou num "tique" do
 *   cintilar (poucos por segundo). Parada, a cena quase não usa GPU.
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
import { criarAtlasAscii, type AtlasAscii } from "../../../three/ascii";
import { gsap, ScrollTrigger } from "../motion/gsap";
import { EASE_LANDING, SCRUB_LANDING } from "../motion/tokens";
import {
  CELULA_LANDING_PX,
  FPS_CENA,
  GLIFOS,
  MAX_DPR_CENA,
  OPACIDADE_CENA,
  RAIO_DO_GRUPO_PX,
  TIQUES_POR_SEGUNDO,
  calcularMarcos,
  mapearProgresso,
} from "./config";
import { FRAGMENT_ASCII, VERTEX_ASCII } from "./shaders";

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
    let sujo = true;
    let ultimoProgresso = Number.NaN;
    let ultimoTique = -1;
    let pararDeObservarTema: (() => void) | undefined;
    let tamanho: ResizeObserver | undefined;
    let gatilho: ScrollTrigger | undefined;
    // Clique no fundo = gota d'água (src/three/gotas.ts).
    const gotas = criarGotas({
      canvas,
      tempoAtual: () => tempo,
      dpr: () => cena?.renderer.getPixelRatio() ?? 1,
      aoCair: () => { sujo = true; },
    });
    // O loop lê daqui; o ScrollTrigger escreve (suavizado).
    const progresso = { valor: 0 };
    let marcos: number[] = [];

    const uniformes = {
      uAtlas: { value: null as THREE.Texture | null },
      uTotalGlifos: { value: Array.from(GLIFOS).length },
      uCelula: { value: new THREE.Vector2(CELULA_LANDING_PX, CELULA_LANDING_PX * 2) },
      uResolucao: { value: new THREE.Vector2(1, 1) },
      uProgresso: { value: 0 },
      ...gotas.uniformes,
      uTique: { value: 0 },
      uRaioDoGrupo: { value: RAIO_DO_GRUPO_PX },
      uAlfaSaudavel: { value: OPACIDADE_CENA.saudavel },
      uAlfaDestaque: { value: OPACIDADE_CENA.destaque },
      uAlfaFeixe: { value: OPACIDADE_CENA.feixe },
      uCorBase: { value: new THREE.Color() },
      uCorNeon: { value: new THREE.Color() },
      uCorGlitch: { value: new THREE.Color() },
      uCorBaixa: { value: new THREE.Color() },
      uCorMedia: { value: new THREE.Color() },
      uCorAlta: { value: new THREE.Color() },
      uCorCritica: { value: new THREE.Color() },
      uCorResolvido: { value: new THREE.Color() },
    };
    // O shader ignora a câmera; o renderer só exige uma.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    function aplicarPaleta(): void {
      for (const [uniforme, token] of Object.entries(TOKENS)) {
        lerCorDoToken(canvas, token, uniformes[uniforme as keyof typeof TOKENS].value);
      }
      sujo = true;
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
        uniformes.uRaioDoGrupo.value = RAIO_DO_GRUPO_PX * dpr;
        redimensionar = false;
        sujo = true;
      }
      tempo += delta;
      const tique = Math.floor(tempo * TIQUES_POR_SEGUNDO);
      const p = progresso.valor;
      // Com onda viva, todo quadro do loop desenha; sem ela, só tiques e scroll.
      const mudou = sujo || gotas.ativa(tempo) || Math.abs(p - ultimoProgresso) > 1e-4 || tique !== ultimoTique;
      if (pronto && !mudou) return;
      uniformes.uProgresso.value = p;
      uniformes.uTempo.value = tempo;
      uniformes.uTique.value = tique;
      ultimoProgresso = p;
      ultimoTique = tique;
      sujo = false;
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
        atlas = await criarAtlasAscii(GLIFOS);
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
          vertexShader: VERTEX_ASCII,
          fragmentShader: FRAGMENT_ASCII,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          // Coordenadas de célula e cores: mediump sobra, e é mais barato em GPU móvel.
          precision: "mediump",
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
