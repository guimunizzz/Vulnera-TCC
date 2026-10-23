/**
 * graficos.ts
 *
 * XML dos gráficos nativos do Excel. O ExcelJS não cria gráficos, então este
 * módulo escreve as partes OOXML (`chartN.xml`, `drawing1.xml` e os vínculos)
 * e `injetor.ts` as costura no .xlsx depois.
 *
 * O molde é a saída do XlsxWriter (conhecidamente aceita pelo Excel), com UMA
 * lição do spike aplicada em todo lugar: **todo flag é explícito**
 * (`showCatName val="0"`, `showSerName val="0"`…). Com os flags omitidos, o
 * LibreOffice interpretou o padrão como "verdadeiro" e imprimiu
 * "Baixa; Findings por severidade; 60" em cada rótulo.
 *
 * Cada série traz o CACHE dos pontos (strCache/numCache). Gráfico é desenhado
 * a partir da referência (`<c:f>`), então no Excel ele acompanha as fórmulas;
 * o cache é o que aparece em visualizadores que não recalculam.
 *
 * `plotVisOnly=0`: os dados do gráfico de evolução ficam na aba Auxiliar, que
 * é OCULTA — sem isso o Excel deixaria o gráfico vazio.
 */

import { escaparXml } from "./texto";
import { COR } from "./tema";

export type TipoDeGrafico = "colunas" | "barras";

export interface AncoraDeGrafico {
  /** Índices ZERO-based de coluna/linha (como o `xdr:from`/`xdr:to`). */
  colunaInicio: number;
  linhaInicio: number;
  colunaFim: number;
  linhaFim: number;
}

export interface GraficoNativo {
  tipo: TipoDeGrafico;
  titulo: string;
  nomeDaSerie: string;
  /** `Dashboard!$A$36:$A$40` */
  refCategorias: string;
  categorias: string[];
  /** `Dashboard!$B$36:$B$40` */
  refValores: string;
  valores: number[];
  /** Uma cor RGB por ponto (severidade, status). Sem isto, `corUnica`. */
  corPorPonto?: readonly string[];
  corUnica?: string;
  ancora: AncoraDeGrafico;
}

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const preenchimento = (rgb: string): string => `<a:solidFill><a:srgbClr val="${rgb}"/></a:solidFill>`;

const texto = (tam: number, rgb: string, negrito = false): string =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${tam}" b="${negrito ? 1 : 0}">${preenchimento(rgb)}<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="pt-BR"/></a:p></c:txPr>`;

function cacheDeTextos(valores: string[]): string {
  const pts = valores.map((v, i) => `<c:pt idx="${i}"><c:v>${escaparXml(v)}</c:v></c:pt>`).join("");
  return `<c:strCache><c:ptCount val="${valores.length}"/>${pts}</c:strCache>`;
}

function cacheDeNumeros(valores: number[]): string {
  const pts = valores.map((v, i) => `<c:pt idx="${i}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`).join("");
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${valores.length}"/>${pts}</c:numCache>`;
}

export function xmlDoGrafico(g: GraficoNativo): string {
  const horizontal = g.tipo === "barras";
  const corBase = g.corUnica ?? COR.marinho;

  const pontos = (g.corPorPonto ?? [])
    .slice(0, g.valores.length)
    .map(
      (rgb, i) =>
        `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${preenchimento(rgb)}</c:spPr></c:dPt>`,
    )
    .join("");

  const rotulos =
    '<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>' +
    texto(900, COR.texto, true) +
    '<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>';

  const serie =
    `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${escaparXml(g.nomeDaSerie)}</c:v></c:tx>` +
    `<c:spPr>${preenchimento(corBase)}</c:spPr><c:invertIfNegative val="0"/>${pontos}${rotulos}` +
    `<c:cat><c:strRef><c:f>${escaparXml(g.refCategorias)}</c:f>${cacheDeTextos(g.categorias)}</c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${escaparXml(g.refValores)}</c:f>${cacheDeNumeros(g.valores)}</c:numRef></c:val></c:ser>`;

  const idCat = 50010001;
  const idVal = 50010002;

  // Barras horizontais: a categoria #1 fica no TOPO (eixo invertido), e o eixo
  // de valores some — os rótulos de dados já dizem o número.
  const eixoCategoria =
    `<c:catAx><c:axId val="${idCat}"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln w="9525">${preenchimento(COR.borda)}</a:ln></c:spPr>${texto(900, COR.texto)}` +
    `<c:crossAx val="${idVal}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;

  const eixoValores =
    `<c:valAx><c:axId val="${idVal}"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="${horizontal ? 1 : 0}"/>` +
    `<c:axPos val="${horizontal ? "b" : "l"}"/>` +
    (horizontal ? "" : `<c:majorGridlines><c:spPr><a:ln w="6350">${preenchimento("E5E9F0")}</a:ln></c:spPr></c:majorGridlines>`) +
    `<c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${texto(900, COR.textoSuave)}` +
    `<c:crossAx val="${idCat}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;

  const titulo =
    `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1">${preenchimento(COR.marinho)}</a:defRPr></a:pPr>` +
    `<a:r><a:rPr lang="pt-BR" sz="1200" b="1">${preenchimento(COR.marinho)}<a:latin typeface="Calibri"/></a:rPr><a:t>${escaparXml(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:date1904 val="0"/><c:lang val="pt-BR"/><c:roundedCorners val="0"/>` +
    `<c:chart>${titulo}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>` +
    `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${serie}<c:gapWidth val="60"/>` +
    `<c:axId val="${idCat}"/><c:axId val="${idVal}"/></c:barChart>${eixoCategoria}${eixoValores}</c:plotArea>` +
    `<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr>${preenchimento(COR.branco)}<a:ln w="9525">${preenchimento(COR.borda)}</a:ln></c:spPr>` +
    `${texto(1000, COR.texto)}` +
    `<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`
  );
}

/** `drawing1.xml`: um `twoCellAnchor` por gráfico, cada um ligado a um `rIdN`. */
export function xmlDoDesenho(graficos: GraficoNativo[]): string {
  const ancoras = graficos
    .map((g, i) => {
      const a = g.ancora;
      return (
        `<xdr:twoCellAnchor><xdr:from><xdr:col>${a.colunaInicio}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.linhaInicio}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${a.colunaFim}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.linhaFim}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
        `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}">` +
        `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
      );
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}">${ancoras}</xdr:wsDr>`
  );
}

const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const TIPO = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export function relsDaAba(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${TIPO}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
}

export function relsDoDesenho(n: number): string {
  const itens = Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 1}" Type="${TIPO}/chart" Target="../charts/chart${i + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${REL}">${itens}</Relationships>`;
}

/** Overrides de `[Content_Types].xml` para o desenho e para cada gráfico. */
export function contentTypesDosGraficos(n: number): string {
  const graficos = Array.from(
    { length: n },
    (_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
  ).join("");
  return `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>${graficos}`;
}
