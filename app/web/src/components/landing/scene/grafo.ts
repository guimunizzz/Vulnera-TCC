/**
 * components/landing/scene/grafo.ts
 *
 * O QUE FAZ
 * Material "grafo" dos atos 3–5: as células saem do plano e viram nós no
 * espaço, ligados por arestas — a mesma ideia do Exposure Graph do produto
 * (alvo → endpoint → achados), mas como ilustração: nada aqui é dado real.
 *
 *   Ato 3 · Organizar  a "poeira" (o sistema que funciona) ganha profundidade;
 *                      cada falha voa até um dos quatro aglomerados, que giram:
 *                      nó central → nós intermediários → falhas
 *   Ato 4 · Corrigir   do mais grave para o menos grave, a falha fica verde, a
 *                      aresta se solta e o nó sobe e some; o nó central do
 *                      grupo resolvido fica verde
 *   Ato 5 · Estável    giro mais lento, luz quente, o aglomerado de baixa
 *                      continua, discreto
 *
 * COMO
 * - Seis draw calls, todas instanciadas, e nenhum buffer por nó: posição, cor
 *   e ligação saem do número da instância (a célula ASCII) no vértice.
 * - Nós são cartazes com disco e brilho; arestas são segmentos com largura em
 *   px de tela. Os dois têm a borda suavizada na conta.
 * - Como a ligação precisa ser calculável dos dois lados sem busca, a
 *   estrutura é uma árvore: a falha escolhe o nó intermediário por sorteio, e
 *   a poeira liga a vizinhos em deslocamentos fixos da grade.
 *
 * Não use crase dentro dos templates GLSL: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `materiais.ts` (chunk lazy da cena).
 */

import * as THREE from "three";
import {
  criarCena3d, criarQuadInstanciado, FRAGMENT_LINHA_3D, GLSL_COMUM_3D, GLSL_VERTICE_3D,
} from "./cena-3d";
import { CENA_3D, PINTURA } from "./config";
import { CENTRO_DOS_GRUPOS } from "./layout";
import type { Pintura } from "./pintura";

const f = (n: number) => n.toFixed(4);
const G = CENA_3D.grafo;
const SUBNOS = G.subnosPorGrupo;
/** Vizinhos a que a poeira se liga, em células: longe o bastante para a aresta aparecer. */
const VIZINHOS = [[3, 0], [1, 2], [-2, 2]] as const;

/** Onde está cada nó. Vale para os nós e para as pontas das arestas. */
const GLSL_NOS = /* glsl */ `
uniform float uModo;

vec3 girar(vec3 v, float angulo) {
  float c = cos(angulo);
  float s = sin(angulo);
  return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x);
}

// Giro do aglomerado em volta do eixo vertical; um lado gira ao contrário do outro.
float giroDoGrupo(int g) {
  return uRitmo * ${f(G.giroRadS)} * (g < 2 ? 1.0 : -1.0) + float(g) * 1.3;
}

// Nó intermediário "k" do grupo "g": pontos espalhados numa esfera (espiral de Fibonacci).
vec3 subNo(int g, float k) {
  float y = 1.0 - (k + 0.5) / ${SUBNOS}.0 * 2.0;
  float raio = sqrt(max(0.0, 1.0 - y * y));
  float angulo = k * 2.39996;
  vec3 direcao = vec3(cos(angulo) * raio, y, sin(angulo) * raio);
  return uGrupos[g].xyz + girar(direcao * ${f(G.raioDosSubnosPx)} * uFormado, giroDoGrupo(g));
}

// --- Poeira: os nós calmos, o sistema que funciona.
bool temPoeira(vec2 cel) {
  return hashCelula(cel + 201.0) < ${f(G.densidadeDaPoeira)} && severidadeDaCelula(cel) < 0.5;
}
vec3 poeira(vec2 cel) {
  float h = hashCelula(cel + 211.0);
  vec2 deriva = 7.0 * vec2(sin(uRitmo * 0.31 + h * 40.0), cos(uRitmo * 0.27 + h * 23.0));
  return vec3(planoDaCelula(cel) + deriva, (h - 0.5) * ${f(G.profundidadeDaPoeiraPx)} * uVirada);
}
float nasceuPoeira(vec2 cel) {
  return nasceuEm(planoDaCelula(cel), hashCelula(cel + 113.0));
}

// --- Falha: do glifo na página até o aglomerado da severidade.
struct Falha {
  vec3 pos;
  vec3 ancora;  // o nó intermediário a que ela se liga
  vec3 cor;
  float alfa;
  float chegada;
  float corrigida;
};
bool falhaDaCelula(vec2 cel, out Falha n) {
  float severidade = severidadeDaCelula(cel);
  if (severidade < 0.5) return false;
  int g = int(severidade) - 1;
  float h1 = hashCelula(cel + 17.0);
  float h2 = hashCelula(cel + 23.0);
  float h3 = hashCelula(cel + 31.0);

  n.ancora = subNo(g, floor(hashCelula(cel + 131.0) * ${SUBNOS}.0));
  vec3 direcao = normalize(vec3(h1 - 0.5, h2 - 0.5, h3 - 0.5) + vec3(1e-3));
  vec3 alvo = n.ancora + girar(direcao * mix(${f(G.raioDasFalhasPx[0])}, ${f(G.raioDasFalhasPx[1])}, h3), giroDoGrupo(g));
  n.chegada = chegadaDaCelula(cel);
  n.corrigida = correcaoDaCelula(cel, severidade);
  n.pos = mix(vec3(planoDaCelula(cel), 0.0), alvo, n.chegada);
  // Voa em arco para a frente; corrigida, sobe e some.
  n.pos.z += sin(PI * n.chegada) * 60.0;
  n.pos.y += n.corrigida * n.corrigida * 120.0;
  n.cor = mix(uSeveridade[g], uSucesso, smoothstep(0.0, 0.35, n.corrigida));
  n.cor = mix(n.cor, uQuente, uEstavel * 0.22);
  n.alfa = nasceuPoeira(cel) * (1.0 - smoothstep(0.55, 1.0, n.corrigida));
  // Ato 5: a baixa continua, discreta (risco residual aceito).
  if (severidade < 1.5) n.alfa *= 1.0 - ${f(PINTURA.discricaoDaBaixa)} * uEstavel;
  return n.alfa > 0.004;
}

// --- Estrutura: nó central (id 0..3) e intermediários (4..) de cada grupo.
// O grupo resolvido perde os intermediários e fica com o nó central, verde.
float presencaDoGrupo(int g) {
  return min(1.0, uGrupos[g].w * 2.5);
}
vec3 corDoGrupo(int g) {
  return mix(mix(uSeveridade[g], uSucesso, uCura[g]), uQuente, uEstavel * 0.22);
}
// Quem está mais ao fundo aparece menos: profundidade sem buffer de profundidade.
float porProfundidade(float z) {
  return mix(0.5, 1.0, smoothstep(-140.0, 120.0, z));
}
`;

/** Modos: 0 = poeira, 1 = falha, 2 = estrutura. */
const VERTEX_NO = /* glsl */ `
${GLSL_COMUM_3D}
${GLSL_VERTICE_3D}
${GLSL_NOS}

varying vec2 vCanto;
// x = raio do disco (fração do cartaz), y = força do anel.
varying vec2 vForma;
varying vec4 vCor;

void main() {
  float id = float(gl_InstanceID);
  vec3 centro;
  float raioPx;
  vec3 cor;
  float alfa;
  float anel = 0.0;

  if (uModo < 0.5) {
    vec2 cel = celulaDaInstancia(id);
    if (!temPoeira(cel)) { gl_Position = FORA; return; }
    centro = poeira(cel);
    float h = hashCelula(cel + 223.0);
    raioPx = mix(1.1, 2.4, h);
    // Cor partida, como na pintura: o matiz vem de manchas grandes.
    float mancha = ruido(planoDaCelula(cel) * 0.003 + 5.0) + (h - 0.5) * 0.3;
    cor = mancha < 0.4 ? uMatiz[1] : mancha < 0.62 ? uMatiz[2] : uMatiz[3];
    float lateral = smoothstep(0.15, 0.85, abs(centro.x / uTela.x * 2.0));
    alfa = nasceuPoeira(cel) * mix(0.3, 0.7, h) * mix(0.55, 1.0, lateral);
  } else if (uModo < 1.5) {
    Falha n;
    if (!falhaDaCelula(celulaDaInstancia(id), n)) { gl_Position = FORA; return; }
    centro = n.pos;
    raioPx = mix(3.4, 5.2, hashCelula(celulaDaInstancia(id) + 31.0)) * (1.0 - 0.4 * n.corrigida);
    cor = n.cor;
    alfa = n.alfa;
  } else {
    int g = int(id < 4.0 ? id : floor((id - 4.0) / ${SUBNOS}.0));
    float presenca = presencaDoGrupo(g);
    if (id < 4.0) {
      centro = uGrupos[g].xyz;
      raioPx = 7.5;
      anel = 1.0;
      // O nó central fica mesmo com o grupo resolvido (verde, menor).
      alfa = uFormado * mix(0.6, 1.0, presenca);
    } else {
      centro = subNo(g, mod(id - 4.0, ${SUBNOS}.0));
      raioPx = 4.2;
      anel = 0.6;
      alfa = uFormado * presenca;
    }
    cor = corDoGrupo(g);
    if (g == 0) alfa *= 1.0 - ${f(PINTURA.discricaoDaBaixa)} * uEstavel;
  }

  alfa *= porProfundidade(centro.z);
  if (alfa < 0.004) { gl_Position = FORA; return; }
  // O cartaz tem 3× o raio do disco: o resto é o brilho em volta.
  gl_Position = cartaz(centro, position.xy, vec2(raioPx * 3.0));
  vCanto = position.xy;
  vForma = vec2(1.0 / 3.0, anel);
  vCor = vec4(cor, alfa);
}
`;

const FRAGMENT_NO = /* glsl */ `
varying vec2 vCanto;
varying vec2 vForma;
varying vec4 vCor;

void main() {
  float r = length(vCanto);
  float borda = fwidth(r);
  float disco = 1.0 - smoothstep(vForma.x - borda, vForma.x + borda, r);
  // Anel fino em volta: marca os nós da estrutura.
  float anel = vForma.y * (1.0 - smoothstep(borda, borda * 2.5, abs(r - vForma.x * 1.9)));
  float brilho = exp(-r * r * 7.0) * 0.4;
  float alfa = clamp(disco + anel * 0.8 + brilho, 0.0, 1.0) * vCor.a * (1.0 - smoothstep(0.9, 1.0, r));
  // O miolo é um tom mais claro: o nó parece aceso.
  vec3 cor = mix(vCor.rgb, vec3(1.0), ${f(PINTURA.tomClaro)} * disco);
  gl_FragColor = vec4(cor * alfa, alfa);
}
`;

/** Modos: 0 = poeira ↔ vizinho, 1 = falha ↔ nó intermediário, 2 = estrutura. */
const VERTEX_ARESTA = /* glsl */ `
${GLSL_COMUM_3D}
${GLSL_VERTICE_3D}
${GLSL_NOS}

varying vec2 vLinha;
varying vec4 vCor;

void main() {
  float id = float(gl_InstanceID);
  vec3 a;
  vec3 b;
  vec3 cor;
  float alfa;
  float meia = 0.35;

  if (uModo < 0.5) {
    vec2 cel = celulaDaInstancia(floor(id / ${VIZINHOS.length}.0));
    float qual = mod(id, ${VIZINHOS.length}.0);
    vec2 passo = qual < 0.5 ? vec2(${VIZINHOS[0].join(".0, ")}.0)
      : qual < 1.5 ? vec2(${VIZINHOS[1].join(".0, ")}.0) : vec2(${VIZINHOS[2].join(".0, ")}.0);
    vec2 vizinho = cel + passo;
    if (!temPoeira(cel) || !temPoeira(vizinho)) { gl_Position = FORA; return; }
    a = poeira(cel);
    b = poeira(vizinho);
    cor = uMatiz[1];
    float lateral = smoothstep(0.15, 0.85, abs(a.x / uTela.x * 2.0));
    alfa = min(nasceuPoeira(cel), nasceuPoeira(vizinho)) * 0.3 * mix(0.5, 1.0, lateral) * uVirada;
  } else if (uModo < 1.5) {
    Falha n;
    if (!falhaDaCelula(celulaDaInstancia(id), n)) { gl_Position = FORA; return; }
    a = n.ancora;
    b = n.pos;
    cor = n.cor;
    // A aresta só aparece quando a falha chega, e se solta quando é corrigida.
    alfa = n.alfa * 0.75 * smoothstep(0.7, 1.0, n.chegada) * (1.0 - smoothstep(0.0, 0.5, n.corrigida));
  } else if (id < ${4 * SUBNOS}.0) {
    int g = int(floor(id / ${SUBNOS}.0));
    a = uGrupos[g].xyz;
    b = subNo(g, mod(id, ${SUBNOS}.0));
    cor = corDoGrupo(g);
    alfa = 0.7 * uFormado * presencaDoGrupo(g);
    meia = 0.55;
    if (g == 0) alfa *= 1.0 - ${f(PINTURA.discricaoDaBaixa)} * uEstavel;
  } else {
    // Os dois grupos de cada lado se ligam: é uma rede, não quatro ilhas.
    int g = id < ${4 * SUBNOS + 0.5} ? 0 : 2;
    a = uGrupos[g].xyz;
    b = uGrupos[g + 1].xyz;
    cor = mix(corDoGrupo(g), corDoGrupo(g + 1), 0.5);
    alfa = 0.35 * uFormado;
  }

  alfa *= porProfundidade(0.5 * (a.z + b.z));
  if (alfa < 0.004) { gl_Position = FORA; return; }
  float desloc;
  gl_Position = segmento(a, b, position.x, position.y, meia, desloc);
  vLinha = vec2(desloc, meia);
  vCor = vec4(cor, alfa);
}
`;

export function criarGrafo(): Pintura {
  type Camada = { malha: THREE.Mesh<THREE.InstancedBufferGeometry>; porCelula: number; fixas: number };
  const camadas: Camada[] = [];

  const { uniformes, cena, material } = criarCena3d({
    inclinacaoGraus: G.inclinacaoGraus,
    // Os mesmos centros dos grupos 2D: a inclinação é pequena e eles ficam nas laterais.
    centros: (largura, altura) => ([1, 2, 3, 4] as const).map((severidade) => {
      const [x, y] = CENTRO_DOS_GRUPOS[severidade];
      return [x * largura / 2, y * altura / 2, 0] as const;
    }),
    aoAjustar({ celulas }) {
      camadas.forEach(({ malha, porCelula, fixas }) => { malha.geometry.instanceCount = celulas * porCelula + fixas; });
    },
  });

  function camada(tipo: "cartaz" | "segmento", modo: number, porCelula: number, fixas: number): void {
    const malha = new THREE.Mesh(criarQuadInstanciado(tipo), new THREE.ShaderMaterial({
      // Os uniforms comuns são os mesmos objetos; só o modo é de cada camada.
      uniforms: { ...uniformes, uModo: { value: modo } },
      vertexShader: tipo === "cartaz" ? VERTEX_NO : VERTEX_ARESTA,
      fragmentShader: tipo === "cartaz" ? FRAGMENT_NO : FRAGMENT_LINHA_3D,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }));
    // Posições saem do shader; a ordem de criação é a ordem de desenho.
    malha.frustumCulled = false;
    malha.renderOrder = camadas.length;
    cena.add(malha);
    camadas.push({ malha, porCelula, fixas });
  }

  // Arestas antes dos nós: o nó fica por cima da ponta da linha.
  camada("segmento", 0, VIZINHOS.length, 0);
  camada("segmento", 1, 1, 0);
  camada("segmento", 2, 0, 4 * SUBNOS + 2);
  camada("cartaz", 0, 1, 0);
  camada("cartaz", 1, 1, 0);
  camada("cartaz", 2, 0, 4 + 4 * SUBNOS);
  return material;
}
