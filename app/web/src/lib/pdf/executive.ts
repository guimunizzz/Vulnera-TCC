/**
 * lib/pdf/executive.ts
 *
 * Relatório Executivo (3-5 páginas): capa, sumário executivo, gráfico de
 * barras por severidade, top 5 riscos com recomendação curta, seção de
 * maturidade, conclusão. Público-alvo é gestão, não segurança — texto curto,
 * sem jargão técnico profundo (isso fica pro relatório Técnico).
 *
 * Seção de maturidade (Fase 8) é condicional: `data.maturity` é `null`
 * enquanto a company não tem nenhum MaturityAssessment preenchido — nesse
 * caso o PDF mostra um aviso em vez de tabela/radar vazios. Quando existe,
 * desenha a tabela de médias por domínio + o radar à mão (drawRadarChart —
 * o Recharts da tela não roda dentro de um PDF gerado no cliente).
 */

import type { PDFPage, RGB } from "pdf-lib";
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
  drawRadarChart,
  drawSectionTitle,
  drawText,
  ensureSpace,
  MARGIN,
  sanitizeForFont,
  SEVERITY_LABELS,
  severityColor,
  toBlob,
  type Cursor,
  type ReportContext,
} from "./base";
import { OWASP_LABELS } from "../../types/vulnerability.types";
import { MATURITY_LEVEL_LABELS, type MaturityLevel } from "../../types/maturity.types";
import type { ReportData, ReportMaturityDomain, ReportVulnerability } from "../../types/report.types";

export async function generateExecutivePdf(data: ReportData): Promise<Blob> {
  const ctx = await createReportContext(data.company.name);

  drawCoverPage(ctx, {
    reportTypeLabel: "Relatório Executivo",
    projectName: data.project.name,
    companyName: data.company.name,
    applicationName: data.application.name,
    generatedAt: new Date(),
    subtitle: "Visão consolidada dos riscos identificados na análise, para tomada de decisão.",
  });

  let cursor: Cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Sumário executivo");
  cursor = drawText(
    ctx,
    cursor,
    `A análise "${data.project.name}" na aplicação ${data.application.name} identificou ${data.stats.total} ` +
      `${data.stats.total === 1 ? "vulnerabilidade" : "vulnerabilidades"}. Este documento resume os principais ` +
      `riscos e recomendações; o detalhamento técnico completo, com evidências e comentários, está no Relatório Técnico.`,
    { gapAfter: 16 },
  );

  const openCritical = data.vulnerabilities.filter(
    (v) => v.severityFinal === "CRITICAL" && v.status !== "CLOSED",
  ).length;
  const remediatedCount = data.vulnerabilities.filter((v) => v.status === "FIXED" || v.status === "CLOSED").length;
  const remediatedPct = data.stats.total > 0 ? Math.round((remediatedCount / data.stats.total) * 100) : 0;

  cursor = drawKpiRow(ctx, cursor, [
    { label: "Total de findings", value: String(data.stats.total) },
    { label: "Críticos em aberto", value: String(openCritical), color: COLORS.severity.CRITICAL },
    { label: "Remediados", value: `${remediatedPct}%` },
  ]);
  cursor = { ...cursor, y: cursor.y - 10 };

  cursor = drawSectionTitle(ctx, cursor, "Distribuição por severidade");
  cursor = drawBarChart(
    ctx,
    cursor,
    (["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const).map((sev) => ({
      label: SEVERITY_LABELS[sev],
      value: data.stats.bySeverity[sev],
      color: severityColor(sev),
    })),
  );
  cursor = { ...cursor, y: cursor.y - 10 };
  cursor = drawDivider(ctx, cursor);

  cursor = drawSectionTitle(ctx, cursor, "Top 5 riscos");
  if (data.topRisks.length === 0) {
    cursor = drawText(ctx, cursor, "Nenhum finding registrado nesta análise.", { color: COLORS.mutedInk });
  }
  for (const risk of data.topRisks) {
    cursor = drawRiskCard(ctx, cursor, risk);
  }

  cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Maturidade de segurança");

  if (data.maturity) {
    const levelLabel = MATURITY_LEVEL_LABELS[data.maturity.level as MaturityLevel] ?? data.maturity.level;
    cursor = drawText(
      ctx,
      cursor,
      `Avaliação mais recente em ${new Date(data.maturity.evaluatedAt).toLocaleDateString("pt-BR")} — nível geral ` +
        `${levelLabel} (média ${data.maturity.overallScore.toFixed(2)} de 5). Checklist por domínio, escala 1-5, ` +
        `média simples — sem ponderação entre perguntas ou domínios.`,
      { gapAfter: 16 },
    );

    cursor = drawMaturityTable(ctx, cursor, data.maturity.domains);
    cursor = { ...cursor, y: cursor.y - 10 };

    cursor = drawRadarChart(
      ctx,
      cursor,
      data.maturity.domains.map((d) => ({ label: d.domainName, value: d.average })),
      5,
    );
  } else {
    cursor = drawText(
      ctx,
      cursor,
      "Esta empresa ainda não tem uma avaliação de maturidade de segurança preenchida. O checklist por domínio " +
        "(escala 1-5) pode ser respondido pelo administrador na área de Maturidade da plataforma.",
      { color: COLORS.mutedInk, gapAfter: 16 },
    );
  }

  cursor = drawSectionTitle(ctx, cursor, "Conclusão");
  const conclusionText =
    openCritical > 0
      ? `Recomenda-se priorizar a remediação ${openCritical === 1 ? "do" : "dos"} ${openCritical} ${openCritical === 1 ? "risco crítico" : "riscos críticos"} ` +
        `em aberto antes de novas entregas para o ambiente analisado. Os demais achados devem ser tratados conforme ` +
        `a capacidade do time, seguindo a ordem de severidade indicada neste documento.`
      : "Não há riscos críticos em aberto no momento da geração deste relatório. Recomenda-se manter o acompanhamento " +
        "periódico e tratar os achados de severidade média/baixa conforme a capacidade do time.";
  drawText(ctx, cursor, conclusionText, { gapAfter: 4 });

  drawFooters(ctx);
  return toBlob(ctx.doc);
}

function rightAlignX(page: PDFPage, ctx: ReportContext, text: string, size: number): number {
  return page.getWidth() - MARGIN - ctx.fonts.regular.widthOfTextAtSize(text, size);
}

interface KpiItem {
  label: string;
  value: string;
  color?: RGB;
}

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

function drawRiskCard(ctx: ReportContext, cursor: Cursor, risk: ReportVulnerability): Cursor {
  const { page, y } = ensureSpace(ctx, cursor, 70);

  const chipWidth = drawChip(
    page,
    ctx.fonts,
    SEVERITY_LABELS[risk.severityFinal] ?? risk.severityFinal,
    MARGIN,
    y - 12,
    severityColor(risk.severityFinal),
  );
  page.drawText(sanitizeForFont(risk.title, ctx.fonts.bold), {
    x: MARGIN + chipWidth + 8,
    y: y - 9,
    size: 11,
    font: ctx.fonts.bold,
    color: COLORS.ink,
  });

  const owaspLabel = OWASP_LABELS[risk.owaspCategory as keyof typeof OWASP_LABELS] ?? risk.owaspCategory;
  const scoreLabel = risk.cvssScore !== null ? `CVSS ${risk.cvssScore.toFixed(1)} · ${owaspLabel}` : owaspLabel;
  page.drawText(scoreLabel, {
    x: rightAlignX(page, ctx, scoreLabel, 8),
    y: y - 9,
    size: 8,
    font: ctx.fonts.regular,
    color: COLORS.mutedInk,
  });

  return drawText(ctx, { page, y: y - 24 }, risk.recommendation || "Sem recomendação registrada para este finding.", {
    size: 9,
    color: COLORS.mutedInk,
    gapAfter: 14,
  });
}

/** Tabela simples de 2 colunas (domínio / média) — desenhada linha a linha, mesmo estilo manual do resto do pdf-lib aqui. */
function drawMaturityTable(ctx: ReportContext, cursor: Cursor, domains: ReportMaturityDomain[]): Cursor {
  const rowHeight = 22;
  let { page, y } = ensureSpace(ctx, cursor, rowHeight * 2);

  const headerDomain = "Domínio";
  const headerAvg = "Média (1-5)";
  page.drawText(headerDomain, { x: MARGIN, y: y - 14, size: 9, font: ctx.fonts.bold, color: COLORS.mutedInk });
  page.drawText(headerAvg, {
    x: rightAlignX(page, ctx, headerAvg, 9),
    y: y - 14,
    size: 9,
    font: ctx.fonts.bold,
    color: COLORS.mutedInk,
  });
  y -= rowHeight;
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: MARGIN + CONTENT_WIDTH, y: y + 6 }, thickness: 0.75, color: COLORS.border });

  for (const domain of domains) {
    const step = ensureSpace(ctx, { page, y }, rowHeight);
    page = step.page;
    y = step.y;

    page.drawText(sanitizeForFont(domain.domainName, ctx.fonts.regular), {
      x: MARGIN,
      y: y - 14,
      size: 10,
      font: ctx.fonts.regular,
      color: COLORS.ink,
    });
    const avgLabel = domain.average.toFixed(2);
    page.drawText(avgLabel, {
      x: rightAlignX(page, ctx, avgLabel, 10),
      y: y - 14,
      size: 10,
      font: ctx.fonts.bold,
      color: COLORS.ink,
    });
    y -= rowHeight;
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: MARGIN + CONTENT_WIDTH, y: y + 6 }, thickness: 0.5, color: COLORS.border });
  }

  return { page, y: y - 6 };
}
