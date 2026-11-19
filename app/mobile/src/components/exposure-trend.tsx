/** Gráfico diário por aplicação para o Painel; distingue novos achados do estoque em aberto. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { metricsApi } from "../api/metrics.api";
import { useApiError } from "../hooks/use-api-error";
import { last30Days, trendGeometry } from "../lib/exposure-trend";
import { useAppTheme } from "../theme/use-app-theme";
import type { ExposureApplication } from "../types/exposure-graph.types";
import { DataState, FilterChip, GlassSurface } from "./workspace-ui";
import { useWorkspaceReducedMotion } from "./workspace-motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function ExposureTrend({ applications }: { applications: ExposureApplication[] }) {
  const { workspace, ui } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState(() => last30Days(new Date()));
  useFocusEffect(useCallback(() => { setPeriod(last30Days(new Date())); }, []));
  const application = applications.find((app) => app.id === selected) ?? applications[0];
  const query = useQuery({ queryKey: ["metrics", "timeseries", application?.id, period.from, period.to], queryFn: ({ signal }) => metricsApi.timeseries(application!.id, period.from, period.to, signal), enabled: !!application });
  const errorMessage = useApiError();
  const reduced = useWorkspaceReducedMotion();
  const points = query.data?.pontos;
  const geometry = useMemo(() => trendGeometry(points ?? []), [points]);
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = 0; progress.value = withTiming(1, { duration: reduced ? 0 : 700 }); return () => cancelAnimation(progress); }, [geometry.path, progress, reduced]);
  const animated = useAnimatedProps(() => ({ strokeDashoffset: geometry.length * (1 - progress.value) }));
  const format = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;

  return <GlassSurface>
    <View style={{ gap: 4 }}><Text accessibilityRole="header" style={ui.heading}>Evolução da exposição</Text><Text style={ui.muted}>Achados identificados por dia · últimos 30 dias</Text></View>
    {!application ? <Text style={ui.body}>Nenhuma aplicação ativa para acompanhar.</Text> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {applications.map((item) => <FilterChip key={item.id} label={item.name} selected={item.id === application.id} onPress={() => setSelected(item.id)} />)}
      </ScrollView>
      {query.isPending ? <DataState loading title="Carregando histórico" /> : query.isError ? <DataState error title="Histórico indisponível" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : !points?.length ? <Text style={ui.body}>Nenhum histórico disponível neste período.</Text> : <>
        <View accessibilityRole="image" accessibilityLabel={`${geometry.total} achados identificados em ${application.name} no período, máximo diário ${geometry.maximum === 1 && geometry.total === 0 ? 0 : geometry.maximum}`}>
          <View style={styles.chart}><Svg width="100%" height="112" viewBox="0 0 280 112" preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Line x1={0} y1={100} x2={280} y2={100} stroke={workspace.line} strokeWidth={1} />
            <AnimatedPath d={geometry.path} fill="none" stroke={workspace.lavender} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${geometry.length} ${geometry.length}`} animatedProps={animated} />
          </Svg></View>
          <View style={ui.spread}><Text style={ui.muted}>{format(points[0].periodo)}</Text><Text style={ui.muted}>{format(points[points.length - 1].periodo)}</Text></View>
        </View>
        <Text style={ui.body}>{geometry.total} {geometry.total === 1 ? "achado identificado" : "achados identificados"} no período</Text>
        <Text style={ui.muted}>Mostra novos achados, não o total de vulnerabilidades em aberto.</Text>
      </>}
    </>}
  </GlassSurface>;
}

const styles = StyleSheet.create({ filters: { gap: 8 }, chart: { minHeight: 112 } });
