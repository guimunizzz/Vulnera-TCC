/**
 * Variante "Relevo": voo baixo sobre um mapa topográfico que flui na direção
 * da câmera, varrido por um radar. Só as curvas de nível acendem (a cada 5,
 * uma curva-mestra), sobre uma pele quase invisível sombreada pela inclinação.
 * O feixe gira em volta de um centro no chão, com anéis de alcance; ao passar
 * por um alvo, solta um ping que corre pelo relevo (magenta = alerta, mais
 * frequente com risco). O ponteiro levanta um morro e acende as curvas.
 *
 * Modo plataforma: mais escuro, mais lento, malha menor e sem bloom.
 */

import * as THREE from "three";
import { GLSL_RUIDO } from "../glsl-ruido";
import { criarRadar, glslDoRadar, type ConfigRadar } from "../radar";
import type { FabricaDeVariante } from "../tipos";

const AJUSTE = {
  // A opacidade final da plataforma é a da camada (CSS, teto de AA); aqui a cena fica cheia.
  plataforma: { segmentos: 170, opacidade: 1, fluxo: 0.5, morro: 0.6, ping: 0.8, aneis: 0.6 },
  imersivo: { segmentos: 260, opacidade: 1, fluxo: 1, morro: 1, ping: 1, aneis: 1 },
} as const;

const RADAR: Record<keyof typeof AJUSTE, ConfigRadar> = {
  plataforma: { periodo: 11, alvos: 14, alcance: 30, velocidade: 7, duracao: 2.6, largura: 0.7, chance: 0.35 },
  imersivo: { periodo: 6, alvos: 18, alcance: 30, velocidade: 9, duracao: 2.8, largura: 0.8, chance: 0.6 },
};

const CENTRO_DO_RADAR = { x: 0, z: -8 };

function vertex(fluxo: number): string {
  return /* glsl */ `
${GLSL_RUIDO}
uniform float uTempo;
uniform float uRisco;
uniform vec3 uMouse; // xz = ponto no chão · y = força (0–1)
varying float vAltura;
varying float vDist;
varying vec3 vMundo;

float altura(vec2 p) {
  // O mapa corre para a câmera: amostrar com z deslocado no tempo é voar.
  float t = uTempo * ${fluxo.toFixed(3)};
  vec2 q = p * 0.055 + vec2(0.0, -t * 0.035);
  float base = fbm(vec3(q, t * 0.015));
  float picos = pow(max(base, 0.0), 1.3) * (9.0 + 9.0 * uRisco);
  float h = base * 4.0 + picos;
  float d = distance(p, uMouse.xz);
  return h + uMouse.y * 3.2 * exp(-d * d / 22.0);
}

void main() {
  vec3 p = position;
  p.y = altura(p.xz);
  vAltura = p.y;
  vMundo = (modelMatrix * vec4(p, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
}

function fragment(radar: ConfigRadar): string {
  return /* glsl */ `
uniform float uTempo;
uniform vec3 uMouse;
uniform vec3 uTinta;
uniform vec3 uCiano;
uniform vec3 uMagenta;
uniform float uNevoa;
uniform float uOpacidade;
uniform float uForcaPing;
uniform float uForcaAneis;
uniform float uRisco;
uniform float uEspessura; // 1 no escuro; mais grossa no claro (tinta sobre papel some fina)
varying float vAltura;
varying float vDist;
varying vec3 vMundo;
${glslDoRadar(radar, { fragment: true })}

// Distância em pixels até a linha mais próxima: 1 px nítido em qualquer zoom.
float linha(float valor, float espessura) {
  float d = abs(fract(valor - 0.5) - 0.5) / max(fwidth(valor), 1e-4);
  return 1.0 - min(d / espessura, 1.0);
}

void main() {
  float nivel = vAltura * 1.2;
  float fina = linha(nivel, 1.0 * uEspessura);
  float mestra = linha(nivel / 5.0, 1.6 * uEspessura);

  float t = smoothstep(-1.5, 9.0, vAltura);
  vec3 cor = mix(uTinta, uCiano, smoothstep(0.05, 0.45, t));
  // Com risco o magenta desce a encosta: mais do relevo lê como quente.
  cor = mix(cor, uMagenta, smoothstep(0.55 - uRisco * 0.3, 0.95 - uRisco * 0.2, t));

  vec3 normal = normalize(cross(dFdx(vMundo), dFdy(vMundo)));
  float luz = clamp(dot(normal, normalize(vec3(-0.4, 0.8, 0.3))), 0.0, 1.0);

  // Radar: o feixe acende as curvas por onde passa; anéis de alcance a cada 8 u.
  float feixe = feixeEm(vMundo.xz);
  float raio = length(vMundo.xz - uRadarCentro);
  float aneis = linha(raio / 8.0, 1.0) * (1.0 - smoothstep(24.0, 34.0, raio)) * uForcaAneis;
  // Faixa larga do ping só acende curvas; o anel visível é a linha fina.
  vec3 ping = pingEm(vMundo.xz) * uForcaPing;
  vec2 anel = anelFinoEm(vMundo.xz) * uForcaPing;

  float perto = uMouse.y * exp(-pow(distance(vMundo.xz, uMouse.xz) / 6.0, 2.0));

  float curvas = fina * 0.32 + mestra * 0.75;
  float brilho = curvas * (0.75 + feixe * 1.4 + perto * 2.2 + ping.x * 1.8 + ping.y * 1.2)
    + aneis * (0.12 + feixe * 0.5)
    + anel.x * 0.8
    + feixe * 0.035
    + luz * 0.1;
  cor = mix(cor, uCiano, clamp(ping.x + ping.y + anel.x, 0.0, 1.0) * 0.6);
  cor = mix(cor, uMagenta, max(ping.z, anel.y));

  float nevoa = exp(-max(vDist - 8.0, 0.0) * uNevoa);
  gl_FragColor = vec4(cor * brilho, clamp(brilho, 0.0, 1.0) * nevoa * uOpacidade);
}
`;
}

export const criarRelevo: FabricaDeVariante = (paleta, tema, modo) => {
  const ajuste = AJUSTE[modo];
  const escuro = tema === "dark";
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  const radar = criarRadar(RADAR[modo], CENTRO_DO_RADAR);

  const geometria = new THREE.PlaneGeometry(110, 110, ajuste.segmentos, ajuste.segmentos);
  geometria.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: vertex(ajuste.fluxo),
    fragmentShader: fragment(RADAR[modo]),
    transparent: true,
    depthWrite: false,
    blending: escuro ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      ...radar.uniformes,
      uTempo: { value: 0 },
      uRisco: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uTinta: { value: paleta.tinta },
      uCiano: { value: escuro ? paleta.ciano : paleta.tinta },
      uMagenta: { value: paleta.magenta },
      uNevoa: { value: 0.028 },
      // Sem atenuar no claro: o teto de AA é o da camada (CSS), não o da cena.
      uOpacidade: { value: ajuste.opacidade },
      uForcaPing: { value: ajuste.ping },
      uForcaAneis: { value: ajuste.aneis },
      uEspessura: { value: escuro ? 1 : 1.45 },
    },
  });
  cena.add(new THREE.Mesh(geometria, material));

  const raio = new THREE.Raycaster();
  const chao = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ponto = new THREE.Vector3();
  const mouse = material.uniforms.uMouse.value as THREE.Vector3;

  return {
    cena,
    camera,
    bloom: modo === "imersivo" ? { forca: 0.9, raio: 0.55, limiar: 0.12 } : null,
    atualizar({ tempo, delta, ponteiro, ponteiroCamera, agitacao, risco }) {
      material.uniforms.uTempo.value = tempo;
      material.uniforms.uRisco.value = risco;
      radar.atualizar(tempo, delta, risco);
      camera.position.set(ponteiroCamera.x * 4, 11 + ponteiroCamera.y * 2, 26);
      camera.lookAt(ponteiroCamera.x * 1.5, 0.5, -6);
      camera.updateMatrixWorld();
      // Sem suavização extra: o morro fica embaixo do cursor.
      raio.setFromCamera(ponteiro, camera);
      if (raio.ray.intersectPlane(chao, ponto)) mouse.set(ponto.x, mouse.y, ponto.z);
      const alvo = (0.45 + agitacao * 0.55) * ajuste.morro;
      mouse.y += (alvo - mouse.y) * Math.min(1, delta * 6);
    },
    aoClicar(ponteiro, tempo) {
      raio.setFromCamera(ponteiro, camera);
      if (raio.ray.intersectPlane(chao, ponto)) radar.pingar(ponto.x, ponto.z, tempo, false);
    },
    aoTrocarRota(tempo) {
      radar.pingar(CENTRO_DO_RADAR.x, CENTRO_DO_RADAR.z, tempo, false);
    },
  };
};
