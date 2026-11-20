/**
 * Rede de exposição do cliente, usando a mesma projeção da Web.
 * Liga empresa, aplicações e categorias compartilhadas sem sugerir caminhos de ataque.
 * A Home abre esta tela; a lista textual oferece acesso aos mesmos nós do desenho.
 */
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { exposureGraphApi } from "../../../src/api/exposure-graph.api";
import { DataState, FilterChip, Surface, PageHeader, SectionHeading, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { SoftPressable, useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";
import { useApiError } from "../../../src/hooks/use-api-error";
import { graphLayout, sharedCategories, type GraphLayout } from "../../../src/lib/exposure-graph";
import { FONT_FAMILY } from "../../../src/theme/tokens";
import { useAppTheme } from "../../../src/theme/use-app-theme";
import { OWASP_LABELS } from "../../../src/types/vulnerability.types";
import type { ExposureApplication, GraphSeverity } from "../../../src/types/exposure-graph.types";

type Selection = { kind: "company" } | { kind: "app"; id: string } | { kind: "category"; id: string };
const severities: GraphSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const labels: Record<GraphSeverity, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };
const environment: Record<string, string> = { PROD: "Produção", HOMOL: "Homologação", DEV: "Desenvolvimento" };
const criticality: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };
const sensitivity: Record<string, string> = { PUBLIC: "Pública", INTERNAL: "Interna", CONFIDENTIAL: "Confidencial", RESTRICTED: "Restrita" };
const sourceLabels: Record<string, string> = { MANUAL: "Manual", DAST_IMPORT: "DAST", SAST_IMPORT: "SAST", SCA_IMPORT: "SCA" };
const categoryLabel = (code: string) => OWASP_LABELS[code] ?? code;

export default function ExposureScreen({ root = false, navigation }: { root?: boolean; navigation?: ReactNode }) {
  const { workspace, ui } = useAppTheme();
  const router = useRouter();
  const errorMessage = useApiError();
  const [internetOnly, setInternetOnly] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "company" });
  const query = useQuery({ queryKey: ["exposure-graph"], queryFn: ({ signal }) => exposureGraphApi.get(signal) });
  const applications = useMemo(() => (query.data?.aplicacoes ?? []).filter((app) => !internetOnly || app.internetFacing), [query.data, internetOnly]);
  const categories = useMemo(() => sharedCategories(applications), [applications]);
  const app = selection.kind === "app" ? applications.find((item) => item.id === selection.id) : undefined;
  const category = selection.kind === "category" ? categories.find((item) => item.code === selection.id) : undefined;
  const noCompany = axios.isAxiosError(query.error) && (query.error.response?.data?.error === "COMPANY_NOT_FOUND" || query.error.response?.data?.code === "COMPANY_NOT_FOUND");
  const total = applications.reduce((sum, item) => sum + item.totalAbertas, 0);
  const selectApp = (id: string) => setSelection({ kind: "app", id });
  const selectCategory = (id: string) => setSelection({ kind: "category", id });
  return <WorkspaceScreen refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    <PageHeader label={root ? undefined : "EXPOSIÇÃO"} back={!root} account={root} assistantContext="exposure-graph" />
    {navigation}
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.title}>Grafo de exposição</Text><Text style={ui.body}>Conexões entre sua empresa, aplicações e categorias OWASP com vulnerabilidades abertas.</Text></View>
    {query.isPending && <DataState loading title="Carregando exposição" />}
    {query.isError && !query.data && (noCompany ? <DataState title="Conta sem empresa" message="Vincule sua conta a uma empresa para consultar a exposição." /> : <DataState error title="Exposição indisponível" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />)}
    {query.data && <>
      {query.isError && <DataState error title="Não foi possível atualizar" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />}
      {!query.data.aplicacoes.length ? <DataState title="Nenhuma aplicação ativa" message="As aplicações da sua empresa aparecerão aqui quando estiverem disponíveis." /> : <>
        <FilterChip label="Só expostas à Internet" selected={internetOnly} onPress={() => { setInternetOnly(!internetOnly); setSelection({ kind: "company" }); }} />
        {!applications.length ? <DataState title="Nenhuma aplicação exposta" message="Desative o filtro para ver todas as aplicações." /> : <>
          <Surface style={{ gap: 12, padding: 16 }}>
            <View style={ui.spread}><Text style={ui.heading}>Rede de exposição</Text><Text style={ui.mono}>{1 + applications.length + categories.length} nós</Text></View>
            <Text style={ui.muted}>Deslize para explorar. Toque em um nó para ver seus detalhes.</Text>
            <Network applications={applications} categories={categories} selection={selection} onSelect={setSelection} />
            <Text style={ui.muted}>Empresa → aplicações → categorias OWASP abertas</Text>
          </Surface>
          <Surface accessibilityLabel={undefined}>
            {app ? <>
              <View style={ui.spread}><View style={ui.grow}><Text style={ui.eyebrow}>APLICAÇÃO</Text><Text accessibilityRole="header" style={ui.heading}>{app.name}</Text></View><Text style={[ui.muted, { color: workspace.lavender }]}>{app.totalAbertas} abertas</Text></View>
              <Text style={ui.body}>{environment[app.environment] ?? app.environment} · Criticidade {criticality[app.criticality] ?? app.criticality} · Dados {sensitivity[app.dataSensitivity] ?? app.dataSensitivity}</Text>
              {app.url && <Text selectable style={ui.muted}>{app.url}</Text>}
              <Text style={ui.muted}>{app.internetFacing ? "Exposta à Internet" : "Não exposta à Internet"} · {app.totalResolvidas} resolvidas</Text>
              <SeverityCounts counts={app.abertas} />
              <Text style={ui.eyebrow}>ABERTAS POR ORIGEM</Text><Text style={ui.body}>{Object.entries(app.abertasPorOrigem ?? {}).map(([source, count]) => `${sourceLabels[source] ?? source}: ${count}`).join(" · ") || "Nenhuma"}</Text>
              {!!app.categorias.length && <><Text style={ui.eyebrow}>CATEGORIAS OWASP</Text>{app.categorias.map((item) => <DetailLink key={item.owaspCategory} label={categoryLabel(item.owaspCategory)} meta={`${item.abertas} abertas`} onPress={() => selectCategory(item.owaspCategory)} />)}</>}
              {!!app.principais.length && <><Text style={ui.eyebrow}>MAIS GRAVES EM ABERTO</Text>{app.principais.map((item) => <DetailLink key={item.id} label={item.title} meta={item.severityFinal} onPress={() => router.push(`/(tabs)/home/finding/${item.id}`)} />)}</>}
            </> : category ? <>
              <Text style={ui.eyebrow}>CATEGORIA OWASP</Text><Text accessibilityRole="header" style={ui.heading}>{categoryLabel(category.code)}</Text>
              <Text style={ui.body}>{category.total} abertas em {category.applications.length} aplicações · Pior severidade: {labels[category.severity]}</Text>
              <Text style={ui.eyebrow}>APLICAÇÕES AFETADAS</Text>{category.applications.map((item) => <DetailLink key={item.id} label={item.name} meta={`${item.total} abertas`} onPress={() => selectApp(item.id)} />)}
            </> : <>
              <Text style={ui.eyebrow}>RESUMO DA EMPRESA</Text><Text accessibilityRole="header" style={ui.heading}>{applications.length} aplicações ativas</Text>
              <Text style={ui.body}>{total} vulnerabilidades em aberto · {applications.filter((item) => item.internetFacing).length} expostas à Internet</Text>
              <SeverityCounts counts={Object.fromEntries(severities.map((severity) => [severity, applications.reduce((sum, item) => sum + item.abertas[severity], 0)])) as Record<GraphSeverity, number>} />
              <Text style={ui.eyebrow}>ABERTAS POR ORIGEM</Text><Text style={ui.body}>{Object.entries(applications.reduce<Record<string, number>>((acc, item) => { for (const [source, count] of Object.entries(item.abertasPorOrigem ?? {})) acc[source] = (acc[source] ?? 0) + count; return acc; }, {})).map(([source, count]) => `${sourceLabels[source] ?? source}: ${count}`).join(" · ") || "Nenhuma"}</Text>
              <Text style={ui.muted}>Achados ainda não triados não aparecem até serem promovidos a vulnerabilidades vinculadas à aplicação.</Text>
            </>}
          </Surface>
          <SectionHeading title="Explorar conexões" />
          <Surface><Text style={ui.muted}>Selecione pela lista para acessar os mesmos detalhes da rede.</Text>
            <DetailLink label="Empresa" meta={`${applications.length} aplicações`} onPress={() => setSelection({ kind: "company" })} />
            {applications.map((item) => <DetailLink key={item.id} label={item.name} meta={`${item.totalAbertas} abertas`} onPress={() => selectApp(item.id)} />)}
            {categories.map((item) => <DetailLink key={item.code} label={categoryLabel(item.code)} meta={`${item.total} abertas`} onPress={() => selectCategory(item.code)} />)}
          </Surface>
        </>}
      </>}
    </>}
  </WorkspaceScreen>;
}

function SeverityCounts({ counts }: { counts: Record<GraphSeverity, number> }) {
  const { ui } = useAppTheme();
  return <View style={styles.counts}>{severities.map((severity) => <View key={severity} style={styles.count}><Text style={ui.muted}>{labels[severity]}</Text><Text style={ui.heading}>{counts[severity]}</Text></View>)}</View>;
}

function DetailLink({ label, meta, onPress }: { label: string; meta: string; onPress: () => void }) {
  const { workspace, ui } = useAppTheme();
  return <SoftPressable accessibilityRole="button" accessibilityLabel={`${label}, ${meta}`} onPress={onPress} style={[styles.detail, { borderTopColor: workspace.line }]}><Text style={[ui.body, ui.grow]}>{label}</Text><Text style={ui.muted}>{meta}</Text><Ionicons name="chevron-forward" size={16} color={workspace.muted} /></SoftPressable>;
}

function Network({ applications, categories, selection, onSelect }: { applications: ExposureApplication[]; categories: ReturnType<typeof sharedCategories>; selection: Selection; onSelect: (value: Selection) => void }) {
  const { workspace, colors } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<GraphLayout>("columns");
  const [viewport, setViewport] = useState(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const opacity = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { opacity.value = withTiming(1, { duration: reduced ? 0 : 350 }); }, [opacity, reduced]);
  const animation = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const graph = graphLayout(layout, applications.length, categories.length);
  const appPositions = new Map(applications.map((item, index) => [item.id, graph.applications[index]]));
  const categoryPositions = new Map(categories.map((item, index) => [item.code, graph.categories[index]]));
  const selectedApp = selection.kind === "app" ? selection.id : null;
  const selectedCategory = selection.kind === "category" ? selection.id : null;
  const selectedAppCategories = applications.find((item) => item.id === selectedApp)?.categorias.map((item) => item.owaspCategory) ?? [];
  const linkedApps = categories.find((item) => item.code === selectedCategory)?.applications.map((item) => item.id) ?? [];
  function edge(from: { x: number; y: number }, to: { x: number; y: number }, active: boolean, key: string) {
    const x = (from.x + to.x) / 2;
    const y = (from.y + to.y) / 2;
    const curve = layout === "rows"
      ? `${from.x} ${y}, ${to.x} ${y}`
      : `${x} ${from.y}, ${x} ${to.y}`;
    return <Path key={key} d={`M ${from.x} ${from.y} C ${curve}, ${to.x} ${to.y}`} stroke={active ? workspace.lavender : workspace.line} strokeWidth={active ? 2 : 1.5} fill="none" />;
  }
  const isCompany = selection.kind === "company";
  const severityColor = (severity: GraphSeverity | null) => severity === "CRITICAL" ? colors.severity.criticalInk : severity === "HIGH" ? colors.severity.highInk : severity === "MEDIUM" ? colors.severity.mediumInk : severity === "LOW" ? colors.severity.lowInk : workspace.lavender;
  function changeLayout(next: GraphLayout) {
    if (next === layout) return;
    setLayout(next);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }

  return <>
    <View style={styles.zoomRow}>
      <FilterChip tab label="Horizontal" selected={layout === "columns"} onPress={() => changeLayout("columns")} />
      <FilterChip tab label="Vertical" selected={layout === "rows"} onPress={() => changeLayout("rows")} />
    </View>
    <View style={styles.zoomRow}>
      <FilterChip label="Afastar" selected={false} onPress={() => setZoom((value) => Math.max(0.85, Math.round((value - 0.15) * 100) / 100))} />
      <Text style={{ color: workspace.secondary }}>{Math.round(zoom * 100)}%</Text>
      <FilterChip label="Aproximar" selected={false} onPress={() => setZoom((value) => Math.min(1.6, Math.round((value + 0.15) * 100) / 100))} />
      <FilterChip label="Centralizar" selected={false} onPress={() => scroll.current?.scrollTo({ x: Math.max(0, (graph.width * zoom - viewport) / 2), animated: !reduced })} />
    </View>
  <ScrollView ref={scroll} onLayout={(event) => setViewport(event.nativeEvent.layout.width)} horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
    <View style={{ width: Math.max(viewport, graph.width * zoom), height: graph.height * zoom }}>
    <Animated.View style={[{ position: "absolute", left: Math.max(0, (viewport - graph.width * zoom) / 2), width: graph.width, height: graph.height, transformOrigin: "top left", transform: [{ scale: zoom }] }, animation]}>
    <Svg width={graph.width} height={graph.height} style={StyleSheet.absoluteFill} accessible={false}>
      {applications.map((item) => edge(graph.company, appPositions.get(item.id)!, isCompany || item.id === selectedApp || linkedApps.includes(item.id), `company-${item.id}`))}
      {applications.flatMap((item) => item.categorias.map((category) => edge(appPositions.get(item.id)!, categoryPositions.get(category.owaspCategory)!, isCompany || item.id === selectedApp || category.owaspCategory === selectedCategory, `${item.id}-${category.owaspCategory}`)))}
    </Svg>
    <GraphNode {...graph.company} label="Empresa" icon="business-outline" selected={isCompany} connected={true} onPress={() => onSelect({ kind: "company" })} />
    {applications.map((item) => <GraphNode key={item.id} {...appPositions.get(item.id)!} label={item.name} sub={`${item.totalAbertas} abertas`} icon="apps-outline" tint={severityColor(item.piorSeveridade)} selected={selectedApp === item.id} connected={isCompany || selectedApp === item.id || linkedApps.includes(item.id)} onPress={() => onSelect({ kind: "app", id: item.id })} />)}
    {categories.map((item) => <GraphNode key={item.code} {...categoryPositions.get(item.code)!} label={item.code} sub={`${item.total} abertas`} icon="shield-outline" selected={selectedCategory === item.code} connected={isCompany || selectedCategory === item.code || selectedAppCategories.includes(item.code)} tint={severityColor(item.severity)} onPress={() => onSelect({ kind: "category", id: item.code })} />)}
  </Animated.View></View></ScrollView></>;
}

function GraphNode({ x, y, label, sub, icon, selected, connected, tint, onPress }: { x: number; y: number; label: string; sub?: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; connected: boolean; tint?: string; onPress: () => void }) {
  const { workspace, ui } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => { progress.value = withTiming(selected ? 1 : 0, { duration: reduced ? 0 : 200 }); }, [progress, reduced, selected]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: 1 + progress.value * 0.04 }] }));
  return <Animated.View style={[styles.nodePosition, { left: x - 58, top: y - 38 }, animated]}><SoftPressable accessibilityRole="button" accessibilityLabel={`${label}${sub ? `, ${sub}` : ""}`} accessibilityState={{ selected }} onPress={onPress} style={[styles.node, { borderColor: selected ? workspace.lavender : workspace.line, backgroundColor: selected ? workspace.chipActiveBg : workspace.inset, opacity: connected ? 1 : 0.5 }]}>
    <Ionicons name={icon} size={20} color={tint ?? workspace.lavender} /><Text numberOfLines={2} style={[ui.muted, styles.nodeText, { color: workspace.text }]}>{label}</Text>{sub && <Text style={[ui.mono, styles.nodeSub]}>{sub}</Text>}
  </SoftPressable></Animated.View>;
}

const styles = StyleSheet.create({
  nodePosition: { position: "absolute", width: 116 }, node: { width: 116, minHeight: 76, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, gap: 2 },
  nodeText: { fontFamily: FONT_FAMILY.medium, textAlign: "center", fontSize: 12, lineHeight: 15 }, nodeSub: { fontSize: 10 },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, count: { minWidth: 56, flexGrow: 1 },
  detail: { minHeight: 48, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  zoomRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
});
