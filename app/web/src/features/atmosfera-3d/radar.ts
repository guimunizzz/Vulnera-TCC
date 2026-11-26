/**
 * features/atmosfera-3d/radar.ts
 *
 * O QUE FAZ
 * Radar em coordenadas do mundo (plano xz): um feixe que gira em volta de um
 * centro e, ao passar por um "alvo", solta um ping — um anel que se abre a
 * partir dele. Alvos detectados com risco viram ping de alerta (magenta).
 * O JS guarda ângulo e pings; o GLSL diz, para um ponto, quanto o feixe e os
 * anéis o acendem.
 *
 * POR QUE NÃO O `three/pings.ts`
 * Aquele é em px de tela e disparado por clique (landing). Aqui o ping nasce
 * sozinho, da varredura, e mora no chão da cena — na plataforma o clique é
 * trabalho e não pode disparar nada. O clique só pinga no modo imersivo.
 */

export const MAX_PINGS_RADAR = 8;

export interface ConfigRadar {
  /** Segundos por volta do feixe. */
  periodo: number;
  /** Alvos espalhados em volta do centro. */
  alvos: number;
  /** Raio (unidades do mundo) onde os alvos ficam. */
  alcance: number;
  /** Velocidade da frente do anel (unidades/s), vida (s) e meia largura. */
  velocidade: number;
  duracao: number;
  largura: number;
  /** Chance-base de um alvo responder quando o feixe passa; o risco a multiplica (0,5× a 1,5×). */
  chance: number;
}

export interface Radar {
  uniformes: {
    uRadarCentro: { value: Float32Array };
    uRadarAngulo: { value: number };
    uPings: { value: Float32Array };
  };
  atualizar: (tempo: number, delta: number, risco: number) => void;
  /** Ping manual (clique no modo imersivo). */
  pingar: (x: number, z: number, tempo: number, alerta: boolean) => void;
}

const TAU = Math.PI * 2;

export function criarRadar(config: ConfigRadar, centro: { x: number; z: number }): Radar {
  const pings = new Float32Array(MAX_PINGS_RADAR * 4);
  for (let i = 0; i < MAX_PINGS_RADAR; i++) pings[i * 4 + 2] = -1e4;
  let proximo = 0;
  let angulo = 0;

  const alvos = Array.from({ length: config.alvos }, () => {
    const a = Math.random() * TAU;
    const r = config.alcance * (0.25 + 0.75 * Math.sqrt(Math.random()));
    return { angulo: a, x: centro.x + Math.cos(a) * r, z: centro.z + Math.sin(a) * r, sorteio: Math.random() };
  });

  function pingar(x: number, z: number, tempo: number, alerta: boolean): void {
    pings.set([x, z, tempo, alerta ? 1 : 0], proximo * 4);
    proximo = (proximo + 1) % MAX_PINGS_RADAR;
  }

  const uniformes = {
    uRadarCentro: { value: new Float32Array([centro.x, centro.z]) },
    uRadarAngulo: { value: 0 },
    uPings: { value: pings },
  };

  return {
    uniformes,
    atualizar(tempo, delta, risco) {
      const anterior = angulo;
      angulo = (angulo + (delta / config.periodo) * TAU) % TAU;
      const deuAVolta = angulo < anterior;
      for (const alvo of alvos) {
        const cruzou = deuAVolta
          ? alvo.angulo > anterior || alvo.angulo <= angulo
          : alvo.angulo > anterior && alvo.angulo <= angulo;
        if (!cruzou) continue;
        // Sorteio novo a cada volta: nem todo alvo responde sempre. Com risco
        // alto o radar acha mais coisa, e mais coisa vira alerta.
        if (Math.random() > config.chance * (0.5 + risco)) continue;
        pingar(alvo.x, alvo.z, tempo, alvo.sorteio < risco * 0.8);
      }
      uniformes.uRadarAngulo.value = angulo;
    },
    pingar,
  };
}

const f = (n: number) => n.toFixed(4);

/**
 * GLSL: uniforms do radar e as funções.
 *   feixeEm(p)    → 0–1: o feixe passando por p, com rastro que esmaece atrás.
 *   pingEm(p)     → vec3(anel, rastro, alerta) dos pings vivos em p; a largura
 *                   do anel é em unidades do mundo (serve no vertex shader).
 *   anelFinoEm(p) → só no fragment (`fragment: true`): o anel como linha de
 *                   ~1,5 px em qualquer distância — perto da câmera, um anel
 *                   largo em unidades viraria uma mancha.
 * Quem inclui declara `uTempo`.
 */
export function glslDoRadar(config: ConfigRadar, { fragment = false }: { fragment?: boolean } = {}): string {
  return /* glsl */ `
uniform vec2 uRadarCentro;
uniform float uRadarAngulo;
uniform vec4 uPings[${MAX_PINGS_RADAR}]; // x, z, início, alerta

float feixeEm(vec2 p) {
  vec2 d = p - uRadarCentro;
  float a = atan(d.y, d.x);
  // Quanto o feixe já passou deste ângulo (0 = passando agora).
  float atras = mod(uRadarAngulo - a + 6.2831853, 6.2831853);
  return exp(-atras * 3.2) * (1.0 - smoothstep(${f(config.alcance * 1.1)}, ${f(config.alcance * 1.5)}, length(d)));
}

vec3 pingEm(vec2 p) {
  float anel = 0.0;
  float rastro = 0.0;
  float alerta = 0.0;
  for (int i = 0; i < ${MAX_PINGS_RADAR}; i++) {
    float t = uTempo - uPings[i].z;
    if (t < 0.0 || t > ${f(config.duracao)}) continue;
    float d = length(p - uPings[i].xy);
    float x = t * ${f(config.velocidade)} - d; // positivo: a frente já passou
    float vida = 1.0 - t / ${f(config.duracao)};
    float a = exp(-(x * x) / ${f(config.largura * config.largura)}) * vida;
    // Miolo aceso no ponto detectado, apagando com a vida.
    float miolo = exp(-d * d * 2.0) * vida;
    float r = step(0.0, x) * exp(-x / ${f(config.largura * 3)}) * vida * 0.5;
    anel += a + miolo;
    rastro += r;
    alerta = max(alerta, uPings[i].w * max(a + miolo, r));
  }
  return clamp(vec3(anel, rastro, alerta), 0.0, 1.0);
}
${fragment ? /* glsl */ `
vec2 anelFinoEm(vec2 p) {
  float linha = 0.0;
  float alerta = 0.0;
  for (int i = 0; i < ${MAX_PINGS_RADAR}; i++) {
    float t = uTempo - uPings[i].z;
    if (t < 0.0 || t > ${f(config.duracao)}) continue;
    float d = length(p - uPings[i].xy);
    float x = t * ${f(config.velocidade)} - d;
    float l = (1.0 - min(abs(x) / max(fwidth(d), 1e-4) / 1.5, 1.0)) * (1.0 - t / ${f(config.duracao)});
    linha += l;
    alerta = max(alerta, uPings[i].w * l);
  }
  return clamp(vec2(linha, alerta), 0.0, 1.0);
}` : ""}
`;
}
