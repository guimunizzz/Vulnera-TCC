/** Gráfico diário por aplicação para o Painel; distingue novos achados do estoque em aberto. */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { metricsApi } from "../api/metrics.api";
import { useApiError } from "../hooks/use-api-error";
import { last30Days, trendGeometry } from "../lib/exposure-trend";
import { useAppTheme } from "../theme/use-app-theme";
import type { ExposureApplication } from "../types/exposure-graph.types";
import { ActionButton, DataState, FilterChip, GlassSurface } from "./workspace-ui";
import { useWorkspaceReducedMotion } from "./workspace-motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function ExposureTrend({ applications }: { applications: ExposureApplication[] }) {
  const { workspace, ui } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const chartRef = useRef<ComponentRef<typeof Pressable>>(null);
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
  const selectedDay = day !== null && points && day < points.length ? points[day] : null;
  const selectDay = (index: number) => { if (points?.length) setDay(Math.max(0, Math.min(points.length - 1, index))); };

  return <GlassSurface>
    <View style={{ gap: 4 }}><Text accessibilityRole="header" style={ui.heading}>Evolução da exposição</Text><Text style={ui.muted}>Achados identificados por dia · últimos 30 dias</Text></View>
    {!application ? <Text style={ui.body}>O histórico ficará disponível quando houver aplicações ativas.</Text> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {applications.map((item) => <FilterChip key={item.id} label={item.name} selected={item.id === application.id} onPress={() => { setSelected(item.id); setDay(null); }} />)}
      </ScrollView>
      {query.isError && <View style={{ gap: 8 }}>
        <Text style={ui.body} accessibilityLiveRegion="polite">{query.data ? "Exibindo o último histórico carregado." : "Histórico indisponível"}</Text>
        <Text style={ui.muted}>{errorMessage(query.error)}</Text>
        <ActionButton label="Tentar atualizar histórico" disabled={query.isRefetching} onPress={() => { void query.refetch(); }} />
      </View>}
      {query.isPending ? <DataState loading title="Carregando histórico" /> : query.data && !points?.length ? <Text style={ui.body}>Nenhum histórico disponível neste período.</Text> : !!points?.length && <>
        <View>
          <Text style={ui.muted}>Máximo diário: {geometry.total === 0 ? 0 : geometry.maximum}</Text>
          <Pressable ref={chartRef} accessibilityRole="adjustable" accessibilityLabel={`Histórico de ${application.name}`} accessibilityValue={{ text: selectedDay ? `${format(selectedDay.periodo)}: ${selectedDay.criados} achados` : `${geometry.total} achados no período` }} accessibilityHint="Deslize para cima ou para baixo para consultar cada dia" accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={(event) => selectDay((day ?? 0) + (event.nativeEvent.actionName === "increment" ? 1 : -1))} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)} onPress={(event) => { const pageX = event.nativeEvent.pageX; if (chartWidth > 0 && Number.isFinite(pageX)) chartRef.current?.measureInWindow((x) => selectDay(Math.round((pageX - x) / chartWidth * (points.length - 1)))); }} style={styles.chart}>
            <Svg pointerEvents="none" width="100%" height="112" viewBox="0 0 280 112" preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Line x1={0} y1={100} x2={280} y2={100} stroke={workspace.line} strokeWidth={1} />
            <AnimatedPath d={geometry.path} fill="none" stroke={workspace.lavender} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${geometry.length} ${geometry.length}`} animatedProps={animated} />
            {selectedDay && day !== null && <Circle cx={points.length > 1 ? day * 280 / (points.length - 1) : 140} cy={100 - (selectedDay.criados / geometry.maximum) * 92} r={5} fill={workspace.lavender} />}
          </Svg></Pressable>
          <View style={ui.spread}><Text style={ui.muted}>{format(points[0].periodo)}</Text><Text style={ui.muted}>{format(points[points.length - 1].periodo)}</Text></View>
        </View>
        <Text accessibilityLiveRegion="polite" style={ui.body}>{selectedDay ? `${format(selectedDay.periodo)}: ${selectedDay.criados} ${selectedDay.criados === 1 ? "achado" : "achados"}` : "Toque na linha para consultar um dia."}</Text>
        <View style={styles.dayControls}><FilterChip label="Dia anterior" selected={false} onPress={() => selectDay((day ?? points.length) - 1)} /><FilterChip label="Próximo dia" selected={false} onPress={() => selectDay((day ?? -1) + 1)} /></View>
        <Text style={ui.body}>{geometry.total} {geometry.total === 1 ? "achado identificado" : "achados identificados"} no período</Text>
        <Text style={ui.muted}>Mostra novos achados, não o total de vulnerabilidades em aberto.</Text>
      </>}
    </>}
  </GlassSurface>;
}

const styles = StyleSheet.create({ filters: { gap: 8 }, chart: { minHeight: 112 }, dayControls: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
