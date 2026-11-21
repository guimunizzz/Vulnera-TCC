/**
 * Painel do cliente. Destaca um achado e agrupa a consulta das demais prioridades e da evolução.
 * Consumidor: aba inicial autenticada, com acesso aos achados e projetos.
 */
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { projectsApi } from "../../../src/api/projects.api";
import { exposureGraphApi } from "../../../src/api/exposure-graph.api";
import { vulnerabilitiesApi } from "../../../src/api/vulnerabilities.api";
import { SeverityBadge, ROTULO_SEVERIDADE } from "../../../src/components/badge";
import { ExposureTrend } from "../../../src/components/exposure-trend";
import { ActionButton, DataState, PageHeader, SectionHeading, Surface, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { SoftPressable, SOFT_MOTION, useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";
import { useApiError } from "../../../src/hooks/use-api-error";
import { exposureOverview, projectOverview } from "../../../src/lib/dashboard";
import { haptics } from "../../../src/lib/haptics";
import { useAuthStore } from "../../../src/store/auth.store";
import { FONT_FAMILY } from "../../../src/theme/tokens";
import { getSlaInk, useAppTheme } from "../../../src/theme/use-app-theme";
import { fraseDoSla } from "../../../src/types/vulnerability.types";

export default function DashboardScreen() {
  const { workspace, ui, colors } = useAppTheme();
  const name = useAuthStore((state) => state.user?.name?.trim().split(/\s+/)[0]) || "cliente";
  const router = useRouter();
  const errorMessage = useApiError();
  const [showOtherPriorities, setShowOtherPriorities] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const projects = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  const exposure = useQuery({ queryKey: ["exposure-graph"], queryFn: ({ signal }) => exposureGraphApi.get(signal) });
  const overview = projects.data ? projectOverview(projects.data) : null;
  const priorities = exposure.data ? exposureOverview(exposure.data.aplicacoes).priorities : [];
  const details = useQueries({ queries: priorities.map(({ id }) => ({
    queryKey: ["vulnerabilities", id], queryFn: ({ signal }: { signal: AbortSignal }) => vulnerabilitiesApi.getById(id, signal), retry: false,
  })) });
  const [first, ...other] = priorities;
  const firstSla = details[0]?.data?.sla;
  const deadline = firstSla && firstSla.state !== "NO_SLA" ? fraseDoSla(firstSla.state, firstSla.remainingMs) : undefined;
  const otherPrioritiesLabel = (showOtherPriorities ? "Recolher prioridades" : "Ver outras prioridades") + ` (${other.length})`;
  const openFinding = (id: string) => router.push({ pathname: "/(tabs)/dashboard/finding/[id]", params: { id } });

  return <WorkspaceScreen refreshing={projects.isRefetching || exposure.isRefetching}
    onRefresh={() => { void projects.refetch(); void exposure.refetch(); }}>
    <PageHeader account />

    <DashboardReveal>
      <Text accessibilityRole="header" style={ui.title}>Olá, {name}<Text style={{ color: workspace.lavender }}>.</Text></Text>
    </DashboardReveal>

    <DashboardReveal delay={45}>
      <SectionHeading title="Prioridades" />
      {exposure.isPending && <DataState loading title="Buscando prioridades" />}
      {exposure.isError && !exposure.data && <DataState error title="Prioridades indisponíveis"
        message={errorMessage(exposure.error)} onRetry={() => { void exposure.refetch(); }} />}
      {exposure.isError && exposure.data && <View style={styles.rows}>
        <Text accessibilityLiveRegion="polite" style={ui.muted}>Exibindo as últimas prioridades carregadas. {errorMessage(exposure.error)}</Text>
        <ActionButton label="Atualizar prioridades" disabled={exposure.isRefetching} onPress={() => { void exposure.refetch(); }} />
      </View>}
      {first && <Surface strong onPress={() => openFinding(first.id)} accessibilityLabel={
        `Abrir achado ${first.title}, ${severityLabel(first.severityFinal)}, ${first.applicationName}${deadline ? `, ${deadline}` : ""}`
      } style={[styles.featured, { borderColor: workspace.actionBorder }]}>
        <View style={styles.metadata}>
          <SeverityBadge severidade={first.severityFinal} />
          {deadline && <Text style={[styles.deadline, { color: getSlaInk(firstSla?.state, colors) ?? workspace.text }]}>{deadline}</Text>}
        </View>
        <View style={styles.context}>
          <Text style={[ui.heading, styles.findingTitle]}>{first.title}</Text>
          <Text style={ui.body}>{first.applicationName}</Text>
        </View>
        <View style={[ui.spread, styles.featuredAction, { borderTopColor: workspace.line }]}>
          <Text style={[ui.body, { color: workspace.lavender, fontFamily: FONT_FAMILY.semibold }]}>Abrir achado</Text>
          <Ionicons name="arrow-forward" size={20} color={workspace.lavender} />
        </View>
      </Surface>}
      {exposure.data && !first && <Text style={ui.body}>{exposure.data.aplicacoes.length
        ? "Nenhum achado aberto para priorizar."
        : "Nenhuma aplicação ativa para acompanhar."}</Text>}
      {other.length > 0 && <View>
        <SoftPressable accessibilityRole="button" accessibilityLabel={otherPrioritiesLabel}
          accessibilityState={{ expanded: showOtherPriorities }} aria-expanded={showOtherPriorities}
          onPress={() => setShowOtherPriorities((value) => !value)} style={[ui.spread, styles.simpleRow]}>
          <Text style={[ui.body, { color: workspace.lavender, fontFamily: FONT_FAMILY.medium }]}>
            {otherPrioritiesLabel}
          </Text>
          <Ionicons name={showOtherPriorities ? "chevron-up" : "chevron-down"} size={18} color={workspace.lavender} />
        </SoftPressable>
        {showOtherPriorities && other.map((item, index) => {
          const sla = details[index + 1]?.data?.sla;
          const due = sla && sla.state !== "NO_SLA" ? fraseDoSla(sla.state, sla.remainingMs) : null;
          const severity = severityLabel(item.severityFinal);
          return <SoftPressable key={item.id} onPress={() => { haptics.tap(); openFinding(item.id); }} accessibilityRole="button"
            accessibilityLabel={`Abrir achado ${item.title}, ${severity}${due ? `, ${due}` : ""}`}
            style={[ui.spread, styles.listRow, { borderColor: workspace.line }]}>
            <View style={ui.grow}><Text style={ui.heading}>{item.title}</Text>
              <Text style={ui.muted}>{severity}{due && <Text style={{ color: getSlaInk(sla?.state, colors) }}>{` · ${due}`}</Text>}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={workspace.muted} />
          </SoftPressable>;
        })}
      </View>}
    </DashboardReveal>

    <DashboardReveal delay={65} style={[styles.projects, { borderColor: workspace.line }]}>
      <Text accessibilityRole="header" style={ui.heading}>Projetos</Text>
      <SoftPressable accessibilityRole="button" accessibilityLabel="Abrir projetos"
        onPress={() => { haptics.tap(); router.push("/(tabs)/home"); }} style={[ui.spread, styles.simpleRow]}>
        <View style={[ui.row, ui.grow]}>
          <View style={[styles.projectIcon, { backgroundColor: workspace.neutralTint }]}>
            <Ionicons name="folder-outline" size={21} color={workspace.lavender} />
          </View>
          <Text style={[ui.body, ui.grow]}>{overview
            ? overview.active === 0 ? "Nenhum em análise ou revisão" : overview.active + " em análise ou revisão"
            : projects.isPending ? "Carregando projetos…" : "Ver projetos"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={workspace.muted} />
      </SoftPressable>
      {projects.isError && <View style={styles.rows}>
        <Text accessibilityLiveRegion="polite" style={ui.muted}>{errorMessage(projects.error)}</Text>
        <ActionButton label="Atualizar projetos" disabled={projects.isRefetching} onPress={() => { void projects.refetch(); }} />
      </View>}
    </DashboardReveal>

    {!!exposure.data?.aplicacoes.length && <DashboardReveal delay={90} style={[styles.trend, { borderColor: workspace.line }]}>
      <SoftPressable accessibilityRole="button" accessibilityLabel={showTrend ? "Recolher evolução" : "Evolução da exposição"}
        accessibilityState={{ expanded: showTrend }} aria-expanded={showTrend}
        onPress={() => setShowTrend((value) => !value)} style={[ui.spread, styles.simpleRow]}>
        <Text style={[ui.heading, ui.grow]}>{showTrend ? "Recolher evolução" : "Evolução da exposição"}</Text>
        <Ionicons name={showTrend ? "chevron-up" : "chevron-down"} size={18} color={workspace.lavender} />
      </SoftPressable>
      {showTrend && <ExposureTrend applications={exposure.data.aplicacoes} />}
    </DashboardReveal>}
  </WorkspaceScreen>;
}

function severityLabel(severity: string) {
  return ROTULO_SEVERIDADE[severity as keyof typeof ROTULO_SEVERIDADE] ?? severity;
}

function DashboardReveal({ children, delay = 0, style }: {
  children: ReactNode; delay?: number; style?: ComponentProps<typeof Animated.View>["style"];
}) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced ? 1 : withDelay(delay, withTiming(1, SOFT_MOTION));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduced]);
  const motionStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 6 }] }));
  return <Animated.View style={[styles.group, style, motionStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  group: { gap: 18 },
  rows: { gap: 8 },
  featured: { padding: 20, gap: 19 },
  metadata: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  context: { gap: 5 },
  findingTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
  deadline: { fontFamily: FONT_FAMILY.semibold, fontSize: 13, lineHeight: 19 },
  featuredAction: { borderTopWidth: 1, paddingTop: 13 },
  simpleRow: { paddingVertical: 3 },
  listRow: { borderTopWidth: 1, paddingVertical: 12 },
  projects: { borderTopWidth: 1, paddingTop: 22, marginTop: 4, gap: 9 },
  trend: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  projectIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
