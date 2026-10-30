/**
 * node-meshes.ts
 *
 * O QUE FAZ
 * Fábrica dos objetos 3D de cada tipo de nó, com geometrias e materiais PBR
 * compartilhados (uma instância por tipo/severidade, não por nó):
 *   INTERNET → globo com clearcoat, meridianos emissivos, atmosfera e órbita;
 *   ASSET    → rack de servidor (lâminas arredondadas metálicas + LEDs);
 *   ENDPOINT → porta hexagonal metálica com núcleo emissivo e anel;
 *   FINDING  → cristal facetado na cor da severidade, brilho por risco.
 *
 * POR QUE EXISTE
 * A cena (`graph-scene.ts`) cuida de câmera, luz e interação; aqui fica só "como
 * cada coisa parece". Um tipo novo de nó (CVE, tecnologia, subdomínio) entra
 * como mais um `case` em `criar`, sem tocar na cena.
 *
 * QUEM USA
 * `graph-scene.ts`, dentro do chunk lazy do grafo.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { DastRisk } from "../../../types/dast.types";
import type { GraphNode } from "../graph-model";
import type { GraphPalette } from "./palette";

export interface NoVisual {
  node: GraphNode;
  /** Posicionada pela cena; a escala de hover/seleção atua aqui. */
  raiz: THREE.Group;
  /** Malhas sólidas usadas no raycast. */
  alvos: THREE.Mesh[];
  /** Animação ociosa; não é chamada com prefers-reduced-motion. */
  animar(t: number): void;
}

const ESCALA_RISCO: Record<DastRisk, number> = { HIGH: 1.3, MEDIUM: 1.1, LOW: 0.95, INFO: 0.8 };
// Emissivo abaixo de ~1 mantém a cor legível; o brilho extra vem do halo e do bloom.
const BRILHO_RISCO: Record<DastRisk, number> = { HIGH: 0.6, MEDIUM: 0.42, LOW: 0.3, INFO: 0.12 };

/** Cor linear acima de 1: com o pipeline HDR do composer, isso é o que acende o bloom. */
function hdr(cor: string, intensidade: number): THREE.Color {
  return new THREE.Color(cor).multiplyScalar(intensidade);
}

/** Paralelos e meridianos de uma esfera como pares de vértices para LineSegments. */
function linhasDoGlobo(raio: number): THREE.BufferGeometry {
  const pontos: THREE.Vector3[] = [];
  const passos = 64;
  for (const lat of [-60, -30, 0, 30, 60]) {
    const phi = THREE.MathUtils.degToRad(lat);
    const r = raio * Math.cos(phi);
    const y = raio * Math.sin(phi);
    for (let i = 0; i < passos; i += 1) {
      const a = (i / passos) * Math.PI * 2;
      const b = ((i + 1) / passos) * Math.PI * 2;
      pontos.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Vector3(Math.cos(b) * r, y, Math.sin(b) * r));
    }
  }
  for (let m = 0; m < 8; m += 1) {
    const theta = (m / 8) * Math.PI;
    for (let i = 0; i < passos; i += 1) {
      const a = (i / passos) * Math.PI * 2;
      const b = ((i + 1) / passos) * Math.PI * 2;
      const ponto = (ang: number) =>
        new THREE.Vector3(Math.cos(ang) * Math.cos(theta) * raio, Math.sin(ang) * raio, Math.cos(ang) * Math.sin(theta) * raio);
      pontos.push(ponto(a), ponto(b));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pontos);
}

function solido(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class KitDeMalhas {
  private readonly geos = {
    globo: new THREE.SphereGeometry(0.55, 48, 32),
    atmosfera: new THREE.SphereGeometry(0.74, 32, 24),
    meridianos: linhasDoGlobo(0.565),
    orbita: new THREE.TorusGeometry(0.98, 0.01, 8, 128),
    satelite: new THREE.SphereGeometry(0.05, 16, 12),
    lamina: new RoundedBoxGeometry(0.95, 0.22, 0.62, 4, 0.05),
    led: new THREE.BoxGeometry(0.42, 0.022, 0.012),
    ledPonto: new THREE.SphereGeometry(0.02, 10, 8),
    pad: new THREE.TorusGeometry(0.62, 0.012, 8, 96),
    porta: new THREE.CylinderGeometry(0.24, 0.24, 0.12, 6),
    nucleoPorta: new THREE.CylinderGeometry(0.11, 0.11, 0.14, 6),
    anelPorta: new THREE.TorusGeometry(0.31, 0.009, 6, 64),
    cristal: new THREE.OctahedronGeometry(0.16, 0),
    halo: new THREE.TorusGeometry(0.3, 0.008, 6, 64),
  };
  private readonly mats = new Map<string, THREE.Material>();
  private readonly esmaecidos = new Map<THREE.Material, THREE.Material>();

  constructor(private readonly paleta: GraphPalette) {}

  private mat<T extends THREE.Material>(chave: string, criar: () => T): T {
    const existente = this.mats.get(chave);
    if (existente) return existente as T;
    const novo = criar();
    this.mats.set(chave, novo);
    return novo;
  }

  private brilho(chave: string, cor: THREE.Color, opacidade = 1): THREE.MeshBasicMaterial {
    return this.mat(chave, () =>
      new THREE.MeshBasicMaterial({
        color: cor,
        transparent: opacidade < 1,
        opacity: opacidade,
        blending: opacidade < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: opacidade === 1,
      }),
    );
  }

  /** Versão translúcida de um material, usada no que fica fora do caminho destacado. */
  esmaecido(original: THREE.Material): THREE.Material {
    let dim = this.esmaecidos.get(original);
    if (!dim) {
      dim = original.clone();
      dim.transparent = true;
      dim.opacity = original.opacity * 0.22;
      dim.depthWrite = false;
      this.esmaecidos.set(original, dim);
    }
    return dim;
  }

  criar(node: GraphNode): NoVisual {
    const raiz = new THREE.Group();
    const corpo = new THREE.Group();
    raiz.add(corpo);
    raiz.userData.nodeId = node.id;
    const alvos: THREE.Mesh[] = [];
    let animar: (t: number) => void = () => {};
    const p = this.paleta;

    switch (node.kind) {
      case "INTERNET": {
        const nucleo = solido(
          this.geos.globo,
          this.mat("globo", () =>
            new THREE.MeshPhysicalMaterial({
              color: p.nucleo,
              metalness: 0.35,
              roughness: 0.22,
              clearcoat: 1,
              clearcoatRoughness: 0.08,
              emissive: p.accentSoft,
              emissiveIntensity: 0.18,
            }),
          ),
        );
        const meridianos = new THREE.LineSegments(
          this.geos.meridianos,
          this.mat("meridianos", () => new THREE.LineBasicMaterial({ color: hdr(p.accent, 1.8), transparent: true, opacity: 0.85 })),
        );
        const atmosfera = new THREE.Mesh(this.geos.atmosfera, this.brilho("atmosfera", hdr(p.accent, 1), 0.1));
        (atmosfera.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
        const orbita = new THREE.Mesh(this.geos.orbita, this.brilho("orbita", hdr(p.accent, 2.2)));
        orbita.rotation.set(Math.PI / 2.3, 0, Math.PI / 9);
        const satelite = new THREE.Mesh(this.geos.satelite, this.brilho("satelite", hdr(p.accent, 4)));
        orbita.add(satelite);
        corpo.add(nucleo, meridianos, atmosfera, orbita);
        alvos.push(nucleo);
        animar = (t) => {
          nucleo.rotation.y = t * 0.15;
          meridianos.rotation.y = t * 0.15;
          satelite.position.set(Math.cos(t * 0.9) * 0.98, Math.sin(t * 0.9) * 0.98, 0);
        };
        break;
      }
      case "ASSET": {
        const metal = this.mat("metal", () =>
          new THREE.MeshStandardMaterial({ color: p.metal, metalness: 0.9, roughness: 0.28 }),
        );
        const ledFaixa = this.brilho("led-faixa", hdr(p.accent, 2.6));
        const ledStatus = this.mat("led-status", () => new THREE.MeshBasicMaterial({ color: hdr("#3ddc97", 3) }));
        for (const y of [-0.25, 0, 0.25]) {
          const lamina = solido(this.geos.lamina, metal);
          lamina.position.y = y;
          const faixa = new THREE.Mesh(this.geos.led, ledFaixa);
          faixa.position.set(-0.13, y, 0.316);
          corpo.add(lamina, faixa);
          alvos.push(lamina);
          for (const x of [0.25, 0.32, 0.39]) {
            const ponto = new THREE.Mesh(this.geos.ledPonto, ledStatus);
            ponto.position.set(x, y, 0.316);
            corpo.add(ponto);
          }
        }
        const pad = new THREE.Mesh(this.geos.pad, this.brilho("pad", hdr(p.accent, 1.6), 0.7));
        pad.rotation.x = Math.PI / 2;
        pad.position.y = -0.48;
        corpo.add(pad);
        const verde = new THREE.Color("#3ddc97");
        animar = (t) => {
          // Piscar de atividade: ritmo irregular para não parecer metrônomo.
          const aceso = Math.sin(t * 3.1) > 0.2 || Math.sin(t * 7.3) > 0.85;
          ledStatus.color.copy(verde).multiplyScalar(aceso ? 3 : 0.4);
          pad.scale.setScalar(1 + Math.sin(t * 1.4) * 0.04);
        };
        break;
      }
      case "ENDPOINT": {
        const porta = solido(
          this.geos.porta,
          this.mat("porta", () => new THREE.MeshStandardMaterial({ color: p.metal, metalness: 0.95, roughness: 0.22 })),
        );
        porta.rotation.x = Math.PI / 2;
        const nucleo = new THREE.Mesh(
          this.geos.nucleoPorta,
          this.mat("nucleo-porta", () =>
            new THREE.MeshStandardMaterial({ color: p.accentSoft, emissive: p.accentSoft, emissiveIntensity: 1.4, roughness: 0.4 }),
          ),
        );
        nucleo.rotation.x = Math.PI / 2;
        const anel = new THREE.Mesh(this.geos.anelPorta, this.brilho("anel-porta", hdr(p.neutral, 1.8), 0.8));
        corpo.add(porta, nucleo, anel);
        alvos.push(porta);
        const fase = Math.random() * Math.PI * 2;
        animar = (t) => {
          corpo.rotation.z = Math.sin(t * 0.5 + fase) * 0.35;
          anel.rotation.z = t * 0.6 + fase;
        };
        break;
      }
      case "FINDING": {
        const risco = node.risk ?? "INFO";
        const cor = p.severidade[risco];
        const cristal = solido(
          this.geos.cristal,
          this.mat(`cristal-${risco}`, () =>
            new THREE.MeshPhysicalMaterial({
              color: cor,
              emissive: cor,
              emissiveIntensity: BRILHO_RISCO[risco],
              metalness: 0.15,
              roughness: 0.28,
              // Clearcoat mais áspero espalha o reflexo da key light; liso, ele estoura em branco no bloom.
              clearcoat: 0.8,
              clearcoatRoughness: 0.32,
              iridescence: 0.4,
              flatShading: true,
            }),
          ),
        );
        const escala = ESCALA_RISCO[risco];
        cristal.scale.set(escala, escala * 1.7, escala);
        corpo.add(cristal);
        alvos.push(cristal);
        let halo: THREE.Mesh | null = null;
        if (risco === "HIGH") {
          halo = new THREE.Mesh(this.geos.halo, this.brilho(`halo-${risco}`, hdr(cor, 1.3), 0.6));
          corpo.add(halo);
        }
        const fase = Math.random() * Math.PI * 2;
        animar = (t) => {
          cristal.rotation.y = t * 0.8 + fase;
          corpo.position.y = Math.sin(t * 1.2 + fase) * 0.05;
          // Só escala: o material do halo é compartilhado entre todos os HIGH.
          if (halo) halo.scale.setScalar(1 + Math.sin(t * 2.2 + fase) * 0.18);
        };
        break;
      }
    }

    return { node, raiz, alvos, animar };
  }

  dispose(): void {
    Object.values(this.geos).forEach((geo) => geo.dispose());
    this.mats.forEach((mat) => mat.dispose());
    this.esmaecidos.forEach((mat) => mat.dispose());
    this.mats.clear();
    this.esmaecidos.clear();
  }
}
