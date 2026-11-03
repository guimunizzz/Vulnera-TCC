/**
 * qualidade.ts
 *
 * O QUE FAZ
 * Decide, pela média do tempo de quadro, se a cena 3D deve baixar a qualidade:
 *   0 = completa · 1 = resolução 1× · 2 = sem bloom e sem sombra dinâmica.
 *
 * POR QUE EXISTE
 * O grafo foi medido só na máquina de desenvolvimento. Em GPU integrada fraca
 * (o notebook da apresentação, um celular), cair para 20 FPS faria a cena
 * parecer quebrada; perder o brilho é melhor que perder a fluidez. Só desce,
 * nunca sobe: oscilar entre níveis piscaria a imagem.
 *
 * QUEM USA
 * `graph-scene.ts`.
 */

export type NivelQualidade = 0 | 1 | 2;

/** Abaixo de ~40 FPS sustentados a interação já parece pesada. */
export const QUADRO_LENTO_MS = 25;
/** Quadros por janela de medida (~2 s a 60 FPS). */
export const JANELA_QUADROS = 120;
/** Intervalo maior que isso é aba voltando do segundo plano, não lentidão. */
export const INTERVALO_IGNORADO_MS = 250;

export function proximoNivel(mediaMs: number, nivel: NivelQualidade): NivelQualidade {
  if (mediaMs <= QUADRO_LENTO_MS || nivel === 2) return nivel;
  return nivel === 0 ? 1 : 2;
}
