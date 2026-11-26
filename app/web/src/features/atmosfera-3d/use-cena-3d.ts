/**
 * features/atmosfera-3d/use-cena-3d.ts
 *
 * O QUE FAZ
 * Hospeda uma atmosfera 3D (`variantes/`): renderer do kit `src/three/`,
 * pós-processamento (bloom só no imersivo escuro + OutputPass), ponteiro em
 * dois ritmos (efeito e câmera) com "agitação", risco suavizado, tamanho pelo
 * ResizeObserver, ping a cada `chaveDePing` nova e medição de fps.
 *
 * POR QUE O COMPOSER SEMPRE, MESMO SEM BLOOM
 * Os shaders das variantes escrevem cor linear. O `OutputPass` é quem converte
 * para sRGB; sem ele cada caminho sairia com outras cores.
 *
 * DETALHES
 *   - Variante, tema ou modo novos remontam tudo. O risco é lido a cada quadro
 *     (`obterRisco`) e perseguido devagar: quando a tela publica o dado real,
 *     a cena "respira" até ele, em vez de saltar.
 *   - O `<canvas>` nasce aqui a cada montagem e sai no descarte, como na
 *     landing: o descarte chama `forceContextLoss()`, e reaproveitar o
 *     elemento (StrictMode em desenvolvimento) entregaria um contexto morto.
 *   - O ponteiro é lido na janela (o canvas é `pointer-events: none`); o
 *     clique só pinga no modo imersivo e nunca sobre algo interativo.
 *
 * QUEM USA
 * `cena-3d-canvas.tsx` (layout autenticado) e o laboratório `/lab-3d`.
 */

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { descartarCena } from "../../three/dispose";
import { lerCorDoToken } from "../../three/palette";
import { eAlvoInterativo } from "../../three/pings";
import { montarCena } from "../../three/scene-host";
import { SEGUIR_RISCO_S } from "./config";
import type { FabricaDeVariante, ModoDaVariante, PaletaDaVariante, TemaDaVariante, Variante } from "./tipos";

/** Plataforma desenha com menos pixels: é fundo, e a GPU é de quem trabalha. */
const MAX_DPR: Record<ModoDaVariante, number> = { plataforma: 1.25, imersivo: 1.5 };
/**
 * Constantes de tempo do ponteiro (1/s). O efeito sob o cursor segue quase
 * colado (~40 ms); a câmera, bem devagar, para o paralaxe não tremer.
 */
const SEGUIR_PONTEIRO = 25;
const SEGUIR_CAMERA = 2.5;

export interface OpcoesDaCena3d {
  fabrica: FabricaDeVariante;
  tema: TemaDaVariante;
  modo: ModoDaVariante;
  /** Elemento de onde os tokens de cor são lidos (carrega o data-theme em vigor). */
  raiz: RefObject<HTMLElement>;
  /** Lido a cada quadro: o risco alvo (0–1). */
  obterRisco: () => number;
  /** Muda a cada evento que merece um ping (troca de página, seleção no grafo). */
  chaveDePing?: string;
  /** Primeiro quadro desenhado: hora de mostrar a camada. */
  aoPronta?: () => void;
  /** Chamado ~2x por segundo com o fps medido. */
  aoMedir?: (fps: number) => void;
  aoFalhar?: () => void;
}

export function useCena3d(palcoRef: RefObject<HTMLElement>, opcoes: OpcoesDaCena3d): void {
  const atual = useRef(opcoes);
  atual.current = opcoes;
  const viva = useRef<{ variante: Variante; tempo: () => number } | null>(null);
  const { fabrica, tema, modo, raiz } = opcoes;

  useEffect(() => {
    const palco = palcoRef.current;
    const elementoDosTokens = raiz.current;
    if (!palco || !elementoDosTokens) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "absolute inset-0 h-full w-full";
    palco.appendChild(canvas);

    const paleta: PaletaDaVariante = {
      fundo: lerCorDoToken(elementoDosTokens, "--color-bg-canvas"),
      tinta: lerCorDoToken(elementoDosTokens, "--color-ambient-ink"),
      apagada: lerCorDoToken(elementoDosTokens, "--color-ambient-muted"),
      ciano: lerCorDoToken(elementoDosTokens, "--color-ambient-cyan"),
      magenta: lerCorDoToken(elementoDosTokens, "--color-ambient-magenta"),
    };
    const variante = fabrica(paleta, tema, modo);
    variante.cena.background = paleta.fundo.clone();

    const alvoPonteiro = new THREE.Vector2();
    const ponteiro = new THREE.Vector2();
    const ponteiroCamera = new THREE.Vector2();
    const novo = new THREE.Vector2();
    let agitacao = 0;
    let tempo = 0;
    let risco = atual.current.obterRisco();
    let quadros = 0;
    let janela = 0;
    let avisouPronta = false;
    let composer: EffectComposer | null = null;

    const host = montarCena({
      canvas,
      alvo: canvas,
      fps: 60,
      maxDpr: MAX_DPR[modo],
      powerPreference: modo === "imersivo" ? "high-performance" : "low-power",
      antialias: false, // o composer desenha num alvo próprio; MSAA do canvas não serve
      aoQuadro: (_renderer, delta) => {
        tempo += delta;
        ponteiro.lerp(alvoPonteiro, 1 - Math.exp(-delta * SEGUIR_PONTEIRO));
        ponteiroCamera.lerp(alvoPonteiro, 1 - Math.exp(-delta * SEGUIR_CAMERA));
        agitacao *= Math.exp(-delta * 1.8);
        risco += (atual.current.obterRisco() - risco) * (1 - Math.exp(-delta / SEGUIR_RISCO_S));
        variante.atualizar({ tempo, delta, ponteiro, ponteiroCamera, agitacao, risco });
        composer?.render(delta);
        if (!avisouPronta) {
          avisouPronta = true;
          atual.current.aoPronta?.();
        }
        quadros += 1;
        janela += delta;
        if (janela >= 0.5) {
          atual.current.aoMedir?.(Math.round(quadros / janela));
          quadros = 0;
          janela = 0;
        }
      },
      aoPerderContexto: () => atual.current.aoFalhar?.(),
    });
    if (!host) {
      descartarCena(variante.cena);
      canvas.remove();
      atual.current.aoFalhar?.();
      return;
    }

    const { renderer } = host;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(variante.cena, variante.camera));
    // Bloom só no imersivo escuro: no claro lava o fundo, na plataforma pesa e chama atenção.
    const bloom = variante.bloom && tema === "dark"
      ? new UnrealBloomPass(new THREE.Vector2(1, 1), variante.bloom.forca, variante.bloom.raio, variante.bloom.limiar)
      : null;
    if (bloom) composer.addPass(bloom);
    composer.addPass(new OutputPass());

    function redimensionar(): void {
      const largura = Math.max(1, canvas.clientWidth);
      const altura = Math.max(1, canvas.clientHeight);
      renderer.setSize(largura, altura, false);
      composer!.setPixelRatio(renderer.getPixelRatio());
      composer!.setSize(largura, altura);
      variante.camera.aspect = largura / altura;
      variante.camera.updateProjectionMatrix();
      variante.redimensionar?.(largura, altura, renderer.getPixelRatio());
    }

    function lerPonteiro(evento: MouseEvent, destino: THREE.Vector2): THREE.Vector2 {
      const caixa = canvas.getBoundingClientRect();
      return destino.set(
        THREE.MathUtils.clamp(((evento.clientX - caixa.left) / caixa.width) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(-((evento.clientY - caixa.top) / caixa.height) * 2 + 1, -1, 1),
      );
    }

    function moverPonteiro(evento: PointerEvent): void {
      lerPonteiro(evento, novo);
      agitacao = Math.min(1, agitacao + alvoPonteiro.distanceTo(novo) * 1.5);
      alvoPonteiro.copy(novo);
    }

    // Clique no fundo pinga só no imersivo; na plataforma o clique é trabalho.
    function clicar(evento: MouseEvent): void {
      if (evento.button !== 0 || evento.detail === 0 || eAlvoInterativo(evento.target)) return;
      variante.aoClicar?.(lerPonteiro(evento, novo).clone(), tempo);
    }

    const observador = new ResizeObserver(redimensionar);
    observador.observe(canvas);
    redimensionar();
    window.addEventListener("pointermove", moverPonteiro, { passive: true });
    if (modo === "imersivo") window.addEventListener("click", clicar, { passive: true });
    viva.current = { variante, tempo: () => tempo };
    host.iniciar();

    return () => {
      viva.current = null;
      window.removeEventListener("pointermove", moverPonteiro);
      window.removeEventListener("click", clicar);
      observador.disconnect();
      bloom?.dispose();
      composer?.dispose();
      descartarCena(variante.cena);
      host.descartar();
      canvas.remove();
    };
  }, [palcoRef, raiz, fabrica, tema, modo]);

  // Troca de página na mesma atmosfera, ou seleção no grafo: um ping do
  // centro do radar marca o evento (o equivalente à varredura do ASCII). Não na montagem.
  const primeiraChave = useRef(true);
  useEffect(() => {
    if (primeiraChave.current) {
      primeiraChave.current = false;
      return;
    }
    const cena = viva.current;
    cena?.variante.aoTrocarRota?.(cena.tempo());
  }, [opcoes.chaveDePing]);
}
