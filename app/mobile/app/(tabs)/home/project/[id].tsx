/**
 * Detalhe read-only de projeto: contexto, status, datas e vulnerabilidades reais.
 * Facetas do servidor incluem todas as páginas; a lista carrega sob demanda.
 * Consumidor: navegação de projetos do cliente; sem alteração de dados ou tenancy.
 */
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../../../src/api/projects.api";
import { vulnerabilitiesApi } from "../../../../src/api/vulnerabilities.api";
import { useApiError } from "../../../../src/hooks/use-api-error";
import { useTabBarClearance } from "../../../../src/hooks/use-tab-bar-clearance";
import { FindingRow } from "../../../../src/components/finding-row";
import { StatusBadge } from "../../../../src/components/badge";
import { ActionButton, DataState, DetailField, GlassSurface, PageHeader, SectionHeading, WorkspaceScreen } from "../../../../src/components/workspace-ui";
import { COLORS, FONT_FAMILY } from "../../../../src/theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../../../../src/theme/workspace";
import { displayDate } from "../../../../src/lib/display";
import { MotionReveal, useWorkspaceScroll } from "../../../../src/components/workspace-motion";

const LEVELS: Record<string, string> = { BASIC: "Básico", INTERMEDIATE: "Intermediário", ADVANCED: "Avançado" };
const STAGES = [{ status: "PENDING", label: "Solicitado" }, { status: "IN_PROGRESS", label: "Em análise" }, { status: "IN_REVIEW", label: "Revisão" }, { status: "COMPLETED", label: "Concluído" }];
const SEVERITIES = [{ key: "CRITICAL", label: "Críticas", color: "#fda4af" }, { key: "HIGH", label: "Altas", color: "#fdba74" }, { key: "MEDIUM", label: "Médias", color: "#fde68a" }, { key: "LOW", label: "Baixas", color: "#7dd3fc" }, { key: "NONE", label: "Info", color: WORKSPACE.muted }];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const bottom = useTabBarClearance();
  const errorMessage = useApiError();
  const scroll = useWorkspaceScroll();
  const projectQuery = useQuery({ queryKey: ["projects", id], queryFn: ({ signal }) => projectsApi.getById(id!, signal), enabled: !!id });
  const findingsQuery = useInfiniteQuery({
    queryKey: ["vulnerabilities", "byProject", id, "paged"], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => vulnerabilitiesApi.listByProject(id!, pageParam, signal),
    getNextPageParam: (last) => last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
    enabled: !!id && !!projectQuery.data,
  });
  const findings = findingsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const firstPage = findingsQuery.data?.pages[0];
  const refresh = () => { void projectQuery.refetch(); void findingsQuery.refetch(); };
  if (!projectQuery.data) return <WorkspaceScreen><PageHeader label="PROJETO" back />
    {projectQuery.isPending ? <DataState loading title="Abrindo projeto" /> : <DataState error title="Projeto indisponível" message={errorMessage(projectQuery.error)} onRetry={() => { void projectQuery.refetch(); }} />}
  </WorkspaceScreen>;
  const project = projectQuery.data;
  const stage = STAGES.findIndex((item) => item.status === project.status);
  const header = <MotionReveal style={styles.header}>
    <PageHeader label="VISÃO DO PROJETO" back />
    <View style={{ gap: 12 }}><View style={ui.spread}><Text style={ui.eyebrow}>ANÁLISE / {project.analysisType}</Text><StatusBadge status={project.status} /></View>
      <Text accessibilityRole="header" style={ui.title}>{project.name}</Text><Text style={ui.muted}>Acompanhe cada etapa da sua análise de segurança.</Text></View>
    {projectQuery.isError && <DataState error title="Não foi possível atualizar o projeto" message={errorMessage(projectQuery.error)} onRetry={() => { void projectQuery.refetch(); }} />}
    <GlassSurface>
      <Text style={ui.eyebrow}>JORNADA DA ANÁLISE</Text>
      <View style={styles.timeline}>{STAGES.map((item, index) => <View key={item.status} style={styles.stage}>
        <View style={styles.stageLine}>{index > 0 && <View style={[styles.connector, index <= stage && styles.connectorDone]} />}
          <View style={[styles.stageDot, index <= stage && styles.stageDone, index === stage && styles.stageCurrent, index === stage && project.status === "COMPLETED" && styles.stageCompleted]}><Text style={[styles.stageNumber, index <= stage && { color: WORKSPACE.text }]}>{index + 1}</Text></View>
          {index < STAGES.length - 1 && <View style={[styles.connector, { left: "50%", right: 0 }, index < stage && styles.connectorDone]} />}</View>
        <Text style={[styles.stageLabel, index === stage && { color: project.status === "COMPLETED" ? COLORS.successInk : COLORS.severity.lowInk }]}>{item.label}</Text>
      </View>)}</View>
      <View style={ui.divider} /><View style={ui.spread}><Text style={ui.muted}>Solicitado em</Text><Text style={ui.muted}>{displayDate(project.requestedAt)}</Text></View>
    </GlassSurface>
    <GlassSurface>
      <Text style={ui.eyebrow}>SOBRE A ANÁLISE</Text>
      <View style={styles.detailsRow}><View style={ui.grow}><DetailField label="NÍVEL" value={LEVELS[project.analysisLevel] ?? project.analysisLevel} /></View><View style={ui.grow}><DetailField label="REMEDIAÇÃO" value={project.hasRemediation ? "Incluída" : "Não incluída"} /></View></View>
      {!!project.description && <DetailField label="DESCRIÇÃO" value={project.description} />}
      {!!project.scopeIn && <DetailField label="DENTRO DO ESCOPO" value={project.scopeIn} />}
      {!!project.scopeOut && <DetailField label="FORA DO ESCOPO" value={project.scopeOut} />}
      {project.startedAt && <DetailField label="INÍCIO DA ANÁLISE" value={displayDate(project.startedAt)} />}
      {project.closedAt && <DetailField label="ENCERRAMENTO" value={displayDate(project.closedAt)} />}
    </GlassSurface>
    <View style={{ gap: 16 }}><SectionHeading title="Vulnerabilidades" meta={firstPage ? `${firstPage.pagination.total} no total` : undefined} />
      <GlassSurface style={styles.severities}>{SEVERITIES.map((item) => <View key={item.key} style={styles.severity}>
        <View style={[styles.severityDot, { backgroundColor: item.color }]} /><Text style={[styles.severityCount, { color: item.color }]}>{firstPage ? firstPage.facets.severity[item.key] ?? 0 : "—"}</Text><Text style={styles.severityLabel}>{item.label}</Text>
      </View>)}</GlassSurface>
    </View>
  </MotionReveal>;
  return <WorkspaceScreen scroll={false} scrollY={scroll.scrollY}><Animated.FlatList onScroll={scroll.onScroll} scrollEventThrottle={16} data={findings} keyExtractor={(finding) => finding.id}
    showsVerticalScrollIndicator={false} contentContainerStyle={[styles.list, { paddingBottom: bottom + 16 }]}
    ListHeaderComponent={header} refreshing={projectQuery.isRefetching || findingsQuery.isRefetching} onRefresh={refresh}
    renderItem={({ item, index }) => <MotionReveal delay={Math.min(index, 3) * 40}><FindingRow finding={item} onPress={() => router.push(`/(tabs)/home/finding/${item.id}`)} /></MotionReveal>}
    ListEmptyComponent={findingsQuery.isPending ? <DataState loading title="Buscando vulnerabilidades" /> : findingsQuery.isError ? <DataState error title="Vulnerabilidades indisponíveis" message={errorMessage(findingsQuery.error)} onRetry={() => { void findingsQuery.refetch(); }} /> : <DataState title="Nenhuma vulnerabilidade registrada" message="Os achados da análise aparecerão aqui quando forem disponibilizados." />}
    ListFooterComponent={findings.length ? <View style={styles.footer}>
      {findingsQuery.isError && <DataState error title={findingsQuery.isFetchNextPageError ? "Não foi possível carregar mais" : "Não foi possível atualizar"} message={errorMessage(findingsQuery.error)} onRetry={() => { if (findingsQuery.isFetchNextPageError) void findingsQuery.fetchNextPage(); else void findingsQuery.refetch(); }} />}
      {findingsQuery.hasNextPage && !findingsQuery.isFetchNextPageError && <ActionButton icon="add-outline" label={findingsQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais vulnerabilidades"} disabled={findingsQuery.isFetching} onPress={() => { void findingsQuery.fetchNextPage(); }} />}
      <Text style={[ui.muted, { textAlign: "center" }]}>Mostrando {findings.length} de {firstPage?.pagination.total ?? findings.length}</Text>
    </View> : null}
  /></WorkspaceScreen>;
}
const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12 }, header: { gap: 20, marginBottom: 8 }, footer: { gap: 16, paddingTop: 12 }, detailsRow: { flexDirection: "row", gap: 16 },
  timeline: { flexDirection: "row", marginHorizontal: -8 }, stage: { flex: 1, alignItems: "center", gap: 9 }, stageLine: { flexDirection: "row", width: "100%", alignItems: "center", justifyContent: "center" },
  connector: { position: "absolute", left: 0, right: "50%", height: 1, backgroundColor: WORKSPACE.line }, connectorDone: { backgroundColor: "rgba(255,255,255,0.28)" },
  stageDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: WORKSPACE.inset, borderWidth: 1, borderColor: WORKSPACE.line, alignItems: "center", justifyContent: "center", zIndex: 1 },
  stageDone: { backgroundColor: "#34383e", borderColor: "rgba(255,255,255,0.2)" }, stageCurrent: { backgroundColor: COLORS.severity.lowSurface, borderColor: COLORS.severity.lowInk },
  stageCompleted: { backgroundColor: COLORS.successSurface, borderColor: COLORS.successInk },
  stageNumber: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: WORKSPACE.muted }, stageLabel: { fontSize: 12, color: WORKSPACE.muted, fontFamily: FONT_FAMILY.medium, textAlign: "center" },
  severities: { flexDirection: "row", padding: 12, gap: 4 }, severity: { flex: 1, alignItems: "center", gap: 6 }, severityDot: { width: 4, height: 4, borderRadius: 2 },
  severityCount: { fontFamily: FONT_FAMILY.medium, fontSize: 24 }, severityLabel: { fontFamily: FONT_FAMILY.regular, fontSize: 12, color: WORKSPACE.muted },
});
