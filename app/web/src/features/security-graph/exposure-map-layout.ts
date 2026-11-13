/**
 * exposure-map-layout.ts
 *
 * O QUE FAZ
 * Calcula a "cidade" do mapa 3D da superfície de ataque: um bairro por
 * ambiente (Produção, Homologação, Desenvolvimento) e, dentro dele, um prédio
 * por aplicação. Altura = vulnerabilidades abertas (escala log, para uma
 * aplicação com 80 não esconder as de 3); base = criticidade do negócio;
 * cor = pior severidade aberta; antena = exposta à Internet.
 *
 * POR QUE EXISTE
 * A cena só desenha; a geometria é pura e testável (mesmos dados, mesma
 * cidade). Cada eixo visual corresponde a um campo real da aplicação: nada
 * de altura ou brilho decorativo que a pessoa possa ler como dado.
 *
 * QUEM USA
 * `exposure-map-3d.tsx`.
 */

import type { AplicacaoExposta } from "../../types/exposure-graph.types";
import { RISK_ORDER } from "./graph-2d-layout";
import { ROTULO_AMBIENTE } from "./exposure-graph-model";

export interface Predio {
  app: AplicacaoExposta;
  x: number;
  z: number;
  altura: number;
  base: number;
}

export interface Bairro {
  ambiente: string;
  rotulo: string;
  x: number;
  z: number;
  largura: number;
  profundidade: number;
  predios: Predio[];
}

const ORDEM_AMBIENTE = ["PROD", "HOMOL", "DEV"];
const BASE: Record<string, number> = { CRITICAL: 1.9, HIGH: 1.6, MEDIUM: 1.3, LOW: 1.05 };
/** Distância entre centros de prédios vizinhos (cabe o maior prédio e o nome). */
const PASSO = 3.4;
const FOLGA_BAIRRO = 1.6;
const ENTRE_BAIRROS = 2.4;

export const alturaDoPredio = (abertas: number): number => 0.35 + 1.5 * Math.log2(1 + abertas);

export function montarCidade(aplicacoes: AplicacaoExposta[]): { bairros: Bairro[]; largura: number; profundidade: number } {
  const ambientes = [...new Set(aplicacoes.map((a) => a.environment))].sort(
    (a, b) => (ORDEM_AMBIENTE.indexOf(a) + 1 || 99) - (ORDEM_AMBIENTE.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );
  let cursor = 0;
  const bairros: Bairro[] = ambientes.map((ambiente) => {
    // Mais grave no canto da frente: é o primeiro que a câmera mostra.
    const apps = aplicacoes
      .filter((a) => a.environment === ambiente)
      .sort((a, b) => RISK_ORDER[a.piorSeveridade ?? "INFO"] - RISK_ORDER[b.piorSeveridade ?? "INFO"] || b.totalAbertas - a.totalAbertas || a.name.localeCompare(b.name));
    const colunas = Math.ceil(Math.sqrt(apps.length));
    const linhas = Math.ceil(apps.length / colunas);
    const largura = colunas * PASSO + FOLGA_BAIRRO;
    const profundidade = linhas * PASSO + FOLGA_BAIRRO;
    const x0 = cursor;
    cursor += largura + ENTRE_BAIRROS;
    const predios = apps.map((app, i) => ({
      app,
      x: x0 + FOLGA_BAIRRO / 2 + PASSO / 2 + (i % colunas) * PASSO,
      z: FOLGA_BAIRRO / 2 + PASSO / 2 + Math.floor(i / colunas) * PASSO,
      altura: alturaDoPredio(app.totalAbertas),
      base: BASE[app.criticality] ?? BASE.MEDIUM,
    }));
    return { ambiente, rotulo: ROTULO_AMBIENTE[ambiente] ?? ambiente, x: x0 + largura / 2, z: profundidade / 2, largura, profundidade, predios };
  });
  const largura = Math.max(cursor - ENTRE_BAIRROS, 0);
  const profundidade = Math.max(0, ...bairros.map((b) => b.profundidade));
  // Centraliza a cidade na origem: a câmera orbita em volta de (0, 0, 0).
  for (const b of bairros) {
    b.x -= largura / 2;
    b.z -= profundidade / 2;
    for (const p of b.predios) {
      p.x -= largura / 2;
      p.z -= profundidade / 2;
    }
  }
  return { bairros, largura, profundidade };
}
