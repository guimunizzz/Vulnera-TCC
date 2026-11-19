/**
 * Painel executivo para clientes: visão de projetos e riscos em aberto.
 * Usa as mesmas fontes de projetos e exposição já consumidas pelo app e permite abrir os detalhes.
 * Consumidor: aba inicial autenticada do Expo Router.
 */
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { projectsApi } from "../../src/api/projects.api";
import { exposureGraphApi } from "../../src/api/exposure-graph.api";
import { vulnerabilitiesApi } from "../../src/api/vulnerabilities.api";
import { DataState, GlassSurface, SectionHeading, WorkspaceScreen } from "../../src/components/workspace-ui";
import { HomeBrand } from "../../src/components/home-brand";
import { AssistantButton } from "../../src/components/assistant";
import { ExposureTrend } from "../../src/components/exposure-trend";
import { SoftPressable, useWorkspaceReducedMotion } from "../../src/components/workspace-motion";
import { useApiError } from "../../src/hooks/use-api-error";
import { exposureOverview, projectOverview } from "../../src/lib/dashboard";
import { useAuthStore } from "../../src/store/auth.store";
import { FONT_FAMILY } from "../../src/theme/tokens";
import { useAppTheme } from "../../src/theme/use-app-theme";
import { fraseDoSla } from "../../src/types/vulnerability.types";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const circumference = 2 * Math.PI * 42;
const severityLabels: Record<string, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };
const statusLabels: Record<string, string> = { OPEN: "Em aberto", IN_PROGRESS: "Em andamento" };

export default function DashboardScreen() {
  const { workspace, ui, colors } = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const errorMessage = useApiError();
  const projects = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  const exposure = useQuery({ queryKey: ["exposure-graph"], queryFn: ({ signal }) => exposureGraphApi.get(signal) });
  const overview = projects.data ? projectOverview(projects.data) : null;
  const risks = exposure.data ? exposureOverview(exposure.data.aplicacoes) : null;
  const priorityDetails = useQueries({ queries: (risks?.priorities ?? []).map((finding) => ({ queryKey: ["vulnerabilities", finding.id], queryFn: ({ signal }: { signal: AbortSignal }) => vulnerabilitiesApi.getById(finding.id, signal), retry: false })) });

  return <WorkspaceScreen refreshing={projects.isRefetching || exposure.isRefetching} onRefresh={() => { void projects.refetch(); void exposure.refetch(); }}>
    <View style={styles.top}><HomeBrand /><View style={{ flexDirection: "row", gap: 8 }}><AssistantButton /><SoftPressable accessibilityRole="button" accessibilityLabel="Abrir minha conta" onPress={() => router.push("/(tabs)/settings")} style={[styles.avatar, { backgroundColor: workspace.neutralTint, borderColor: workspace.line }]}><Text style={[styles.avatarText, { color: workspace.secondary }]}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text></SoftPressable></View></View>
    <DashboardReveal><Text accessibilityRole="header" style={ui.title}>Olá, {user?.name?.split(" ")[0] ?? "cliente"}<Text style={{ color: workspace.lavender }}>.</Text></Text><Text style={ui.body}>Ações e riscos que merecem sua atenção.</Text></DashboardReveal>
    <DashboardReveal delay={60}><GlassSurface strong>
      <View style={styles.overview}><ProgressRing percent={overview?.percent ?? null} /><View style={[ui.grow, { gap: 10 }]}><Text accessibilityRole="header" style={ui.heading}>Visão geral</Text>
        {overview ? <><Text style={ui.body}>{overview.completed} de {overview.total} {overview.total === 1 ? "projeto concluído" : "projetos concluídos"}</Text><Text style={ui.muted}>{overview.active} em análise ou revisão</Text></> : <Text style={ui.muted}>{projects.isPending ? "Carregando projetos..." : "Projetos indisponíveis"}</Text>}
        {risks ? <Text style={[ui.muted, risks.critical > 0 && { color: colors.dangerInk }]}>{risks.critical} {risks.critical === 1 ? "crítica" : "críticas"} em aberto</Text> : <Text style={ui.muted}>{exposure.isPending ? "Carregando exposição..." : "Exposição indisponível"}</Text>}
      </View></View>
    </GlassSurface></DashboardReveal>
    {projects.isError && <DataState error title="Projetos indisponíveis" message={errorMessage(projects.error)} onRetry={() => { void projects.refetch(); }} />}
    {exposure.isError && <DataState error title="Exposição indisponível" message={errorMessage(exposure.error)} onRetry={() => { void exposure.refetch(); }} />}
    <DashboardReveal delay={120}><View style={{ gap: 12 }}><SectionHeading title="Prioridades" meta="ATÉ 3 ACHADOS" />
      {exposure.isPending && <DataState loading title="Buscando prioridades" />}
      {risks && <GlassSurface>{risks.priorities.length ? risks.priorities.map((item, index) => { const sla = priorityDetails[index]?.data?.sla; const prazo = sla?.state && sla.state !== "NO_SLA" ? fraseDoSla(sla.state, sla.remainingMs) : null; return <SoftPressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}, ${severityLabels[item.severityFinal] ?? item.severityFinal}, ${item.applicationName}, ${statusLabels[item.status] ?? item.status}${prazo ? `, prazo ${prazo}` : ""}`} onPress={() => router.push(`/(tabs)/home/finding/${item.id}`)} style={[styles.priority, index > 0 && { borderTopWidth: 1, borderTopColor: workspace.line }]}>
        <View style={[styles.rank, { backgroundColor: workspace.chipActiveBg }]}><Text style={[ui.mono, { color: workspace.lavender }]}>{index + 1}</Text></View>
        <View style={[ui.grow, { gap: 3 }]}><Text style={ui.body}>{item.title}</Text><Text style={ui.muted}>{item.applicationName} · {severityLabels[item.severityFinal] ?? item.severityFinal} · {statusLabels[item.status] ?? item.status}</Text>{prazo && <Text style={ui.muted}>Prazo: {prazo}</Text>}</View><Ionicons name="chevron-forward" size={18} color={workspace.muted} />
      </SoftPressable>; }) : <Text style={ui.body}>Nenhuma vulnerabilidade aberta para priorizar.</Text>}</GlassSurface>}
    </View></DashboardReveal>
    {exposure.data && <DashboardReveal delay={160}><ExposureTrend applications={exposure.data.aplicacoes} /></DashboardReveal>}
    <DashboardReveal delay={180}><GlassSurface accessibilityLabel="Abrir grafo de exposição" onPress={() => router.push("/(tabs)/security")}><View style={ui.spread}><View style={[ui.grow, { gap: 5 }]}><Text accessibilityRole="header" style={ui.heading}>Exposição</Text><Text style={ui.muted}>{risks ? `${risks.open} vulnerabilidades abertas nas aplicações ativas` : "Veja as conexões entre aplicações e categorias OWASP."}</Text></View><Ionicons name="git-network-outline" size={24} color={workspace.lavender} /></View></GlassSurface></DashboardReveal>
    <DashboardReveal delay={220}><GlassSurface accessibilityLabel="Ver projetos" onPress={() => router.push("/(tabs)/home")}><View style={ui.spread}><View style={[ui.grow, { gap: 5 }]}><Text style={ui.heading}>Seus projetos</Text><Text style={ui.muted}>Acompanhe suas análises de segurança.</Text></View><Ionicons name="arrow-forward" size={20} color={workspace.lavender} /></View></GlassSurface></DashboardReveal>
  </WorkspaceScreen>;
}

function DashboardReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { progress.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration: 320 })); return () => cancelAnimation(progress); }, [delay, progress, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 8 }] }));
  return <Animated.View style={[{ gap: 8 }, style]}>{children}</Animated.View>;
}

function ProgressRing({ percent }: { percent: number | null }) {
  const { workspace, ui } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(reduced ? (percent ?? 0) / 100 : 0);
  useEffect(() => { progress.value = withTiming((percent ?? 0) / 100, { duration: reduced ? 0 : 650 }); return () => cancelAnimation(progress); }, [percent, progress, reduced]);
  const animated = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));
  return <View style={styles.ring} accessible accessibilityLabel={percent == null ? "Percentual de projetos concluídos indisponível" : `${percent}% dos projetos concluídos`}>
    <Svg width={112} height={112} style={StyleSheet.absoluteFill} accessibilityElementsHidden><Circle cx={56} cy={56} r={42} stroke={workspace.line} strokeWidth={8} fill="none" /><AnimatedCircle cx={56} cy={56} r={42} stroke={workspace.lavender} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} animatedProps={animated} rotation={-90} origin="56,56" /></Svg>
    <Text style={[styles.percent, { color: workspace.text }]}>{percent == null ? "—" : `${percent}%`}</Text><Text style={ui.muted}>concluídos</Text>
  </View>;
}

const styles = StyleSheet.create({
  top: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  avatar: { width: 48, height: 48, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" }, avatarText: { fontFamily: FONT_FAMILY.semibold, fontSize: 16 },
  overview: { flexDirection: "row", alignItems: "center", gap: 16 }, ring: { width: 112, height: 112, alignItems: "center", justifyContent: "center" }, percent: { fontFamily: FONT_FAMILY.semibold, fontSize: 24 },
  priority: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10 }, rank: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
