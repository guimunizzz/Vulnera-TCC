/**
 * lib/pdf/dast-report.ts
 *
 * Relatório DAST client-side: capa, sumário executivo (contadores + gráfico
 * de barras), uma seção por finding (HIGH primeiro — a lista já vem ordenada
 * do backend), apêndice com metodologia/limitações. Reaproveita
 * INTEIRAMENTE `lib/pdf/base.ts` (mesma decisão de executive.ts/technical.ts
 * — nenhuma infraestrutura de PDF nova).
 *
 * `severityColor()`/`sanitizeForFont()` de base.ts são genéricos o bastante
 * pro vocabulário HIGH/MEDIUM/LOW/INFO do DAST: risco "INFO" não é uma chave
 * reconhecida em `COLORS.severity` e cai no fallback cinza (NONE) — o MESMO
 * fallback que o `SeverityBadge` da UI usa pro mesmo risco (ver badge.tsx).
 * PDF e tela nunca divergem por acidente porque os dois caem no mesmo lugar.
 *
 * `sanitizeForFont` (chamado por `drawText`/`wrapText` internamente) é
 * obrigatório em todo texto aqui: a saída do ZAP (título, descrição,
 * evidência) vem de request/response HTTP reais e contém caractere fora do
 * WinAnsi/cp1252 com frequência — sem sanitizar, um emoji ou seta unicode
 * num payload de XSS capturado como evidência derruba a geração inteira.
 */

import type { RGB } from "pdf-lib";
import {
  addPage,
  COLORS,
  CONTENT_WIDTH,
  createReportContext,
  drawBarChart,
  drawChip,
  drawCoverPage,
  drawDivider,
  drawFooters,
  drawSectionTitle,
  drawText,
  ensureSpace,
  MARGIN,
  severityColor,
  toBlob,
  type Cursor,
  type ReportContext,
} from "./base";
import type { DastFinding, DastReportData, DastRisk } from "../../types/dast.types";

const RISK_LABELS: Record<DastRisk, string> = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa", INFO: "Informativa" };

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return min > 0 ? `${min}min ${sec}s` : `${sec}s`;
}

export async function generateDastReportPdf(data: DastReportData): Promise<Blob> {
  let targetHostname = data.scan.targetUrl;
  try {
    targetHostname = new URL(data.scan.targetUrl).hostname;
  } catch {
    // targetUrl já foi validado na criação do scan — isso é só defesa extra
  }

  const ctx = await createReportContext(targetHostname);

  drawCoverPage(ctx, {
    reportTypeLabel: "Relatório DAST",
    projectName: data.scan.targetUrl,
    companyName: targetHostname,
    applicationName: "Scan automatizado — OWASP ZAP",
    generatedAt: new Date(),
    subtitle:
      `Análise dinâmica automatizada (spider + active scan). Executado por ${data.requestedByName ?? "—"} · ` +
      `Duração: ${formatDuration(data.scan.durationMs)}.`,
  });

  let cursor: Cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Sumário executivo");
  const total = data.findings.length;
  cursor = drawText(
    ctx,
    cursor,
    `O scan contra ${data.scan.targetUrl} identificou ${total} ${total === 1 ? "alerta" : "alertas"}. ` +
      "Cada um está detalhado, por ordem de severidade, na seção seguinte deste documento.",
    { gapAfter: 16 },
  );

  cursor = drawKpiRow(ctx, cursor, [
    { label: "Total de achados", value: String(total) },
    { label: "Alto", value: String(data.counters.high), color: severityColor("HIGH") },
    { label: "Médio", value: String(data.counters.medium), color: severityColor("MEDIUM") },
    { label: "Baixo", value: String(data.counters.low), color: severityColor("LOW") },
  ]);
  cursor = { ...cursor, y: cursor.y - 10 };

  cursor = drawSectionTitle(ctx, cursor, "Distribuição por risco");
  cursor = drawBarChart(
    ctx,
    cursor,
    (["HIGH", "MEDIUM", "LOW", "INFO"] as DastRisk[]).map((risk) => ({
      label: RISK_LABELS[risk],
      value: data.counters[risk.toLowerCase() as "high" | "medium" | "low" | "info"],
      color: severityColor(risk),
    })),
  );
  cursor = { ...cursor, y: cursor.y - 10 };
  cursor = drawDivider(ctx, cursor);

  cursor = drawSectionTitle(ctx, cursor, "Findings por severidade");
  if (data.findings.length === 0) {
    cursor = drawText(ctx, cursor, "Nenhum alerta encontrado dentro do escopo do alvo.", { color: COLORS.mutedInk });
  }
  for (const [idx, finding] of data.findings.entries()) {
    if (idx > 0) cursor = drawDivider(ctx, cursor, 16);
    cursor = drawFindingSection(ctx, cursor, finding, idx + 1);
  }

  cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Apêndice");
  cursor = drawAppendix(ctx, cursor, data);

  drawFooters(ctx);
  return toBlob(ctx.doc);
}

interface KpiItem {
  label: string;
  value: string;
  color?: RGB;
}

/** Mesmo desenho de executive.ts (não exportado de base.ts — é composição de tela, não primitiva genérica). */
function drawKpiRow(ctx: ReportContext, cursor: Cursor, items: KpiItem[]): Cursor {
  const { page, y } = ensureSpace(ctx, cursor, 60);
  const cardWidth = (CONTENT_WIDTH - (items.length - 1) * 12) / items.length;

  items.forEach((item, idx) => {
    const x = MARGIN + idx * (cardWidth + 12);
    page.drawRectangle({
      x,
      y: y - 50,
      width: cardWidth,
      height: 50,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 0.75,
    });
    page.drawText(item.value, { x: x + 10, y: y - 26, size: 18, font: ctx.fonts.bold, color: item.color ?? COLORS.ink });
    page.drawText(item.label, { x: x + 10, y: y - 42, size: 8, font: ctx.fonts.regular, color: COLORS.mutedInk });
  });

  return { page, y: y - 62 };
}

function drawLabeledBlock(ctx: ReportContext, cursor: Cursor, label: string, content: string): Cursor {
  const step = ensureSpace(ctx, cursor, 30);
  step.page.drawText(label.toUpperCase(), { x: MARGIN, y: step.y, size: 8, font: ctx.fonts.bold, color: COLORS.accent });
  return drawText(ctx, { page: step.page, y: step.y - 13 }, content, { size: 9.5, gapAfter: 10 });
}

function drawFindingSection(ctx: ReportContext, cursor: Cursor, finding: DastFinding, index: number): Cursor {
  let step = ensureSpace(ctx, cursor, 90);

  const chipWidth = drawChip(step.page, ctx.fonts, RISK_LABELS[finding.risk] ?? finding.risk, MARGIN, step.y - 14, severityColor(finding.risk));
  step.page.drawText(finding.title.length > 0 ? `${index}. ${finding.title}` : `${index}. Alerta sem título`, {
    x: MARGIN + chipWidth + 8,
    y: step.y - 11,
    size: 13,
    font: ctx.fonts.bold,
    color: COLORS.ink,
  });
  step = { page: step.page, y: step.y - 30 };

  const metaLine = `Confiança: ${finding.confidence}${finding.cweId ? ` · CWE-${finding.cweId}` : ""}${finding.wascId ? ` · WASC-${finding.wascId}` : ""}`;
  step = drawText(ctx, step, metaLine, { size: 9, color: COLORS.mutedInk, gapAfter: 10 });

  step = drawLabeledBlock(ctx, step, "URL", finding.url);
  if (finding.param) step = drawLabeledBlock(ctx, step, "Parâmetro", finding.param);
  if (finding.description) step = drawLabeledBlock(ctx, step, "Descrição", finding.description);
  if (finding.solution) step = drawLabeledBlock(ctx, step, "Solução", finding.solution);
  if (finding.evidence) step = drawLabeledBlock(ctx, step, "Evidência", finding.evidence);

  return step;
}

function drawAppendix(ctx: ReportContext, cursor: Cursor, data: DastReportData): Cursor {
  let step = drawLabeledBlock(
    ctx,
    cursor,
    "Metodologia",
    "Scan dinâmico automatizado (DAST) com OWASP ZAP: spider primeiro mapeia as páginas alcançáveis a partir da " +
      "URL informada, depois o active scan envia payloads de teste (SQLi, XSS, path traversal, entre outros) " +
      "contra cada página encontrada. Achados são normalizados (URL com IDs variáveis colapsam num único " +
      "identificador) e persistidos com fingerprint estável, para reconhecer o mesmo achado entre execuções.",
  );

  step = drawLabeledBlock(
    ctx,
    step,
    "Versão do ZAP",
    "Não registrada nesta versão do módulo — consulte o relatório HTML original do ZAP (botão \"Ver relatório " +
      "do ZAP\" na tela do scan), que traz a versão exata usada nesta execução no próprio cabeçalho.",
  );

  step = drawLabeledBlock(ctx, step, "Escopo", `Alvo: ${data.scan.targetUrl}. Alertas de domínio fora do alvo são descartados automaticamente.`);

  step = drawLabeledBlock(
    ctx,
    step,
    "Limitações conhecidas",
    "O ZAP não fornece vetor CVSS — os achados deste relatório não são importados para o cadastro geral de " +
      "Vulnerability do Vulnera (módulo é um silo próprio nesta entrega). Não há deduplicação automática ENTRE " +
      "scans diferentes na interface (o fingerprint é estável, mas a comparação histórica fica para uma versão " +
      "futura), nem agendamento recorrente, nem varredura de múltiplos alvos num único scan.",
  );

  return step;
}
