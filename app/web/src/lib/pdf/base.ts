/**
 * lib/pdf/base.ts
 *
 * Helpers reutilizáveis pros dois relatórios (executive.ts / technical.ts).
 * pdf-lib é IMPERATIVO: não existem componentes React como no
 * @react-pdf/renderer (decisão revertida, ver CLAUDE.md Fase 6) — aqui a
 * gente cria o PDFDocument, adiciona páginas e desenha texto/retângulo por
 * coordenada (origem no canto INFERIOR esquerdo, eixo Y cresce pra cima).
 *
 * Paleta ("layout temático"): as cores de identidade do produto — verde de
 * destaque e a paleta de severidade — são as MESMAS de app/web/tailwind.config.ts,
 * pra quem já usa o app reconhecer o relatório de cara. A capa reproduz o
 * tema escuro da UI (fundo quase preto + texto claro); as páginas de
 * conteúdo usam fundo branco com texto escuro — um PDF técnico de 20+
 * páginas em tema escuro gasta tinta/torra os olhos na impressão, então as
 * páginas de corpo usam tons de tinta/cinza pensados pra leitura impressa
 * em vez de reaproveitar literalmente os tokens escuros (background/border/
 * muted) da UI.
 */

import { PDFDocument, type PDFFont, type PDFPage, rgb, type RGB, StandardFonts } from "pdf-lib";

export const PAGE_WIDTH = 595.28; // A4 em pontos (72dpi)
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 50;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Verde de destaque e paleta de severidade = tailwind.config.ts (app/web),
// literalmente os mesmos hex. Ink/muted/border das páginas de conteúdo são
// tons de impressão equivalentes (não os tokens escuros da UI — ver cabeçalho).
export const COLORS = {
  coverBackground: rgb(0x0a / 255, 0x0a / 255, 0x0a / 255),
  coverForeground: rgb(0xfa / 255, 0xfa / 255, 0xfa / 255),
  coverMuted: rgb(0xa3 / 255, 0xa3 / 255, 0xa3 / 255),

  white: rgb(1, 1, 1),
  ink: rgb(0.06, 0.09, 0.13),
  mutedInk: rgb(0.42, 0.45, 0.5),
  border: rgb(0.89, 0.9, 0.92),

  accent: rgb(0x10 / 255, 0xb9 / 255, 0x81 / 255),
  accentForeground: rgb(0x05 / 255, 0x2e / 255, 0x1f / 255),

  severity: {
    CRITICAL: rgb(0xdc / 255, 0x26 / 255, 0x26 / 255),
    HIGH: rgb(0xf9 / 255, 0x73 / 255, 0x16 / 255),
    MEDIUM: rgb(0xea / 255, 0xb3 / 255, 0x08 / 255),
    LOW: rgb(0x3b / 255, 0x82 / 255, 0xf6 / 255),
    NONE: rgb(0x6b / 255, 0x72 / 255, 0x80 / 255),
  },
} as const;

export type SeverityKey = keyof typeof COLORS.severity;

export interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function embedFonts(doc: PDFDocument): Promise<PdfFonts> {
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { regular, bold };
}

/** Estado compartilhado por todo o desenho do relatório — passado adiante em vez de global. */
export interface ReportContext {
  doc: PDFDocument;
  fonts: PdfFonts;
  companyName: string;
}

/** Posição de "escrita atual": página + altura Y restante. */
export interface Cursor {
  page: PDFPage;
  y: number;
}

/** Cria uma página A4 em branco com o cabeçalho (barra + wordmark + nome da empresa) já desenhado. */
export function addPage(ctx: ReportContext): Cursor {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, ctx);
  return { page, y: PAGE_HEIGHT - MARGIN - 34 };
}

function drawHeader(page: PDFPage, ctx: ReportContext): void {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: COLORS.accent });
  page.drawText("VULNERA", {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN + 6,
    size: 10,
    font: ctx.fonts.bold,
    color: COLORS.accent,
  });
  const companyLabel = sanitizeForFont(ctx.companyName, ctx.fonts.regular);
  page.drawText(companyLabel, {
    x: PAGE_WIDTH - MARGIN - ctx.fonts.regular.widthOfTextAtSize(companyLabel, 9),
    y: PAGE_HEIGHT - MARGIN + 6,
    size: 9,
    font: ctx.fonts.regular,
    color: COLORS.mutedInk,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 4 },
    thickness: 0.75,
    color: COLORS.border,
  });
}

/** Rodapé paginado — chamar por ÚLTIMO, depois que todo o conteúdo já foi desenhado (só aí sabemos o total de páginas). */
export function drawFooters(ctx: ReportContext): void {
  const pages = ctx.doc.getPages();
  pages.forEach((page, idx) => {
    const label = `Página ${idx + 1} de ${pages.length}`;
    page.drawText(label, {
      x: PAGE_WIDTH - MARGIN - ctx.fonts.regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 22,
      size: 8,
      font: ctx.fonts.regular,
      color: COLORS.mutedInk,
    });
    page.drawText("Gerado por Vulnera — documento confidencial", {
      x: MARGIN,
      y: MARGIN - 22,
      size: 8,
      font: ctx.fonts.regular,
      color: COLORS.mutedInk,
    });
  });
}

export interface CoverPageOptions {
  reportTypeLabel: string;
  projectName: string;
  companyName: string;
  applicationName: string;
  generatedAt: Date;
  subtitle?: string;
}

/** Capa em tema escuro (replica a UI) — única página do documento sem o cabeçalho branco padrão. */
export function drawCoverPage(ctx: ReportContext, opts: CoverPageOptions): void {
  const page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.coverBackground });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 10, width: PAGE_WIDTH, height: 10, color: COLORS.accent });

  page.drawText("VULNERA", { x: MARGIN, y: PAGE_HEIGHT - 150, size: 34, font: ctx.fonts.bold, color: COLORS.accent });
  page.drawText("Gestão de análises de segurança", {
    x: MARGIN,
    y: PAGE_HEIGHT - 172,
    size: 11,
    font: ctx.fonts.regular,
    color: COLORS.coverMuted,
  });

  page.drawText(opts.reportTypeLabel, {
    x: MARGIN,
    y: PAGE_HEIGHT - 270,
    size: 24,
    font: ctx.fonts.bold,
    color: COLORS.coverForeground,
  });
  let projectNameY = PAGE_HEIGHT - 298;
  for (const line of wrapText(opts.projectName, ctx.fonts.regular, 16, CONTENT_WIDTH)) {
    page.drawText(line, { x: MARGIN, y: projectNameY, size: 16, font: ctx.fonts.regular, color: COLORS.coverForeground });
    projectNameY -= 19;
  }

  const meta: Array<[string, string]> = [
    ["Empresa", sanitizeForFont(opts.companyName, ctx.fonts.regular)],
    ["Aplicação", sanitizeForFont(opts.applicationName, ctx.fonts.regular)],
    [
      "Gerado em",
      `${opts.generatedAt.toLocaleDateString("pt-BR")} às ${opts.generatedAt.toLocaleTimeString("pt-BR").slice(0, 5)}`,
    ],
  ];
  let y = PAGE_HEIGHT - 350;
  for (const [label, value] of meta) {
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: 9, font: ctx.fonts.bold, color: COLORS.accent });
    page.drawText(value, { x: MARGIN, y: y - 16, size: 12, font: ctx.fonts.regular, color: COLORS.coverForeground });
    y -= 46;
  }

  if (opts.subtitle) {
    let subtitleY = 105;
    for (const line of wrapText(opts.subtitle, ctx.fonts.regular, 9, CONTENT_WIDTH)) {
      page.drawText(line, { x: MARGIN, y: subtitleY, size: 9, font: ctx.fonts.regular, color: COLORS.coverMuted });
      subtitleY -= 12;
    }
  }
  page.drawText("Documento confidencial — uso restrito às partes envolvidas na análise.", {
    x: MARGIN,
    y: 60,
    size: 8,
    font: ctx.fonts.regular,
    color: COLORS.coverMuted,
  });
}

/**
 * StandardFonts (Helvetica) só codifica WinAnsi/cp1252 — cobre acentos PT-BR
 * e pontuação tipográfica (—, ", ', …) de sobra, mas NÃO cobre emoji nem
 * setas unicode (→, ⇒...). Título/descrição/comentário de finding é texto
 * digitado por usuário: sem sanitizar, um único emoji colado num comentário
 * derruba a geração do PDF inteiro com uma exceção do pdf-lib. Em vez de
 * manter à mão uma tabela de "quais code points o cp1252 cobre", pergunta
 * pro próprio pdf-lib caractere a caractere (ele lança se não tem glifo).
 */
export function sanitizeForFont(text: string, font: PDFFont): string {
  let out = "";
  for (const char of text) {
    if (char === "\n" || char === "\r" || char === "\t") {
      out += " ";
      continue;
    }
    try {
      font.widthOfTextAtSize(char, 10);
      out += char;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Quebra `text` em linhas que cabem em `maxWidth` na fonte/tamanho dados. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = sanitizeForFont(text, font);
  const words = safe.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/** Garante que sobra pelo menos `height` de espaço na página atual — se não sobrar, já pula pra próxima. */
export function ensureSpace(ctx: ReportContext, cursor: Cursor, height: number): Cursor {
  if (cursor.y - height < MARGIN + 20) return addPage(ctx);
  return cursor;
}

export interface DrawTextOptions {
  font?: PDFFont;
  size?: number;
  color?: RGB;
  maxWidth?: number;
  lineHeight?: number;
  gapAfter?: number;
}

/** Desenha texto com quebra de linha automática, pulando de página sozinho quando o texto não cabe mais. */
export function drawText(ctx: ReportContext, cursor: Cursor, text: string, options: DrawTextOptions = {}): Cursor {
  const font = options.font ?? ctx.fonts.regular;
  const size = options.size ?? 10;
  const color = options.color ?? COLORS.ink;
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
  const lineHeight = options.lineHeight ?? size * 1.45;

  let { page, y } = cursor;
  const lines = wrapText(text, font, size, maxWidth);

  for (const line of lines) {
    if (y < MARGIN + 24) {
      const next = addPage(ctx);
      page = next.page;
      y = next.y;
    }
    page.drawText(line, { x: MARGIN, y, size, font, color });
    y -= lineHeight;
  }

  return { page, y: y - (options.gapAfter ?? 0) };
}

/** Título de seção com barrinha de destaque na cor de marca — âncora visual reconhecível ao longo do documento. */
export function drawSectionTitle(ctx: ReportContext, cursor: Cursor, title: string): Cursor {
  const { page, y } = ensureSpace(ctx, cursor, 40);
  page.drawRectangle({ x: MARGIN, y: y - 3, width: 4, height: 15, color: COLORS.accent });
  page.drawText(title, { x: MARGIN + 12, y, size: 13, font: ctx.fonts.bold, color: COLORS.ink });
  return { page, y: y - 24 };
}

export function drawDivider(ctx: ReportContext, cursor: Cursor, gapAfter = 12): Cursor {
  const { page, y } = ensureSpace(ctx, cursor, 10);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.75,
    color: COLORS.border,
  });
  return { page, y: y - gapAfter };
}

export interface BarChartDatum {
  label: string;
  value: number;
  color: RGB;
}

/** Gráfico de barras horizontais desenhado à mão — retângulo proporcional ao maior valor do conjunto. */
export function drawBarChart(ctx: ReportContext, cursor: Cursor, data: BarChartDatum[]): Cursor {
  const barHeight = 16;
  const gap = 10;
  const labelWidth = 95;
  const valueWidth = 26;
  const trackWidth = CONTENT_WIDTH - labelWidth - valueWidth;
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  let { page, y } = cursor;

  for (const datum of data) {
    const step = ensureSpace(ctx, { page, y }, barHeight + gap);
    page = step.page;
    y = step.y;

    page.drawText(datum.label, {
      x: MARGIN,
      y: y - barHeight + 4,
      size: 9,
      font: ctx.fonts.regular,
      color: COLORS.ink,
    });
    page.drawRectangle({
      x: MARGIN + labelWidth,
      y: y - barHeight,
      width: trackWidth,
      height: barHeight,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 0.5,
    });
    const barWidth = datum.value > 0 ? Math.max(3, (datum.value / maxValue) * trackWidth) : 0;
    if (barWidth > 0) {
      page.drawRectangle({ x: MARGIN + labelWidth, y: y - barHeight, width: barWidth, height: barHeight, color: datum.color });
    }
    page.drawText(String(datum.value), {
      x: MARGIN + labelWidth + trackWidth + 8,
      y: y - barHeight + 4,
      size: 9,
      font: ctx.fonts.bold,
      color: COLORS.ink,
    });

    y -= barHeight + gap;
  }

  return { page, y };
}

/** Chip colorido (ex: severidade) — mesma linguagem visual do SeverityBadge da UI. */
export function drawChip(
  page: PDFPage,
  fonts: PdfFonts,
  text: string,
  x: number,
  y: number,
  color: RGB,
): number {
  const size = 8;
  const paddingX = 6;
  const width = fonts.bold.widthOfTextAtSize(text, size) + paddingX * 2;
  page.drawRectangle({ x, y, width, height: 14, color });
  page.drawText(text, { x: x + paddingX, y: y + 4, size, font: fonts.bold, color: COLORS.white });
  return width;
}

export function severityColor(severity: string): RGB {
  return (COLORS.severity as Record<string, RGB>)[severity] ?? COLORS.severity.NONE;
}

// Mesmos rótulos PT-BR do SeverityBadge/FindingStatusBadge (components/ui) —
// fonte única pros dois PDFs não divergirem da UI nem entre si.
export const SEVERITY_LABELS: Record<string, string> = {
  NONE: "Nenhuma",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  FIXED: "Corrigido",
  CLOSED: "Fechado",
};

export async function createReportContext(companyName: string): Promise<ReportContext> {
  const doc = await PDFDocument.create();
  doc.setTitle("Relatório Vulnera");
  doc.setProducer("Vulnera");
  const fonts = await embedFonts(doc);
  return { doc, fonts, companyName };
}

/** Serializa o PDF e devolve como Blob, pronto pra download via URL.createObjectURL. */
export async function toBlob(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save();
  // O Uint8Array do pdf-lib carrega um ArrayBufferLike genérico (@types/node
  // no classpath vs lib.dom exigindo ArrayBuffer) — o array literal como
  // BlobPart[] evita a fricção de tipos sem cópia extra em runtime.
  return new Blob([bytes] as BlobPart[], { type: "application/pdf" });
}

/** Dispara o download do Blob no browser sem depender de nenhum link pré-existente no DOM. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
