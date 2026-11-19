/** Cálculos e HTML seguro do PDF executivo, consumidos pela visualização e impressão mobile. */
import type { ReportData } from "../types/report.types";

export const isReportReady = (status: string) => status === "IN_REVIEW" || status === "COMPLETED";
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function reportMetrics(data: ReportData) {
  const remediated = data.stats.byStatus.FIXED + data.stats.byStatus.CLOSED;
  const criticalOpen = data.vulnerabilities.filter((item) => item.severityFinal === "CRITICAL" && (item.status === "OPEN" || item.status === "IN_PROGRESS")).length;
  return { total: data.stats.total, criticalOpen, remediatedPercent: data.stats.total ? Math.round(remediated / data.stats.total * 100) : 0 };
}
export function executiveReportHtml(data: ReportData): string {
  const metric = reportMetrics(data);
  const text = (value: unknown) => escapeHtml(value === null || value === undefined || value === "" ? "Não informado" : value);
  const risks = data.topRisks.map((risk) => `<li><strong>${text(risk.title)}</strong> · ${text(risk.severityFinal)} · CVSS ${text(risk.cvssScore ?? "—")} · ${text(risk.owaspCategory)}<br>Recomendação: ${text(risk.recommendation)}</li>`).join("");
  const accepted = data.acceptedRisks.map((risk) => `<li><strong>${text(risk.title)}</strong> · ${text(risk.severityFinal)}<br>Motivo: ${text(risk.reason)}<br>Justificativa: ${text(risk.businessJustification)}<br>Controles: ${text(risk.compensatingControls)}<br>Validade: ${text(risk.expiresAt)} · Aprovado por: ${text(risk.approvedByName)}</li>`).join("");
  const maturity = data.maturity ? `<p>Nível: ${text(data.maturity.level)} · Pontuação: ${text(data.maturity.overallScore)}</p><ul>${data.maturity.domains.map((domain) => `<li>${text(domain.domainName)}: ${text(domain.average)}</li>`).join("")}</ul>` : "<p>Avaliação de maturidade ainda não disponível.</p>";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#20212a;font-size:12px;line-height:1.5}h1,h2{color:#512594}h2{margin-top:24px}li{margin:8px 0}.kpi{padding:12px;background:#f4f1fb;border-radius:8px}.muted{color:#586071}@page{margin:36px}</style></head><body><h1>Relatório executivo</h1><p>${text(data.project.name)} · ${text(data.application.name)} · ${text(data.company.name)}</p><p class="muted">Solicitado: ${text(data.project.requestedAt)} · Encerrado: ${text(data.project.closedAt)}</p><h2>Sumário executivo</h2><p>Panorama dos achados registrados no projeto e do acompanhamento de remediação.</p><p class="kpi">Total de achados: ${metric.total} · Críticos em aberto: ${metric.criticalOpen} · Remediados: ${metric.remediatedPercent}%</p><h2>Distribuição por severidade</h2><p>${Object.entries(data.stats.bySeverity).map(([key, value]) => `${text(key)}: ${text(value)}`).join(" · ")}</p><h2>Principais riscos</h2><ul>${risks || "<li>Nenhum risco registrado.</li>"}</ul><h2>Riscos aceitos</h2><ul>${accepted || "<li>Nenhum aceite vigente.</li>"}</ul><h2>Maturidade de segurança</h2>${maturity}<h2>Conclusão</h2><p>Priorize os achados em aberto conforme a severidade e acompanhe as ações de remediação no Vulnera.</p></body></html>`;
}
