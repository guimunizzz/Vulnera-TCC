/** Detalha o relatório executivo da API e gera o PDF no dispositivo após a regra RN18. */
import { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { projectsApi } from "../../../src/api/projects.api";
import { reportsApi } from "../../../src/api/reports.api";
import { SeverityBadge } from "../../../src/components/badge";
import { ActionButton, DataState, GlassSurface, PageHeader, SectionHeading, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { useApiError } from "../../../src/hooks/use-api-error";
import { displayDate } from "../../../src/lib/display";
import { executiveReportHtml, isReportReady, reportMetrics } from "../../../src/lib/executive-report";
import { useAppTheme } from "../../../src/theme/use-app-theme";
import { OWASP_LABELS } from "../../../src/types/vulnerability.types";
import type { ReportData } from "../../../src/types/report.types";

const severityLabels: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa", NONE: "Informativa" };

export default function ReportDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { ui, workspace, colors } = useAppTheme();
  const router = useRouter();
  const cache = useQueryClient();
  const errorMessage = useApiError();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);
  const project = useQuery({ queryKey: ["projects", projectId], queryFn: ({ signal }) => projectsApi.getById(projectId!, signal), enabled: !!projectId });
  const ready = !!project.data && isReportReady(project.data.status);
  const report = useQuery({ queryKey: ["report-data", projectId], queryFn: ({ signal }) => reportsApi.data(projectId!, signal), enabled: !!projectId && ready });
  const history = useQuery({ queryKey: ["reports", projectId], queryFn: ({ signal }) => reportsApi.history(projectId!, signal), enabled: !!projectId && ready });
  const executiveHistory = history.data?.filter((entry) => entry.type === "EXECUTIVE") ?? [];

  async function exportPdf() {
    if (lock.current || !report.data || !projectId) return;
    lock.current = true; setExporting(true); setMessage(null);
    try {
      if (!(await Sharing.isAvailableAsync())) { setMessage("Compartilhamento indisponível neste dispositivo."); return; }
      const file = await Print.printToFileAsync({ html: executiveReportHtml(report.data) });
      try { await reportsApi.register(projectId); } catch { setMessage("O PDF foi criado, mas não foi possível registrar a geração. Tente novamente."); return; }
      void cache.invalidateQueries({ queryKey: ["reports", projectId] });
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Compartilhar relatório executivo", UTI: "com.adobe.pdf" });
      setMessage("PDF gerado e registro atualizado.");
    } catch { setMessage("Não foi possível gerar ou abrir o compartilhamento do PDF. Tente novamente."); }
    finally { lock.current = false; setExporting(false); }
  }

  return <WorkspaceScreen>
    <PageHeader label="RELATÓRIO EXECUTIVO" back backFallback="/(tabs)/reports" />
    {project.isPending ? <DataState loading title="Carregando projeto" /> : project.isError || !project.data ? <DataState error title="Projeto indisponível" message={errorMessage(project.error)} onRetry={() => { void project.refetch(); }} /> : !ready ? <DataState title="Relatório ainda indisponível" message="O relatório executivo fica disponível quando o projeto estiver em revisão ou concluído." /> : <>
      {report.isPending ? <DataState loading title="Carregando relatório" /> : report.isError || !report.data ? <DataState error title="Relatório indisponível" message={errorMessage(report.error)} onRetry={() => { void report.refetch(); }} /> : <>
        <View style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.title}>{report.data.project.name}</Text><Text style={ui.body}>{report.data.application.name} · {report.data.company.name}</Text><Text style={ui.muted}>Solicitado em {displayDate(report.data.project.requestedAt)}{report.data.project.closedAt ? ` · Concluído em ${displayDate(report.data.project.closedAt)}` : ""}</Text></View>
        <GlassSurface><Text style={ui.heading}>Sumário executivo</Text><Text style={ui.body}>Visão consolidada dos achados e do acompanhamento de remediação.</Text><ReportMetrics data={report.data} /></GlassSurface>
        <GlassSurface><Text style={ui.heading}>Distribuição por severidade</Text>{Object.entries(report.data.stats.bySeverity).map(([severity, count]) => <View key={severity} style={{ gap: 6 }}><View style={ui.spread}><Text style={ui.body}>{severityLabels[severity] ?? severity}</Text><Text style={ui.mono}>{count}</Text></View><View style={{ height: 6, borderRadius: 3, backgroundColor: workspace.inset }}><View style={{ width: `${report.data!.stats.total ? count / report.data!.stats.total * 100 : 0}%`, height: 6, borderRadius: 3, backgroundColor: severity === "CRITICAL" ? colors.severity.critical : severity === "HIGH" ? colors.severity.high : severity === "MEDIUM" ? colors.severity.medium : severity === "LOW" ? colors.severity.low : colors.severity.info }} /></View></View>)}</GlassSurface>
        <SectionHeading title="Principais riscos" />
        {!report.data.topRisks.length ? <DataState title="Nenhum risco registrado" /> : report.data.topRisks.map((risk) => <GlassSurface key={risk.id} onPress={() => router.push(`/(tabs)/home/finding/${risk.id}`)} accessibilityLabel={`Abrir vulnerabilidade ${risk.title}`}><View style={ui.spread}><Text style={[ui.heading, ui.grow]}>{risk.title}</Text><SeverityBadge severidade={risk.severityFinal} cvss={risk.cvssScore} /></View><Text style={ui.muted}>{OWASP_LABELS[risk.owaspCategory] ?? risk.owaspCategory}</Text><Text style={ui.body}>Recomendação: {risk.recommendation || "Não informada"}</Text></GlassSurface>)}
        {!!report.data.acceptedRisks.length && <><SectionHeading title="Riscos aceitos" />{report.data.acceptedRisks.map((risk) => <GlassSurface key={risk.vulnerabilityId}><Text style={ui.heading}>{risk.title}</Text><Text style={ui.body}>{risk.reason}</Text><Text style={ui.muted}>Justificativa: {risk.businessJustification}</Text><Text style={ui.muted}>Validade: {displayDate(risk.expiresAt)} · Aprovação: {risk.approvedByName || "Não informada"}</Text></GlassSurface>)}</>}
        <GlassSurface><Text style={ui.heading}>Maturidade de segurança</Text>{report.data.maturity ? <><Text style={ui.body}>Nível {report.data.maturity.level} · {report.data.maturity.overallScore}</Text>{report.data.maturity.domains.map((domain) => <Text key={domain.domainId} style={ui.muted}>{domain.domainName}: {domain.average}</Text>)}</> : <Text style={ui.body}>Avaliação de maturidade ainda não disponível.</Text>}</GlassSurface>
        <GlassSurface><Text style={ui.heading}>Conclusão</Text><Text style={ui.body}>Priorize os achados em aberto conforme a severidade e acompanhe as ações de remediação.</Text></GlassSurface>
        {Platform.OS === "web" ? <Text style={ui.muted}>A geração e o compartilhamento do PDF estão disponíveis no aplicativo móvel.</Text> : <ActionButton icon="share-outline" label={exporting ? "Gerando PDF..." : "Exportar e compartilhar PDF"} disabled={exporting} onPress={() => { void exportPdf(); }} />}
        {message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
      </>}
      <SectionHeading title="Histórico" />
      {history.isPending ? <DataState loading title="Carregando histórico" /> : history.isError ? <DataState error title="Histórico indisponível" message={errorMessage(history.error)} onRetry={() => { void history.refetch(); }} /> : !executiveHistory.length ? <DataState title="Nenhum relatório gerado" /> : executiveHistory.map((entry) => <GlassSurface key={entry.id}><Text style={ui.body}>{entry.title}</Text><Text style={ui.muted}>{displayDate(entry.createdAt, true)}</Text></GlassSurface>)}
    </>}
  </WorkspaceScreen>;
}

function ReportMetrics({ data }: { data: ReportData }) {
  const { ui } = useAppTheme();
  const metrics = reportMetrics(data);
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}><View style={ui.grow}><Text style={ui.heading}>{metrics.total}</Text><Text style={ui.muted}>achados</Text></View><View style={ui.grow}><Text style={ui.heading}>{metrics.criticalOpen}</Text><Text style={ui.muted}>críticos em aberto</Text></View><View style={ui.grow}><Text style={ui.heading}>{metrics.remediatedPercent}%</Text><Text style={ui.muted}>remediados</Text></View></View>;
}
