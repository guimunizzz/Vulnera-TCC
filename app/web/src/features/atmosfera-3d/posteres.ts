/**
 * features/atmosfera-3d/posteres.ts
 *
 * O QUE FAZ
 * Desenha, em canvas 2D, um quadro parado de cada atmosfera: o pôster que
 * aparece no lugar da cena com movimento reduzido, tela estreita, navegador
 * sem WebGL2, "Pausar animações" ou falha da cena.
 *
 * POR QUE CANVAS 2D E NÃO IMAGEM
 *   - Sem three: o pôster existe justamente quando a cena não roda (no
 *     celular, nem o chunk de three é baixado).
 *   - Sem arquivo de imagem: as cores saem dos tokens no momento do desenho,
 *     então tema e paleta nunca ficam velhos, e o risco real da tela aparece.
 *   - É a mesma lógica da cena, não uma foto dela: o relevo sai do mesmo campo
 *     de altura, projetado pela mesma câmera; a nebulosa, da mesma distribuição
 *     de estrelas; o ASCII, das mesmas ondas.
 *
 * Desenhado uma vez (e de novo só com tamanho, tema ou risco diferentes), por
 * isso pode caprichar: halo nas curvas-mestras, anéis do radar sobre o relevo,
 * o feixe congelado, pings parados no meio do caminho.
 *
 * QUEM USA
 * `poster-da-atmosfera.tsx` (chunk lazy). As funções puras são testadas em
 * `posteres.test.ts`.
 */

import { oklchParaSrgbNormalizado } from "../../design/oklch.mjs";
import type { Linguagem } from "./rotas";

type Vec3 = [number, number, number];
type Rgb = [number, number, number];

// ---------------------------------------------------------------------------
// Utilidades puras (testadas)
// ---------------------------------------------------------------------------

/** Gerador determinístico (mulberry32): o mesmo pôster a cada desenho. */
export function sementeAleatoria(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAD2: Array<[number, number]> = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const PERM = (() => {
  const aleatorio = sementeAleatoria(1337);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return Uint8Array.from([...base, ...base]);
})();

/** Ruído simplex 2D (Gustavson), em -1..1. O pôster não precisa do 3D do shader. */
export function ruido2(x: number, y: number): number {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  const canto = (gx: number, gy: number, indice: number) => {
    const t2 = 0.5 - gx * gx - gy * gy;
    if (t2 < 0) return 0;
    const [ax, ay] = GRAD2[PERM[indice] & 7];
    return t2 * t2 * t2 * t2 * (ax * gx + ay * gy);
  };
  return 70 * (
    canto(x0, y0, ii + PERM[jj])
    + canto(x1, y1, ii + i1 + PERM[jj + j1])
    + canto(x2, y2, ii + 1 + PERM[jj + 1])
  );
}

export function fbm2(x: number, y: number): number {
  let soma = 0;
  let amplitude = 0.5;
  for (let i = 0; i < 4; i++) {
    soma += amplitude * ruido2(x, y);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    amplitude *= 0.5;
  }
  return soma;
}

/**
 * Câmera perspectiva como a do three (`PerspectiveCamera` + `lookAt`, fov
 * vertical em graus). Devolve x/y em px e a profundidade, ou null atrás dela.
 */
export function criarProjecao(posicao: Vec3, alvo: Vec3, fovGraus: number, largura: number, altura: number) {
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const ponto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const frente = norm(sub(alvo, posicao));
  const direita = norm(cruz(frente, [0, 1, 0]));
  const cima = cruz(direita, frente);
  const focal = (altura / 2) / Math.tan((fovGraus * Math.PI) / 360);
  return (p: Vec3): [number, number, number] | null => {
    const d = sub(p, posicao);
    const z = ponto(d, frente);
    if (z < 0.1) return null;
    return [largura / 2 + (ponto(d, direita) / z) * focal, altura / 2 - (ponto(d, cima) / z) * focal, z];
  };
}

/**
 * Marching squares de UMA célula para UM nível: os segmentos (em fração da
 * célula, 0–1) onde a curva corta. Cantos: a=(0,0) b=(1,0) c=(1,1) d=(0,1).
 */
export function segmentosDeNivel(a: number, b: number, c: number, d: number, nivel: number): Array<[[number, number], [number, number]]> {
  const corte = (v0: number, v1: number) => (nivel - v0) / (v1 - v0);
  const pontos: Array<[number, number]> = [];
  if ((a < nivel) !== (b < nivel)) pontos.push([corte(a, b), 0]);
  if ((b < nivel) !== (c < nivel)) pontos.push([1, corte(b, c)]);
  if ((c < nivel) !== (d < nivel)) pontos.push([1 - corte(c, d), 1]);
  if ((d < nivel) !== (a < nivel)) pontos.push([0, 1 - corte(d, a)]);
  const segmentos: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i + 1 < pontos.length; i += 2) segmentos.push([pontos[i], pontos[i + 1]]);
  return segmentos;
}

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const misturar = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: Rgb, alfa: number) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${Math.min(1, Math.max(0, alfa)).toFixed(3)})`;

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

export interface CoresDoPoster {
  tinta: Rgb;
  apagada: Rgb;
  ciano: Rgb;
  magenta: Rgb;
  escuro: boolean;
}

/** Cor exibida de um token "L C H" (ou hex) no contexto de `elemento`. */
function corDoToken(elemento: Element, token: string): Rgb {
  const valor = getComputedStyle(elemento).getPropertyValue(token).trim();
  if (/^#[0-9a-f]{6}$/i.test(valor)) {
    return [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16) / 255) as Rgb;
  }
  const [L, C, H] = valor.split(/\s+/).map(Number);
  return oklchParaSrgbNormalizado(L, C, H).rgb as Rgb;
}

export function lerCoresDoPoster(elemento: Element): CoresDoPoster {
  const escuro = (elemento.closest("[data-theme]")?.getAttribute("data-theme") ?? document.documentElement.getAttribute("data-theme")) !== "light";
  const tinta = corDoToken(elemento, "--color-ambient-ink");
  return {
    tinta,
    apagada: corDoToken(elemento, "--color-ambient-muted"),
    // No claro a cena 3D troca o ciano pela tinta (ciano claro some no fundo claro).
    ciano: escuro ? corDoToken(elemento, "--color-ambient-cyan") : tinta,
    magenta: corDoToken(elemento, "--color-ambient-magenta"),
    escuro,
  };
}

// ---------------------------------------------------------------------------
// Relevo
// ---------------------------------------------------------------------------

/** Mesma câmera e mesmo campo de altura de `variantes/relevo.ts` (modo plataforma). */
function desenharRelevo(ctx: CanvasRenderingContext2D, largura: number, altura: number, cores: CoresDoPoster, risco: number): void {
  const projetar = criarProjecao([0, 11, 26], [0, 0.5, -6], 48, largura, altura);
  const centro: [number, number] = [0, -8];
  const altitude = (x: number, z: number) => {
    const base = fbm2(x * 0.055, z * 0.055 - 1.2);
    return base * 4 + Math.pow(Math.max(base, 0), 1.3) * (9 + 9 * risco);
  };
  const nevoa = (profundidade: number) => Math.exp(-Math.max(profundidade - 8, 0) * 0.028);
  const corDaAltura = (h: number) => {
    const t = suave(-1.5, 9, h);
    const c = misturar(cores.tinta, cores.ciano, suave(0.05, 0.45, t));
    return misturar(c, cores.magenta, suave(0.55 - risco * 0.3, 0.95 - risco * 0.2, t));
  };
  // O feixe parado, apontando para a esquerda da câmera, com rastro.
  const anguloDoFeixe = 2.5;
  const feixe = (x: number, z: number) => {
    const a = Math.atan2(z - centro[1], x - centro[0]);
    const atras = ((anguloDoFeixe - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.exp(-atras * 3.2) * (1 - suave(33, 45, Math.hypot(x - centro[0], z - centro[1])));
  };

  // Grade de alturas.
  const N = 150;
  const extensao = 55;
  const passo = (extensao * 2) / N;
  const h = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) h[j * (N + 1) + i] = altitude(-extensao + i * passo, -extensao + j * passo);
  }

  // Curvas em lotes (nível × faixa de alfa): centenas de traços, não dezenas de milhares.
  const lotes = new Map<string, { cor: Rgb; alfa: number; mestra: boolean; caminho: Path2D }>();
  const QUANTOS_ALFAS = 12;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = h[j * (N + 1) + i];
      const b = h[j * (N + 1) + i + 1];
      const c = h[(j + 1) * (N + 1) + i + 1];
      const d = h[(j + 1) * (N + 1) + i];
      const menor = Math.min(a, b, c, d) * 1.2;
      const maior = Math.max(a, b, c, d) * 1.2;
      for (let k = Math.ceil(menor); k <= Math.floor(maior); k++) {
        const nivel = k / 1.2;
        for (const [p0, p1] of segmentosDeNivel(a, b, c, d, nivel)) {
          const x0 = -extensao + (i + p0[0]) * passo;
          const z0 = -extensao + (j + p0[1]) * passo;
          const x1 = -extensao + (i + p1[0]) * passo;
          const z1 = -extensao + (j + p1[1]) * passo;
          const s0 = projetar([x0, nivel, z0]);
          const s1 = projetar([x1, nivel, z1]);
          if (!s0 || !s1) continue;
          const mestra = k % 5 === 0;
          const alfaBase = (mestra ? 0.75 : 0.32) * (0.75 + 1.4 * feixe((x0 + x1) / 2, (z0 + z1) / 2)) * nevoa((s0[2] + s1[2]) / 2);
          const faixa = Math.min(QUANTOS_ALFAS - 1, Math.floor(alfaBase * QUANTOS_ALFAS));
          if (faixa <= 0) continue;
          const chave = `${k}|${faixa}`;
          let lote = lotes.get(chave);
          if (!lote) {
            lote = { cor: corDaAltura(nivel), alfa: (faixa + 0.5) / QUANTOS_ALFAS, mestra, caminho: new Path2D() };
            lotes.set(chave, lote);
          }
          lote.caminho.moveTo(s0[0], s0[1]);
          lote.caminho.lineTo(s1[0], s1[1]);
        }
      }
    }
  }

  ctx.lineCap = "round";
  // Halo das mestras por baixo (o "bloom" do pôster), depois as linhas.
  if (cores.escuro) {
    for (const lote of lotes.values()) {
      if (!lote.mestra) continue;
      ctx.strokeStyle = rgba(lote.cor, lote.alfa * 0.18);
      ctx.lineWidth = 4;
      ctx.stroke(lote.caminho);
    }
  }
  // No claro a linha é tinta sobre papel: um pouco mais grossa (como `uEspessura` na cena).
  const espessura = cores.escuro ? 1 : 1.45;
  for (const lote of lotes.values()) {
    ctx.strokeStyle = rgba(lote.cor, lote.alfa);
    ctx.lineWidth = (lote.mestra ? 1.6 : 1) * espessura;
    ctx.stroke(lote.caminho);
  }

  // Um anel desenhado SOBRE o relevo (segue a altura do chão).
  const anelNoChao = (cx: number, cz: number, raio: number, cor: Rgb, alfa: number, largura: number) => {
    const caminho = new Path2D();
    let aberto = false;
    for (let s = 0; s <= 160; s++) {
      const ang = (s / 160) * Math.PI * 2;
      const x = cx + Math.cos(ang) * raio;
      const z = cz + Math.sin(ang) * raio;
      const p = projetar([x, altitude(x, z), z]);
      if (!p) {
        aberto = false;
        continue;
      }
      if (aberto) caminho.lineTo(p[0], p[1]);
      else caminho.moveTo(p[0], p[1]);
      aberto = true;
    }
    ctx.strokeStyle = rgba(cor, alfa);
    ctx.lineWidth = largura;
    ctx.stroke(caminho);
  };

  // Anéis de alcance do radar.
  for (const raio of [8, 16, 24]) anelNoChao(centro[0], centro[1], raio, cores.tinta, 0.2, 1);

  // Pings parados no meio do caminho; o de alerta só com risco relevante.
  const pings: Array<{ x: number; z: number; raio: number; alerta: boolean }> = [
    { x: -14, z: -4, raio: 4.2, alerta: false },
    { x: 9, z: -18, raio: 6.5, alerta: risco >= 0.45 },
    { x: 17, z: 2, raio: 2.4, alerta: false },
  ];
  for (const ping of pings) {
    const cor = ping.alerta ? cores.magenta : cores.ciano;
    if (cores.escuro) anelNoChao(ping.x, ping.z, ping.raio, cor, 0.16, 4);
    anelNoChao(ping.x, ping.z, ping.raio, cor, 0.85, 1.4);
    const miolo = projetar([ping.x, altitude(ping.x, ping.z), ping.z]);
    if (miolo) {
      const brilho = ctx.createRadialGradient(miolo[0], miolo[1], 0, miolo[0], miolo[1], 10);
      brilho.addColorStop(0, rgba(cor, 0.9));
      brilho.addColorStop(1, rgba(cor, 0));
      ctx.fillStyle = brilho;
      ctx.fillRect(miolo[0] - 10, miolo[1] - 10, 20, 20);
    }
  }
}

// ---------------------------------------------------------------------------
// Nebulosa
// ---------------------------------------------------------------------------

/** Mesma distribuição e câmera de `variantes/nebulosa.ts` (modo plataforma). */
function desenharNebulosa(ctx: CanvasRenderingContext2D, largura: number, altura: number, cores: CoresDoPoster, risco: number): void {
  const RAIO = 26;
  const BRACOS = 4;
  const TOTAL = 18_000;
  const orbita = 0.55;
  const projetar = criarProjecao([Math.sin(orbita) * 30, 17, Math.cos(orbita) * 30], [0, -2, 0], 50, largura, altura);
  // O `uEscalaPx` da cena em px CSS (o contexto já está escalado pelo dpr).
  const escalaPx = altura * 0.06 * 1.15 * (cores.escuro ? 1 : 1.25);
  const aleatorio = sementeAleatoria(2026);
  const espalhar = () => (aleatorio() + aleatorio() + aleatorio() - 1.5) / 1.5;
  const inclinacao = 0.18;
  const [cosI, sinI] = [Math.cos(inclinacao), Math.sin(inclinacao)];
  const anguloDoFeixe = 1.1;
  const branco: Rgb = [1, 0.9, 0.97];

  // Brilho do miolo por baixo das estrelas: esquenta com o risco.
  const centroTela = projetar([0, 0, 0]);
  if (centroTela && cores.escuro) {
    const corMiolo = misturar(branco, cores.magenta, risco * 0.65);
    const raio = altura * 0.32;
    const halo = ctx.createRadialGradient(centroTela[0], centroTela[1], 0, centroTela[0], centroTela[1], raio);
    halo.addColorStop(0, rgba(corMiolo, 0.22));
    halo.addColorStop(0.35, rgba(misturar(cores.tinta, corMiolo, 0.4), 0.07));
    halo.addColorStop(1, rgba(cores.tinta, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, largura, altura);
  }

  for (let i = 0; i < TOTAL; i++) {
    const r = Math.pow(aleatorio(), 1.6) * RAIO + 0.3;
    const braco = (i % BRACOS) / BRACOS * Math.PI * 2;
    const angulo = braco + r * 0.32 + espalhar() * (0.35 + 6 / (r + 4)) + 40 * 0.5 * (0.9 / (2 + r * 0.55));
    const alturaNoDisco = espalhar();
    const semente = aleatorio();
    let x = Math.cos(angulo) * r;
    let y = alturaNoDisco * (1 - r / RAIO) * 2.2;
    let z = Math.sin(angulo) * r;
    const deriva = 1.1 + risco;
    x += ruido2(x * 0.11, z * 0.11) * deriva;
    z += ruido2(x * 0.11 + 41.7, z * 0.11) * deriva;
    y += ruido2(x * 0.11 + 17.3, z * 0.11) * 0.5 * deriva;

    // O feixe do radar, parado: acende as estrelas que acabou de cruzar.
    const atras = ((anguloDoFeixe - Math.atan2(z, x)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const feixe = Math.exp(-atras * 3.2) * (1 - suave(RAIO * 0.93, RAIO * 1.3, Math.hypot(x, z)));

    const aquece = semente < risco * 0.4 && r / RAIO > 0.2 ? 1 : 0;
    const alerta = semente < risco * 0.06 && r / RAIO > 0.25 ? 1 : 0;
    const miolo = 1 - suave(0, 7, r);
    let cor = misturar(cores.tinta, cores.ciano, suave(0.35, 0.85, (semente * 7.13) % 1));
    cor = misturar(cor, cores.magenta, aquece * 0.7);
    cor = misturar(cor, misturar(branco, cores.magenta, risco * 0.65), miolo * 0.45);
    cor = misturar(cor, cores.magenta, alerta);
    const realce = 1 + alerta + feixe * 1.3;
    cor = [Math.min(1, cor[0] * realce), Math.min(1, cor[1] * realce), Math.min(1, cor[2] * realce)];
    const alfa = (0.3 + 0.55 * ((semente * 3.71) % 1)) * (1 - 0.78 * miolo) * (1 + alerta + feixe * 0.8) * (cores.escuro ? 0.85 : 1);

    // Inclinação do disco (rotação em z, como `nuvem.rotation.z`).
    const p = projetar([x * cosI - y * sinI, x * sinI + y * cosI, z]);
    if (!p) continue;
    const tamanho = (1 + 1.6 * Math.pow((semente * 11.3) % 1, 6) + alerta * 1.2) * escalaPx / p[2];
    ctx.fillStyle = rgba(cor, alfa);
    if (tamanho < 2.2) {
      ctx.fillRect(p[0] - tamanho / 2, p[1] - tamanho / 2, tamanho, tamanho);
    } else {
      ctx.beginPath();
      ctx.arc(p[0], p[1], tamanho / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pings parados no plano do disco.
  const anelNoDisco = (cx: number, cz: number, raio: number, cor: Rgb, alfa: number, larguraLinha: number) => {
    const caminho = new Path2D();
    for (let s = 0; s <= 120; s++) {
      const ang = (s / 120) * Math.PI * 2;
      const x = cx + Math.cos(ang) * raio;
      const z = cz + Math.sin(ang) * raio;
      const p = projetar([x * cosI, x * sinI, z]);
      if (!p) continue;
      if (s === 0) caminho.moveTo(p[0], p[1]);
      else caminho.lineTo(p[0], p[1]);
    }
    ctx.strokeStyle = rgba(cor, alfa);
    ctx.lineWidth = larguraLinha;
    ctx.stroke(caminho);
  };
  const pings = [
    { x: 11, z: 6, raio: 3.4, alerta: risco >= 0.45 },
    { x: -9, z: -13, raio: 5.2, alerta: false },
  ];
  for (const ping of pings) {
    const cor = ping.alerta ? cores.magenta : cores.ciano;
    if (cores.escuro) anelNoDisco(ping.x, ping.z, ping.raio, cor, 0.14, 4);
    anelNoDisco(ping.x, ping.z, ping.raio, cor, 0.7, 1.2);
  }
}

// ---------------------------------------------------------------------------
// ASCII
// ---------------------------------------------------------------------------

/** O `FONTE_ASCII` do kit — repetido aqui porque aquele módulo importa three. */
const FONTE_ASCII = '"JetBrains Mono Variable", ui-monospace, monospace';
/** As mesmas medidas de `atmosfera-config.ts` (célula 14 × 28 px, ondas). */
const CELULA = { largura: 14, altura: 28 };
const ONDAS = { quantidade: 6, topo: 0.42, passo: 0.11 };
const GLIFOS = " .·:-+|/\\~=";

/** Hash por célula, determinístico — o papel do `hashCelula` do shader. */
function hashCelula(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function desenharAscii(ctx: CanvasRenderingContext2D, largura: number, altura: number, cores: CoresDoPoster): void {
  const colunas = Math.ceil(largura / CELULA.largura);
  const linhas = Math.ceil(altura / CELULA.altura);
  const t = 30;
  const curvaY = (x: number, i: number) => ONDAS.topo - i * ONDAS.passo + Math.sin(x * 2.3 + t * 0.22 + i * 0.08) * 0.22 + Math.cos(x * 4.1 - t * 0.13) * 0.09;
  const curvaDy = (x: number, i: number) => 2.3 * Math.cos(x * 2.3 + t * 0.22 + i * 0.08) * 0.22 - 4.1 * Math.sin(x * 4.1 - t * 0.13) * 0.09;
  const aurora = (clipX: number, clipY: number) => 0.5 + 0.5 * Math.sin(clipX * 1.4 + t * 0.05 + Math.sin(clipY * 1.9 - t * 0.04) * 1.2);
  const corDaAurora = (a: number) => (a < 0.5 ? misturar(cores.tinta, cores.ciano, a * 2) : misturar(cores.ciano, cores.magenta, a * 2 - 1));

  // Lavagem da aurora: manchas grandes por trás dos glifos (5% do teto).
  for (const [x, y, raio, a] of [[0.2, 0.3, 0.5, 0.1], [0.75, 0.55, 0.45, 0.6], [0.5, 0.15, 0.35, 0.9]] as const) {
    const mancha = ctx.createRadialGradient(x * largura, y * altura, 0, x * largura, y * altura, raio * largura);
    mancha.addColorStop(0, rgba(corDaAurora(a), 0.05));
    mancha.addColorStop(1, rgba(corDaAurora(a), 0));
    ctx.fillStyle = mancha;
    ctx.fillRect(0, 0, largura, altura);
  }

  ctx.font = `400 ${Math.round(CELULA.largura / 0.6)}px ${FONTE_ASCII}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const alturaCelula = 2 / linhas;

  for (let linha = 0; linha < linhas; linha++) {
    // A grade do shader cresce de baixo para cima.
    const celulaY = linhas - 1 - linha;
    for (let coluna = 0; coluna < colunas; coluna++) {
      const clipX = ((coluna + 0.5) / colunas) * 2 - 1;
      const clipY = ((celulaY + 0.5) / linhas) * 2 - 1;
      const r = hashCelula(coluna, celulaY);
      let glifo = "";
      let alfa = 0;
      let tinta = 0;

      if (r >= 0.8) {
        const sorteio = hashCelula(coluna + 29, celulaY + 29);
        glifo = GLIFOS[1 + Math.floor(sorteio * sorteio * 5)];
        alfa = 0.6 * (0.75 + 0.25 * Math.sin(r * 6.2832)) * (0.6 + 0.4 * ((celulaY + 0.5) / linhas));
        tinta = r >= 0.94 ? 1 : 0;
      }

      // Onda mais próxima: o glifo segue a inclinação, como no shader.
      const x = clipX * 1.2;
      let dMin = Infinity;
      let inclinacao = 0;
      let curva = 0;
      for (let i = 0; i < ONDAS.quantidade; i++) {
        const d = Math.abs(clipY - curvaY(x, i)) / alturaCelula;
        if (d < dMin) {
          dMin = d;
          inclinacao = curvaDy(x, i);
          curva = i;
        }
      }
      const naLinha = 1 - suave(0.35, 0.85, dMin);
      if (naLinha > 0.02) {
        const inclinacaoPx = inclinacao * 1.2 * altura / largura;
        glifo = Math.abs(inclinacaoPx) < 0.22 ? (hashCelula(coluna + 13, celulaY) > 0.5 ? "-" : "~") : inclinacaoPx > 0 ? "/" : "\\";
        alfa = Math.max(alfa, naLinha * (0.65 + 0.35 * Math.sin(x * 3 - t * 0.8 + curva * 1.7)));
        tinta = Math.max(tinta, naLinha);
      }
      if (!glifo || alfa < 0.02) continue;
      const cor = misturar(cores.apagada, corDaAurora(aurora(clipX, clipY)), tinta);
      ctx.fillStyle = rgba(cor, alfa);
      ctx.fillText(glifo, (coluna + 0.5) * CELULA.largura, (linha + 0.5) * CELULA.altura);
    }
  }
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export async function desenharPoster(
  canvas: HTMLCanvasElement,
  linguagem: Linguagem,
  { largura, altura, dpr, cores, risco }: { largura: number; altura: number; dpr: number; cores: CoresDoPoster; risco: number },
): Promise<void> {
  if (linguagem === "ascii") {
    // Sem a fonte carregada o pôster sairia na fonte de fallback.
    await document.fonts?.load(`400 23px ${FONTE_ASCII}`).catch(() => undefined);
  }
  canvas.width = Math.max(1, Math.round(largura * dpr));
  canvas.height = Math.max(1, Math.round(altura * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);
  // No escuro a luz soma (como o blending aditivo da cena); no claro, tinta sobre papel.
  ctx.globalCompositeOperation = cores.escuro ? "lighter" : "source-over";
  if (linguagem === "relevo") desenharRelevo(ctx, largura, altura, cores, risco);
  else if (linguagem === "nebulosa") desenharNebulosa(ctx, largura, altura, cores, risco);
  else desenharAscii(ctx, largura, altura, cores);
  ctx.globalCompositeOperation = "source-over";
}
