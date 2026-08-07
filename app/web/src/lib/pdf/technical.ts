/**
 * lib/pdf/technical.ts
 *
 * Relatório Técnico (20+ páginas): capa, sumário, uma seção por finding
 * (título, severidade, vetor CVSS + score, OWASP, descrição, impacto,
 * recomendação, evidências PNG/JPEG embutidas e comentários), apêndice com
 * glossário. Público-alvo é o time técnico — nada é resumido aqui.
 *
 * Evidências: só image/png e image/jpeg são embutidas de fato (embedPng/
 * embedJpg do pdf-lib exigem um formato de imagem raster; PDF/TXT viram uma
 * linha de referência em texto, já que não têm como virar pixel). O arquivo
 * é buscado pelo endpoint autenticado de download (mesma checagem de acesso
 * à company que o resto do produto usa) — o PDF nunca embute nada que o
 * ator não teria permissão de ver na tela.
 */

import {
  addPage,
  COLORS,
  CONTENT_WIDTH,
  createReportContext,
  drawChip,
  drawCoverPage,
  drawDivider,
  drawFooters,
  drawSectionTitle,
  drawText,
  ensureSpace,
  MARGIN,
  sanitizeForFont,
  SEVERITY_LABELS,
  severityColor,
  STATUS_LABELS,
  toBlob,
  type Cursor,
  type ReportContext,
} from "./base";
import { OWASP_LABELS } from "../../types/vulnerability.types";
import { evidencesApi } from "../api/evidences.api";
import type { ReportData, ReportVulnerability } from "../../types/report.types";
import type { Evidence } from "../../types/evidence.types";

const GLOSSARY: Array<[string, string]> = [
  ["CVSS", "Common Vulnerability Scoring System — padrão da FIRST para pontuar a severidade técnica de uma vulnerabilidade, de 0 a 10, a partir de 8 métricas (AV/AC/PR/UI/S/C/I/A)."],
  ["OWASP Top 10", "Lista das 10 categorias de risco mais críticas em aplicações web, mantida pela OWASP Foundation — edição 2021, usada como categoria obrigatória de cada finding neste produto."],
  ["Severidade calculada", "Severidade derivada automaticamente do score CVSS a partir do vetor informado, sem intervenção manual."],
  ["Severidade final / override", "Severidade que prevalece na priorização — igual à calculada, ou substituída manualmente por um analista com justificativa obrigatória (mínimo 20 caracteres), sempre registrada em auditoria."],
  ["Evidência", "Anexo (captura de tela, log ou documento) que comprova a existência do finding, validado por assinatura de bytes (magic number) no upload."],
  ["Status do finding", "Estado do ciclo de vida do finding: Aberto -> Em andamento -> Corrigido -> Fechado."],
  ["Instância individual", "Cada finding é um registro único, ligado a um Project/Application/Company específicos — não existe um catálogo global de vulnerabilidades reaproveitado entre clientes."],
];

export async function generateTechnicalPdf(data: ReportData): Promise<Blob> {
  const ctx = await createReportContext(data.company.name);

  drawCoverPage(ctx, {
    reportTypeLabel: "Relatório Técnico",
    projectName: data.project.name,
    companyName: data.company.name,
    applicationName: data.application.name,
    generatedAt: new Date(),
    subtitle: "Detalhamento técnico completo de cada finding, com evidências e histórico de comentários.",
  });

  let cursor: Cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Sumário");
  cursor = drawText(
    ctx,
    cursor,
    `${data.stats.total} finding(s) registrados na análise "${data.project.name}" (aplicação ${data.application.name}). ` +
      `Cada um é detalhado em sua própria seção a seguir, na ordem abaixo.`,
    { gapAfter: 14 },
  );
  if (data.vulnerabilities.length === 0) {
    cursor = drawText(ctx, cursor, "Nenhum finding registrado nesta análise.", { color: COLORS.mutedInk });
  }
  data.vulnerabilities.forEach((v, idx) => {
    cursor = drawSummaryRow(ctx, cursor, v, idx + 1);
  });

  cursor = addPage(ctx);
  for (const [idx, vulnerability] of data.vulnerabilities.entries()) {
    if (idx > 0) cursor = drawDivider(ctx, cursor, 16);
    cursor = await drawFindingSection(ctx, cursor, vulnerability, idx + 1);
  }

  cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Apêndice — Glossário");
  drawGlossary(ctx, cursor);

  drawFooters(ctx);
  return toBlob(ctx.doc);
}

function drawSummaryRow(ctx: ReportContext, cursor: Cursor, v: ReportVulnerability, index: number): Cursor {
  const step = ensureSpace(ctx, cursor, 20);
  const chipWidth = drawChip(
    step.page,
    ctx.fonts,
    SEVERITY_LABELS[v.severityFinal] ?? v.severityFinal,
    MARGIN,
    step.y - 3,
    severityColor(v.severityFinal),
  );
  step.page.drawText(sanitizeForFont(`${index}. ${v.title}`, ctx.fonts.regular), {
    x: MARGIN + chipWidth + 8,
    y: step.y,
    size: 9.5,
    font: ctx.fonts.regular,
    color: COLORS.ink,
  });
  return { page: step.page, y: step.y - 20 };
}

async function drawFindingSection(
  ctx: ReportContext,
  cursor: Cursor,
  v: ReportVulnerability,
  index: number,
): Promise<Cursor> {
  let step = ensureSpace(ctx, cursor, 90);

  const chipWidth = drawChip(
    step.page,
    ctx.fonts,
    SEVERITY_LABELS[v.severityFinal] ?? v.severityFinal,
    MARGIN,
    step.y - 14,
    severityColor(v.severityFinal),
  );
  step.page.drawText(sanitizeForFont(`${index}. ${v.title}`, ctx.fonts.bold), {
    x: MARGIN + chipWidth + 8,
    y: step.y - 11,
    size: 13,
    font: ctx.fonts.bold,
    color: COLORS.ink,
  });
  step = { page: step.page, y: step.y - 30 };

  const owaspLabel = OWASP_LABELS[v.owaspCategory as keyof typeof OWASP_LABELS] ?? v.owaspCategory;
  const cvssLabel = v.cvssVector ? `${v.cvssVector} (${v.cvssScore?.toFixed(1) ?? "—"})` : "—";
  const metaLine = `${owaspLabel}  ·  CVSS: ${cvssLabel}  ·  Status: ${STATUS_LABELS[v.status] ?? v.status}`;
  step = drawText(ctx, step, metaLine, { size: 9, color: COLORS.mutedInk, gapAfter: 10 });

  step = drawLabeledBlock(ctx, step, "Descrição", v.description);
  if (v.impact) step = drawLabeledBlock(ctx, step, "Impacto", v.impact);
  if (v.recommendation) step = drawLabeledBlock(ctx, step, "Recomendação", v.recommendation);
  if (v.severityOverrideReason) {
    step = drawLabeledBlock(ctx, step, "Justificativa do override de severidade", v.severityOverrideReason);
  }
  step = drawLabeledBlock(ctx, step, "Registrado por", v.createdByName);

  if (v.evidences.length > 0) {
    step = drawSubheading(ctx, step, `Evidências (${v.evidences.length})`);
    for (const evidence of v.evidences) {
      step = await drawEvidence(ctx, step, v.id, evidence);
    }
  }

  if (v.comments.length > 0) {
    step = drawSubheading(ctx, step, `Comentários (${v.comments.length})`);
    for (const comment of v.comments) {
      step = drawText(ctx, step, `${comment.authorName} — ${new Date(comment.createdAt).toLocaleString("pt-BR")}`, {
        size: 8,
        font: ctx.fonts.bold,
        color: COLORS.mutedInk,
        gapAfter: 2,
      });
      step = drawText(ctx, step, comment.content, { size: 9, gapAfter: 10 });
    }
  }

  return step;
}

function drawLabeledBlock(ctx: ReportContext, cursor: Cursor, label: string, content: string): Cursor {
  const step = ensureSpace(ctx, cursor, 30);
  step.page.drawText(label.toUpperCase(), { x: MARGIN, y: step.y, size: 8, font: ctx.fonts.bold, color: COLORS.accent });
  return drawText(ctx, { page: step.page, y: step.y - 13 }, content, { size: 9.5, gapAfter: 10 });
}

function drawSubheading(ctx: ReportContext, cursor: Cursor, text: string): Cursor {
  const step = ensureSpace(ctx, cursor, 24);
  step.page.drawText(text, { x: MARGIN, y: step.y, size: 10, font: ctx.fonts.bold, color: COLORS.ink });
  return { page: step.page, y: step.y - 16 };
}

const MAX_EVIDENCE_HEIGHT = 220;

async function drawEvidence(ctx: ReportContext, cursor: Cursor, vulnerabilityId: string, evidence: Evidence): Promise<Cursor> {
  if (evidence.mimeType !== "image/png" && evidence.mimeType !== "image/jpeg") {
    return drawText(
      ctx,
      cursor,
      `Anexo: ${evidence.originalName} (${evidence.mimeType}) — disponível no sistema, formato não embutível neste PDF.`,
      { size: 9, color: COLORS.mutedInk, gapAfter: 10 },
    );
  }

  try {
    const blob = await evidencesApi.download(vulnerabilityId, evidence.id);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = evidence.mimeType === "image/png" ? await ctx.doc.embedPng(bytes) : await ctx.doc.embedJpg(bytes);

    const scale = Math.min(CONTENT_WIDTH / image.width, MAX_EVIDENCE_HEIGHT / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;

    let step = ensureSpace(ctx, cursor, height + 26);
    // sem `color` — só a borda, a imagem por baixo já preenche o miolo
    step.page.drawRectangle({
      x: MARGIN - 1,
      y: step.y - height - 1,
      width: width + 2,
      height: height + 2,
      borderColor: COLORS.border,
      borderWidth: 0.75,
    });
    step.page.drawImage(image, { x: MARGIN, y: step.y - height, width, height });
    step = { page: step.page, y: step.y - height - 6 };
    return drawText(ctx, step, evidence.proof || evidence.originalName, {
      size: 8,
      color: COLORS.mutedInk,
      gapAfter: 12,
    });
  } catch {
    return drawText(ctx, cursor, `Aviso: não foi possível carregar a evidência "${evidence.originalName}" para este PDF.`, {
      size: 9,
      color: COLORS.mutedInk,
      gapAfter: 10,
    });
  }
}

function drawGlossary(ctx: ReportContext, cursor: Cursor): Cursor {
  let step = cursor;
  for (const [term, definition] of GLOSSARY) {
    step = ensureSpace(ctx, step, 30);
    step.page.drawText(term, { x: MARGIN, y: step.y, size: 10, font: ctx.fonts.bold, color: COLORS.ink });
    step = drawText(ctx, { page: step.page, y: step.y - 14 }, definition, { size: 9, color: COLORS.mutedInk, gapAfter: 10 });
  }
  return step;
}
