/**
 * features/atmosfera-3d/tipos.ts
 *
 * O contrato entre o hospedeiro das atmosferas 3D (`use-cena-3d.ts`) e cada
 * linha visual em `variantes/`. A variante monta cena e câmera; o hospedeiro
 * cuida de renderer, bloom, ponteiro, risco, tamanho e tema.
 */

import type * as THREE from "three";

import type { ModoDaVariante, TemaDaVariante } from "./tipos-base";

export type { ModoDaVariante, TemaDaVariante } from "./tipos-base";

export interface PaletaDaVariante {
  fundo: THREE.Color;
  tinta: THREE.Color;
  apagada: THREE.Color;
  ciano: THREE.Color;
  magenta: THREE.Color;
}

export interface QuadroDaVariante {
  tempo: number;
  delta: number;
  /** Ponteiro quase sem atraso (-1 a 1, y para cima): o efeito sob o cursor usa este. */
  ponteiro: THREE.Vector2;
  /** Ponteiro bem suavizado: só para o paralaxe da câmera, que não pode tremer. */
  ponteiroCamera: THREE.Vector2;
  /** Energia do ponteiro (0 parado → 1 movendo rápido), decai sozinha. */
  agitacao: number;
  /** 0 a 1: quanto "risco" a cena expressa (mais magenta, mais relevo, mais ping). */
  risco: number;
}

export interface Variante {
  cena: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Bloom do modo imersivo no tema escuro; null = sem bloom. */
  bloom: { forca: number; raio: number; limiar: number } | null;
  atualizar: (quadro: QuadroDaVariante) => void;
  /** Em px CSS; `dpr` é o pixel ratio efetivo do renderer. */
  redimensionar?: (largura: number, altura: number, dpr: number) => void;
  /** Clique no fundo (só no modo imersivo), em coordenadas normalizadas. */
  aoClicar?: (ponteiro: THREE.Vector2, tempo: number) => void;
  /** Troca de página dentro da mesma atmosfera: o radar marca a chegada. */
  aoTrocarRota?: (tempo: number) => void;
}

export type FabricaDeVariante = (paleta: PaletaDaVariante, tema: TemaDaVariante, modo: ModoDaVariante) => Variante;
