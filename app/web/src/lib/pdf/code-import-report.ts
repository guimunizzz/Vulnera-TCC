/**
 * lib/pdf/code-import-report.ts
 *
 * Relatório de uma importação SAST/SCA (ADR-052), no mesmo molde do relatório
 * DAST: capa, sumário executivo (KPIs + gráfico), triagem, comparação com a
 * importação anterior, um bloco por achado e apêndice de metodologia.
 * Reaproveita inteiramente `lib/pdf/base.ts`.
 *
 * RECORTE (decisão de 2026-11-13): achados triados como FALSO-POSITIVO não
 * entram na lista detalhada nem no gráfico — só aparecem contados na seção
 * de triagem. O relatório é o que um cliente leria; ruído já descartado por
 * um humano não ajuda, mas esconder que ele existiu também não seria honesto.
 *
 * Todo texto passa por `drawText` → `sanitizeForFont`: mensagens de SARIF e
 * descrições de CVE trazem caractere fora do WinAnsi com frequência.
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
import {
  CODE_FORMAT_LABELS,
  CODE_SEVERITY_LABELS,
  CODE_SEVERITY_ORDER,
  localDoAchado,
  type CodeFinding,
  type CodeImportReportData,
} from "../../types/code-import.types";
import { DAST_TRIAGE_LABELS, type DastTriageStatus } from "../../types/dast.types";

/** Corte dos textos longos de ferramenta (descrições de CVE chegam a vários KB). */
const MAX_TEXTO = 1200;

function cortar(texto: string, max = MAX_TEXTO): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}… (texto completo no Vulnera)` : texto;
}

/**
 * `wrapText` só quebra em espaço: uma URL ou um hash de 120 caracteres passava
 * da margem direita (visto no PDF real do Semgrep). Corta tokens longos em
 * pedaços que cabem na linha.
 */
export function quebrarTokensLongos(texto: string, max = 70): string {
  return texto.replace(new RegExp(`\\S{${max + 1},}`, "g"), (token) => token.match(new RegExp(`.{1,${max}}`, "g"))!.join(" "));
}

/** Severidade do vocabulário do PDF base: INFO cai no cinza de NONE, como na UI. */
function corDaSeveridade(sev: string): RGB {
  return severityColor(sev === "INFO" ? "NONE" : sev);
}

export interface CodeReportSummary {
  visiveis: CodeFinding[];
  falsosPositivos: number;
  porSeveridade: Record<string, number>;
  porTriagem: Record<DastTriageStatus, number>;
  sast: number;
  sca: number;
  promovidos: number;
}

/** Puro e exportado para teste: o que entra no PDF e os contadores. */
export function resumirParaRelatorio(findings: CodeFinding[]): CodeReportSummary {
  const porTriagem: Record<DastTriageStatus, number> = { NEW: 0, CONFIRMED: 0, FALSE_POSITIVE: 0, ACCEPTED_RISK: 0 };
  for (const f of findings) porTriagem[f.triageStatus]++;
  const visiveis = findings.filter((f) => f.triageStatus !== "FALSE_POSITIVE");
  const porSeveridade = Object.fromEntries(CODE_SEVERITY_ORDER.map((s) => [s, visiveis.filter((f) => f.severity === s).length]));
  return {
    visiveis,
    falsosPositivos: porTriagem.FALSE_POSITIVE,
    porSeveridade,
    porTriagem,
    sast: visiveis.filter((f) => f.category === "SAST").length,
    sca: visiveis.filter((f) => f.category === "SCA").length,
    promovidos: visiveis.filter((f) => f.promotedVulnerability).length,
  };
}

export async function generateCodeImportReportPdf(data: CodeImportReportData): Promise<Blob> {
  const imp = data.import;
  const resumo = resumirParaRelatorio(data.findings);
  const ferramenta = `${imp.toolName}${imp.toolVersion ? ` ${imp.toolVersion}` : ""}`;

  const ctx = await createReportContext(imp.projectName);
  drawCoverPage(ctx, {
    reportTypeLabel: "Relatório SAST/SCA",
    projectName: imp.projectName,
    companyName: imp.companyName,
    applicationName: imp.applicationName,
    generatedAt: new Date(data.generatedAt),
    subtitle:
      `${ferramenta} (${CODE_FORMAT_LABELS[imp.format]}) · importação do arquivo ${imp.fileName} por ${imp.uploadedByName} em ` +
      `${new Date(imp.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`,
  });

  let cursor: Cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Sumário executivo");
  const total = resumo.visiveis.length;
  const graves = (resumo.porSeveridade.CRITICAL ?? 0) + (resumo.porSeveridade.HIGH ?? 0);
  cursor = drawText(
    ctx,
    cursor,
    `A análise ${imp.format === "SARIF" ? "de código" : "de dependências"} gerada por ${ferramenta} trouxe ` +
      `${imp.totalFindings} ${imp.totalFindings === 1 ? "achado" : "achados"} para o projeto ${imp.projectName}. ` +
      (resumo.falsosPositivos > 0
        ? `${resumo.falsosPositivos} ${resumo.falsosPositivos === 1 ? "foi descartado" : "foram descartados"} como falso-positivo na triagem e ${resumo.falsosPositivos === 1 ? "fica" : "ficam"} fora da lista detalhada. `
        : "") +
      (resumo.falsosPositivos > 0 ? `Restam ${total}, dos quais ` : "Desses, ") +
      `${graves} ${graves === 1 ? "é" : "são"} de severidade crítica ou alta.`,
    { gapAfter: 16 },
  );

  cursor = drawKpiRow(ctx, cursor, [
    { label: "Achados no relatório", value: String(total) },
    { label: "Críticos + altos", value: String(graves), color: corDaSeveridade("CRITICAL") },
    { label: "Novos desde a anterior", value: imp.previousImportId ? String(imp.newFindings) : "—" },
    { label: "Resolvidos", value: imp.previousImportId ? String(imp.resolvedFindings) : "—", color: COLORS.accent },
  ]);
  cursor = { ...cursor, y: cursor.y - 10 };

  cursor = drawSectionTitle(ctx, cursor, "Distribuição por severidade");
  cursor = drawBarChart(
    ctx,
    cursor,
    CODE_SEVERITY_ORDER.map((sev) => ({ label: CODE_SEVERITY_LABELS[sev], value: resumo.porSeveridade[sev] ?? 0, color: corDaSeveridade(sev) })),
  );
  cursor = { ...cursor, y: cursor.y - 10 };

  cursor = drawSectionTitle(ctx, cursor, "Triagem e origem");
  cursor = drawText(
    ctx,
    cursor,
    (Object.keys(resumo.porTriagem) as DastTriageStatus[]).map((s) => `${DAST_TRIAGE_LABELS[s]}: ${resumo.porTriagem[s]}`).join(" · "),
    { size: 10, gapAfter: 6 },
  );
  cursor = drawText(
    ctx,
    cursor,
    `Código-fonte (SAST): ${resumo.sast} · Dependências (SCA): ${resumo.sca} · Já promovidos a vulnerabilidade: ${resumo.promovidos}` +
      (imp.componentsCount != null ? ` · Componentes no SBOM: ${imp.componentsCount}` : ""),
    { size: 10, gapAfter: 12 },
  );
  if (imp.warningMessage) {
    cursor = drawText(ctx, cursor, `Avisos da importação: ${imp.warningMessage}`, { size: 9, color: COLORS.mutedInk, gapAfter: 12 });
  }
  cursor = drawDivider(ctx, cursor);

  cursor = drawSectionTitle(ctx, cursor, "Comparação com a importação anterior");
  if (!imp.previousImportId) {
    cursor = drawText(ctx, cursor, "Primeira importação desta ferramenta neste projeto: não há base de comparação.", { color: COLORS.mutedInk, gapAfter: 12 });
  } else {
    cursor = drawText(
      ctx,
      cursor,
      `Novos: ${imp.newFindings} · Continuam: ${imp.persistedFindings} · Resolvidos (sumiram do relatório): ${imp.resolvedFindings}. ` +
        "Um achado resolvido não está necessariamente corrigido: pode ter saído do escopo da análise. Os que já eram vulnerabilidades devem ser retestados antes de serem fechados.",
      { size: 10, gapAfter: 10 },
    );
    for (const r of data.resolved.slice(0, 40)) {
      cursor = drawText(
        ctx,
        cursor,
        quebrarTokensLongos(`• [${CODE_SEVERITY_LABELS[r.severity]}] ${r.title}${r.location ? ` — ${r.location}` : ""}${r.promotedVulnerability ? " (vulnerabilidade registrada: retestar)" : ""}`),
        { size: 9, gapAfter: 2 },
      );
    }
    if (data.resolved.length > 40) {
      cursor = drawText(ctx, cursor, `… e mais ${data.resolved.length - 40} resolvidos (lista completa no Vulnera).`, { size: 9, color: COLORS.mutedInk });
    }
    cursor = { ...cursor, y: cursor.y - 8 };
  }
  cursor = drawDivider(ctx, cursor);

  cursor = drawSectionTitle(ctx, cursor, "Achados por severidade");
  if (resumo.visiveis.length === 0) {
    cursor = drawText(ctx, cursor, "Nenhum achado a relatar.", { color: COLORS.mutedInk });
  }
  for (const [idx, finding] of resumo.visiveis.entries()) {
    if (idx > 0) cursor = drawDivider(ctx, cursor, 16);
    cursor = drawFindingSection(ctx, cursor, finding, idx + 1);
  }

  cursor = addPage(ctx);
  cursor = drawSectionTitle(ctx, cursor, "Apêndice");
  drawAppendix(ctx, cursor, data);

  drawFooters(ctx);
  return toBlob(ctx.doc);
}

interface KpiItem {
  label: string;
  value: string;
  color?: RGB;
}

/** Mesmo desenho do relatório DAST. */
function drawKpiRow(ctx: ReportContext, cursor: Cursor, items: KpiItem[]): Cursor {
  const { page, y } = ensureSpace(ctx, cursor, 60);
  const cardWidth = (CONTENT_WIDTH - (items.length - 1) * 12) / items.length;
  items.forEach((item, idx) => {
    const x = MARGIN + idx * (cardWidth + 12);
    page.drawRectangle({ x, y: y - 50, width: cardWidth, height: 50, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.75 });
    page.drawText(item.value, { x: x + 10, y: y - 26, size: 18, font: ctx.fonts.bold, color: item.color ?? COLORS.ink });
    page.drawText(item.label, { x: x + 10, y: y - 42, size: 8, font: ctx.fonts.regular, color: COLORS.mutedInk });
  });
  return { page, y: y - 62 };
}

function drawLabeledBlock(ctx: ReportContext, cursor: Cursor, label: string, content: string): Cursor {
  const step = ensureSpace(ctx, cursor, 30);
  step.page.drawText(label.toUpperCase(), { x: MARGIN, y: step.y, size: 8, font: ctx.fonts.bold, color: COLORS.accent });
  return drawText(ctx, { page: step.page, y: step.y - 13 }, quebrarTokensLongos(content), { size: 9.5, gapAfter: 10 });
}

function drawFindingSection(ctx: ReportContext, cursor: Cursor, f: CodeFinding, index: number): Cursor {
  let step = ensureSpace(ctx, cursor, 90);
  // Chip numa linha e título na seguinte: `drawText` sempre começa na margem,
  // e títulos de SARIF são longos (quebram em várias linhas).
  drawChip(step.page, ctx.fonts, CODE_SEVERITY_LABELS[f.severity], MARGIN, step.y - 14, corDaSeveridade(f.severity));
  step = drawText(ctx, { page: step.page, y: step.y - 34 }, quebrarTokensLongos(`${index}. ${f.title}`, 50), { font: ctx.fonts.bold, size: 12, gapAfter: 8 });

  const meta = [
    f.category === "SAST" ? "Código-fonte (SAST)" : "Dependência (SCA)",
    `Regra ${f.ruleId}`,
    f.cweId ? `CWE-${f.cweId}` : null,
    f.cvssScore != null ? `Score da ferramenta ${f.cvssScore.toFixed(1)}` : null,
    `Triagem: ${DAST_TRIAGE_LABELS[f.triageStatus]}`,
    f.promotedVulnerability ? `Vulnerabilidade registrada (${f.promotedVulnerability.status})` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  step = drawText(ctx, step, quebrarTokensLongos(meta), { size: 9, color: COLORS.mutedInk, gapAfter: 10 });

  step = drawLabeledBlock(ctx, step, f.category === "SAST" ? "Local" : "Componente", localDoAchado(f));
  if (f.fixedVersion) step = drawLabeledBlock(ctx, step, "Versão corrigida", f.fixedVersion);
  if (f.description) step = drawLabeledBlock(ctx, step, "Descrição", cortar(f.description));
  if (f.recommendation) step = drawLabeledBlock(ctx, step, "Recomendação", cortar(f.recommendation, 800));
  if (f.snippet) step = drawLabeledBlock(ctx, step, "Trecho", cortar(f.snippet, 600));
  if (f.triageNote) step = drawLabeledBlock(ctx, step, "Nota da triagem", f.triageNote);
  if (f.helpUri) step = drawLabeledBlock(ctx, step, "Referência", f.helpUri);
  return step;
}

function drawAppendix(ctx: ReportContext, cursor: Cursor, data: CodeImportReportData): Cursor {
  let step = drawLabeledBlock(
    ctx,
    cursor,
    "Metodologia",
    "O Vulnera não executa as ferramentas de análise: ele importa o relatório que a pipeline do cliente já gera, " +
      "em SARIF 2.1.0 (Semgrep, CodeQL, SonarQube, Trivy e outras) ou CycloneDX com a seção de vulnerabilidades (SBOM). " +
      "Cada achado recebe uma impressão digital estável (regra + arquivo + fingerprint da ferramenta, ou pacote + versão + CVE) " +
      "que permite reconhecê-lo nas importações seguintes, herdar a triagem já feita e calcular o que é novo e o que foi resolvido.",
  );
  step = drawLabeledBlock(
    ctx,
    step,
    "Triagem e promoção",
    "Cada achado é triado por um pentester (confirmado, falso-positivo ou risco aceito). Para virar vulnerabilidade do projeto, " +
      "o achado é promovido com um vetor CVSS 3.1 revisado por humano: o score da ferramenta é apenas informação, e o score oficial " +
      "é calculado do vetor confirmado. A vulnerabilidade promovida entra no fluxo de SLA, priorização (VRS) e remediação do Vulnera.",
  );
  step = drawLabeledBlock(
    ctx,
    step,
    "Limitações",
    "A qualidade do resultado é a da ferramenta de origem: o Vulnera não reexecuta regras nem confirma exploração. " +
      "Achados de dependência indicam uma versão vulnerável presente, não que o trecho vulnerável seja alcançável. " +
      `Este relatório reflete a importação ${data.import.id} e a triagem no momento da geração.`,
  );
  return step;
}
