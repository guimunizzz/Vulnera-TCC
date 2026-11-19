/** Confere a regra de disponibilidade e a segurança do HTML gerado com dados fictícios. */
import test from "node:test";
import assert from "node:assert/strict";
import { executiveReportHtml, isReportReady, reportMetrics } from "../src/lib/executive-report.ts";

test("relatórios só são liberados na revisão ou conclusão", () => {
  assert.equal(isReportReady("PENDING"), false);
  assert.equal(isReportReady("IN_PROGRESS"), false);
  assert.equal(isReportReady("IN_REVIEW"), true);
  assert.equal(isReportReady("COMPLETED"), true);
});

test("calcula métricas e escapa conteúdo inserido no PDF", () => {
  const data = { project: { name: '<script>alert(1)</script>', requestedAt: '2026-01-01', closedAt: null }, company: { name: 'Empresa & Cia' }, application: { name: 'App' }, vulnerabilities: [{ severityFinal: 'CRITICAL', status: 'OPEN' }, { severityFinal: 'CRITICAL', status: 'CLOSED' }], stats: { total: 2, byStatus: { FIXED: 0, CLOSED: 1 }, bySeverity: { CRITICAL: 2 } }, topRisks: [{ title: '<img src=x>', severityFinal: 'CRITICAL', cvssScore: 0, owaspCategory: 'A01', recommendation: 'Corrigir' }], acceptedRisks: [], maturity: null };
  assert.deepEqual(reportMetrics(data), { total: 2, criticalOpen: 1, remediatedPercent: 50 });
  const html = executiveReportHtml(data);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(html.includes('CVSS 0'));
  assert.ok(!html.includes('<script>'));
});
