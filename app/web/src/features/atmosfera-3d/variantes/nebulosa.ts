/**
 * Variante "Nebulosa": uma galáxia espiral de partículas vista de cima, em
 * rotação diferencial (o miolo gira mais rápido que a borda) e com deriva de
 * ruído, varrida por um radar. O feixe gira no plano do disco e acende as
 * estrelas por onde passa; ao cruzar um alvo, solta um ping — um anel que
 * levanta e acende as estrelas que toca (magenta = alerta, mais frequente com
 * risco). O ponteiro abre um redemoinho no disco.
 *
 * Tudo no vertex shader: a CPU só troca uniforms. Modo plataforma: menos da
 * metade das partículas, mais lenta, mais escura e sem bloom.
 */

import * as THREE from "three";
import { GLSL_RUIDO } from "../glsl-ruido";
import { criarRadar, glslDoRadar, type ConfigRadar } from "../radar";
import type { FabricaDeVariante } from "../tipos";

const RAIO = 26;
const BRACOS = 4;

const AJUSTE = {
  // A opacidade final da plataforma é a da camada (CSS, teto de AA); aqui a cena fica cheia.
  plataforma: { total: 32_000, opacidade: 0.85, giro: 0.5, redemoinho: 0.6, ping: 0.8, tamanho: 1.15 },
  imersivo: { total: 70_000, opacidade: 0.85, giro: 1, redemoinho: 1, ping: 1, tamanho: 1 },
} as const;

const RADAR: Record<keyof typeof AJUSTE, ConfigRadar> = {
  plataforma: { periodo: 12, alvos: 14, alcance: RAIO * 0.85, velocidade: 6, duracao: 2.6, largura: 0.9, chance: 0.35 },
  imersivo: { periodo: 7, alvos: 20, alcance: RAIO * 0.85, velocidade: 8, duracao: 2.8, largura: 1.0, chance: 0.6 },
};

function vertex(giro: number, radar: ConfigRadar): string {
  return /* glsl */ `
${GLSL_RUIDO}
attribute float aRaio;
attribute float aAngulo;
attribute float aAltura;
attribute float aSemente;
uniform float uTempo;
uniform float uRisco;
uniform vec3 uMouse;
uniform float uEscalaPx;
uniform float uForcaPing;
uniform vec3 uTinta;
uniform vec3 uCiano;
uniform vec3 uMagenta;
varying vec3 vCor;
varying float vAlfa;
${glslDoRadar(radar)}

void main() {
  float t = uTempo * ${giro.toFixed(3)};
  float r = aRaio;
  float theta = aAngulo + t * (0.9 / (2.0 + r * 0.55));
  vec3 p = vec3(cos(theta) * r, aAltura * (1.0 - r / ${RAIO.toFixed(1)}) * 2.2, sin(theta) * r);

  // Risco agita o disco: a deriva de ruído quase dobra.
  vec3 q = p * 0.11 + vec3(0.0, t * 0.04, 0.0);
  p += vec3(snoise(q), snoise(q + 17.3) * 0.5, snoise(q + 41.7)) * (1.1 + uRisco * 1.0);

  // Redemoinho do ponteiro: empurra para fora e gira em volta do ponto.
  vec2 rel = p.xz - uMouse.xz;
  float d = length(rel);
  float campo = uMouse.y * exp(-d * d / 26.0);
  vec2 tangente = vec2(-rel.y, rel.x) / max(d, 0.001);
  p.xz += normalize(rel + 1e-4) * campo * 2.6 + tangente * campo * 1.8;
  p.y += campo * 1.4 * (aSemente - 0.5);

  // Radar: o feixe acende; o anel do ping levanta e acende o que toca.
  float feixe = feixeEm(p.xz);
  vec3 ping = pingEm(p.xz) * uForcaPing;
  p.y += ping.x * 0.9;

  // Risco, em três camadas que se somam: uma fração dos braços esquenta para
  // o magenta, estrelas-alerta pulsam, e o miolo deixa de ser branco.
  float aquece = step(aSemente, uRisco * 0.4) * step(0.2, r / ${RAIO.toFixed(1)});
  float alerta = step(aSemente, uRisco * 0.06) * step(0.25, r / ${RAIO.toFixed(1)})
    * (0.55 + 0.45 * sin(uTempo * 2.6 + aSemente * 900.0));
  float miolo = 1.0 - smoothstep(0.0, 7.0, r);
  vec3 cor = mix(uTinta, uCiano, smoothstep(0.35, 0.85, fract(aSemente * 7.13)));
  cor = mix(cor, uMagenta, aquece * 0.7);
  cor = mix(cor, mix(vec3(1.0, 0.9, 0.97), uMagenta, uRisco * 0.65), miolo * 0.45);
  cor = mix(cor, uMagenta, max(alerta, ping.z));
  cor = mix(cor, uCiano, clamp(ping.x + ping.y, 0.0, 1.0) * (1.0 - ping.z) * 0.7);
  vCor = cor * (1.0 + campo * 1.5 + alerta + feixe * 1.3 + ping.x * 2.0 + ping.y);
  // O miolo é denso: sem atenuar, a soma aditiva estoura em branco.
  vAlfa = mix(0.3, 0.85, fract(aSemente * 3.71)) * mix(1.0, 0.22, miolo)
    * (1.0 + alerta + feixe * 0.8 + ping.x * 1.5);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tamanho = mix(1.0, 2.6, pow(fract(aSemente * 11.3), 6.0)) + alerta * 1.2 + ping.x * 1.2;
  gl_PointSize = tamanho * uEscalaPx / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
}

const FRAGMENT = /* glsl */ `
uniform float uOpacidade;
varying vec3 vCor;
varying float vAlfa;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0);
  gl_FragColor = vec4(vCor, a * vAlfa * uOpacidade);
}
`;

/** Gaussiana barata (soma de uniformes) para espalhar estrelas em volta do braço. */
function espalhar(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

export const criarNebulosa: FabricaDeVariante = (paleta, tema, modo) => {
  const ajuste = AJUSTE[modo];
  const total = ajuste.total;
  const escuro = tema === "dark";
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  const radar = criarRadar(RADAR[modo], { x: 0, z: 0 });
  const centro = { x: 0, z: 0 };

  const raios = new Float32Array(total);
  const angulos = new Float32Array(total);
  const alturas = new Float32Array(total);
  const sementes = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    // Concentra no miolo sem esvaziar a borda.
    const r = Math.pow(Math.random(), 1.6) * RAIO + 0.3;
    const braco = (i % BRACOS) / BRACOS * Math.PI * 2;
    raios[i] = r;
    angulos[i] = braco + r * 0.32 + espalhar() * (0.35 + 6 / (r + 4));
    alturas[i] = espalhar();
    sementes[i] = Math.random();
  }
  const geometria = new THREE.BufferGeometry();
  // `position` existe só para o three saber quantos vértices desenhar.
  geometria.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  geometria.setAttribute("aRaio", new THREE.BufferAttribute(raios, 1));
  geometria.setAttribute("aAngulo", new THREE.BufferAttribute(angulos, 1));
  geometria.setAttribute("aAltura", new THREE.BufferAttribute(alturas, 1));
  geometria.setAttribute("aSemente", new THREE.BufferAttribute(sementes, 1));
  geometria.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RAIO * 1.5);

  const material = new THREE.ShaderMaterial({
    vertexShader: vertex(ajuste.giro, RADAR[modo]),
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: escuro ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      ...radar.uniformes,
      uTempo: { value: 0 },
      uRisco: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uEscalaPx: { value: 300 },
      uForcaPing: { value: ajuste.ping },
      uTinta: { value: paleta.tinta },
      uCiano: { value: escuro ? paleta.ciano : paleta.tinta },
      uMagenta: { value: paleta.magenta },
      // Sem atenuar no claro: o teto de AA é o da camada (CSS), não o da cena.
      uOpacidade: { value: escuro ? ajuste.opacidade : 1 },
    },
  });
  const nuvem = new THREE.Points(geometria, material);
  nuvem.rotation.z = 0.18;
  cena.add(nuvem);

  const raio = new THREE.Raycaster();
  // O plano da galáxia não muda: a inclinação é fixa.
  const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, 1, 0).applyEuler(nuvem.rotation),
    nuvem.position,
  );
  const ponto = new THREE.Vector3();
  const mouse = material.uniforms.uMouse.value as THREE.Vector3;

  /** Ponteiro → ponto no plano do disco, em coordenadas locais da galáxia. */
  function noDisco(ponteiro: THREE.Vector2): THREE.Vector3 | null {
    raio.setFromCamera(ponteiro, camera);
    if (!raio.ray.intersectPlane(plano, ponto)) return null;
    return nuvem.worldToLocal(ponto);
  }

  return {
    cena,
    camera,
    bloom: modo === "imersivo" ? { forca: 0.8, raio: 0.6, limiar: 0.15 } : null,
    atualizar({ tempo, delta, ponteiro, ponteiroCamera, agitacao, risco }) {
      material.uniforms.uTempo.value = tempo;
      material.uniforms.uRisco.value = risco;
      radar.atualizar(tempo, delta, risco);
      const orbita = tempo * 0.03 * ajuste.giro + ponteiroCamera.x * 0.35;
      camera.position.set(Math.sin(orbita) * 30, 17 + ponteiroCamera.y * 4, Math.cos(orbita) * 30);
      camera.lookAt(0, -2, 0);
      camera.updateMatrixWorld();
      nuvem.updateMatrixWorld();
      // Sem suavização extra: o redemoinho fica embaixo do cursor.
      const local = noDisco(ponteiro);
      if (local) mouse.set(local.x, mouse.y, local.z);
      const alvo = (0.35 + agitacao * 0.9) * ajuste.redemoinho;
      mouse.y += (alvo - mouse.y) * Math.min(1, delta * 5);
    },
    redimensionar(_largura, altura, dpr) {
      material.uniforms.uEscalaPx.value = altura * dpr * 0.06 * ajuste.tamanho;
    },
    aoClicar(ponteiro, tempo) {
      const local = noDisco(ponteiro);
      if (local) radar.pingar(local.x, local.z, tempo, false);
    },
    aoTrocarRota(tempo) {
      radar.pingar(centro.x, centro.z, tempo, false);
    },
  };
};
