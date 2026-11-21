/**
 * Painel de indicadores do cliente. Exibe atividade semanal, severidade atual e etapas dos projetos.
 * Consumidor: aba inicial autenticada, com o mesmo recorte de acesso das consultas da API.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { skipToken, useQuery } from "@tanstack/react-query";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { projectsApi } from "../../../src/api/projects.api";
import { exposureGraphApi } from "../../../src/api/exposure-graph.api";
import { metricsApi } from "../../../src/api/metrics.api";
import { OpenFindingsChart, ProjectStagesChart } from "../../../src/components/dashboard-charts";
import { ExposureTrend } from "../../../src/components/exposure-trend";
import { PageHeader, SectionHeading, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { SOFT_MOTION, useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";
import { exposureOverview, projectsByStatus } from "../../../src/lib/dashboard";
import { lastFourWeeks, weeklyActivity } from "../../../src/lib/exposure-trend";
import { useAuthStore } from "../../../src/store/auth.store";
import { useAppTheme } from "../../../src/theme/use-app-theme";

const refreshHint = Platform.OS === "web" ? "Recarregue a página para tentar novamente." : "Puxe para atualizar.";
const readError = "Não foi possível carregar os dados. " + refreshHint;
const staleData = "Mostrando os últimos dados disponíveis. " + refreshHint;
const number = new Intl.NumberFormat("pt-BR");

export default function DashboardScreen() {
  const { workspace, ui } = useAppTheme();
  const name = useAuthStore((state) => state.user?.name?.trim().split(/\s+/)[0]) || "cliente";
  const [period, setPeriod] = useState(() => lastFourWeeks(new Date()));
  useFocusEffect(useCallback(() => { setPeriod(lastFourWeeks(new Date())); }, []));

  const projects = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  const exposure = useQuery({ queryKey: ["exposure-graph"], queryFn: ({ signal }) => exposureGraphApi.get(signal) });
  const overview = exposure.data ? exposureOverview(exposure.data.aplicacoes) : null;
  const application = overview?.mainApplication;
  const trend = useQuery({
    queryKey: ["metrics", "timeseries", application?.id, "week", period.from],
    queryFn: application
      ? ({ signal }) => metricsApi.weeklyTimeseries(application.id, period.from, period.to, signal)
      : skipToken,
  });
  const activity = trend.data?.granularidade === "week" ? weeklyActivity(period.weekStarts, trend.data.pontos) : null;

  function refresh() {
    const next = lastFourWeeks(new Date());
    setPeriod(next);
    void exposure.refetch();
    void projects.refetch();
    if (application && next.from === period.from) void trend.refetch();
  }

  return <WorkspaceScreen onRefresh={refresh} refreshing={exposure.isRefetching || projects.isRefetching || trend.isRefetching}>
    <PageHeader account />
    <Text accessibilityRole="header" style={ui.title}>Olá, {name}<Text style={{ color: workspace.lavender }}>.</Text></Text>

    <DashboardReveal>
      <ChartSection title="Achados em aberto" subtitle="Todas as aplicações ativas">
        {overview ? <>
          {exposure.isError && <ChartMessage text={staleData} />}
          <OpenFindingsChart data={overview} />
        </> : <ChartMessage busy={exposure.isPending} text={exposure.isPending ? "Carregando severidades…" : readError} />}
      </ChartSection>
    </DashboardReveal>

    <DashboardReveal delay={45}>
      <ChartSection divided title="Novos e resolvidos" subtitle={application ? application.name + " · 4 semanas completas" : "4 semanas completas"}>
        {activity ? <>
          {trend.isError && <ChartMessage text={staleData} />}
          <ExposureTrend activity={activity} />
        </> : exposure.isPending || application && trend.isPending ? <ChartMessage busy text="Carregando histórico…" />
          : exposure.isError || trend.isError || trend.data ? <ChartMessage text={readError} />
          : <ChartMessage text="Nenhuma aplicação ativa para acompanhar." />}
      </ChartSection>
    </DashboardReveal>

    <DashboardReveal delay={90}>
      <ChartSection divided title="Projetos por etapa" subtitle={projects.data?.length ? number.format(projects.data.length) +
        (projects.data.length === 1 ? " projeto no total" : " projetos no total") : undefined}>
        {projects.data ? <>
          {projects.isError && <ChartMessage text={staleData} />}
          <ProjectStagesChart counts={projectsByStatus(projects.data)} total={projects.data.length} />
        </> : <ChartMessage busy={projects.isPending} text={projects.isPending ? "Carregando projetos…" : readError} />}
      </ChartSection>
    </DashboardReveal>
  </WorkspaceScreen>;
}

function ChartSection({ title, subtitle, children, divided = false }: {
  title: string; subtitle?: string; children: ReactNode; divided?: boolean;
}) {
  const { ui, workspace } = useAppTheme();
  return <View style={[styles.section, divided && { borderTopWidth: 1, borderTopColor: workspace.line, paddingTop: 20 }]}>
    <View style={styles.heading}>
      <SectionHeading title={title} />
      {subtitle && <Text style={ui.muted}>{subtitle}</Text>}
    </View>
    {children}
  </View>;
}

function ChartMessage({ text, busy = false }: { text: string; busy?: boolean }) {
  const { workspace, ui } = useAppTheme();
  return <View style={styles.message} aria-busy={busy}>
    {busy && <ActivityIndicator color={workspace.lavender} />}
    <Text accessibilityLiveRegion="polite" style={[ui.muted, ui.grow]}>{text}</Text>
  </View>;
}

function DashboardReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useWorkspaceReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.value = reduced ? 1 : withDelay(delay, withTiming(1, SOFT_MOTION));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduced]);
  const motionStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: (1 - progress.value) * 6 }] }));
  return <Animated.View style={motionStyle}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  heading: { gap: 3 },
  message: { flexDirection: "row", alignItems: "center", gap: 8 },
});
