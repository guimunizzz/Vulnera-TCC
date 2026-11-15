/**
 * exportar.ts
 *
 * O QUE FAZ
 * Gera o PNG do CyberGraph 2D a partir do SVG da tela e baixa um Blob como arquivo.
 *
 * POR QUE EXISTE
 * O PNG vai para relatório e slides. O SVG da tela usa as cores como
 * `oklch(var(--token))`: fora da página essas variáveis não existem, então elas
 * são trocadas pelos valores do tema atual antes de virar imagem.
 * Não reaproveita `downloadBlob` de `lib/pdf/base.ts` porque aquele módulo
 * importa o pdf-lib, que entraria inteiro no chunk do grafo.
 *
 * QUEM USA
 * `cyber-graph.tsx` e `cyber-graph-2d.tsx`.
 */

export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Troca `var(--x)` pelo valor computado no tema atual (os tokens guardam "L C H"). */
export function resolverVariaveis(texto: string, estilo: Pick<CSSStyleDeclaration, "getPropertyValue">): string {
  return texto.replace(/var\((--[\w-]+)\)/g, (original, nome: string) => estilo.getPropertyValue(nome).trim() || original);
}

/**
 * Renderiza um SVG (já com a caixa de visão do conteúdo inteiro) num PNG.
 * `escala` 2 dá nitidez de tela retina para colar em documento.
 */
export async function svgParaPng(svg: SVGSVGElement, largura: number, altura: number, escala = 2): Promise<Blob | null> {
  const texto = resolverVariaveis(new XMLSerializer().serializeToString(svg), getComputedStyle(document.documentElement));
  const url = URL.createObjectURL(new Blob([texto], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const tela = document.createElement("canvas");
    tela.width = Math.round(largura * escala);
    tela.height = Math.round(altura * escala);
    const ctx = tela.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(imagem, 0, 0, tela.width, tela.height);
    return await new Promise((resolver) => tela.toBlob(resolver, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
