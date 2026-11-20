/** Gráfico diário por aplicação para o Painel; distingue novos achados do estoque em aberto. */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { metricsApi } from "../api/metrics.api";
import { useApiError } from "../hooks/use-api-error";
import { last30Days, TREND_PLOT, trendGeometry } from "../lib/exposure-trend";
import { useAppTheme } from "../theme/use-app-theme";
import type { ExposureApplication } from "../types/exposure-graph.types";
import { ActionButton, DataState, FilterChip, Surface } from "./workspace-ui";
import { useWorkspaceReducedMotion } from "./workspace-motion";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const plotHeight = 144;
const formatDay = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;

export function ExposureTrend({ applications }: { applications: ExposureApplication[] }) {
  const { colors, workspace, ui } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const chartRef = useRef<ComponentRef<typeof Pressable>>(null);
  const [periodStart, setPeriodStart] = useState(() => last30Days(new Date()).from);
  useFocusEffect(useCallback(() => { setPeriodStart(last30Days(new Date()).from); }, []));
  const application = applications.find((app) => app.id === selected) ?? applications[0];
  // O instante de consulta atualiza a requisição sem invalidar a série a cada troca de aba.
  const query = useQuery({
    queryKey: ["metrics", "timeseries", application?.id, periodStart],
    queryFn: ({ signal }) => metricsApi.timeseries(application!.id, periodStart, new Date().toISOString(), signal),
    enabled: !!application,
  });
  const errorMessage = useApiError();
  const reduced = useWorkspaceReducedMotion();
  const points = query.data?.pontos;
  const geometry = useMemo(() => trendGeometry(points ?? []), [points]);
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = 0; progress.value = withTiming(1, { duration: reduced ? 0 : 700 }); return () => cancelAnimation(progress); }, [geometry.created.path, progress, reduced]);
  const animated = useAnimatedProps(() => ({ strokeDashoffset: geometry.created.length * (1 - progress.value) }));
  const selectedDay = day === null ? undefined : points?.[day];
  const markerIndex = day ?? (points?.length === 1 ? 0 : -1);
  const selectedCreated = geometry.created.coordinates[markerIndex];
  const selectedResolved = geometry.resolved.coordinates[markerIndex];
  const periodTotals = `${geometry.created.total} novos · ${geometry.resolved.total} resolvidos`;
  const daySummary = selectedDay ? `${formatDay(selectedDay.periodo)} · ${selectedDay.criados} novos · ${selectedDay.resolvidos} resolvidos` : null;
  const selectDay = (index: number) => { if (points?.length) setDay(Math.max(0, Math.min(points.length - 1, index))); };

  return <Surface>
    <View style={{ gap: 4 }}><Text accessibilityRole="header" style={ui.heading}>Evolução da exposição</Text><Text style={ui.muted}>Achados por dia · últimos 30 dias</Text></View>
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
        <View style={styles.legend}>
          <View style={ui.row}><View style={[styles.key, { backgroundColor: colors.chartCreated }]} /><Text style={ui.muted}>Novos</Text></View>
          <View style={ui.row}><View style={[styles.key, styles.dashedKey, { borderColor: colors.chartResolved }]} /><Text style={ui.muted}>Resolvidos</Text></View>
        </View>
        <View style={styles.plotRow}>
          <View style={styles.yAxis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {geometry.grid.map(({ value, y }) => <Text key={value} style={[ui.mono, styles.tick, { top: y * plotHeight / TREND_PLOT.height - 8 }]}>{value}</Text>)}
          </View>
          <View style={ui.grow}>
            <Pressable ref={chartRef} accessibilityRole="adjustable" accessibilityLabel={`Histórico de ${application.name}`}
              accessibilityValue={{ text: daySummary ?? `${periodTotals} no período` }} aria-valuetext={daySummary ?? `${periodTotals} no período`}
              accessibilityHint="Use o ajuste para consultar os valores de cada dia"
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(event) => selectDay((day ?? 0) + (event.nativeEvent.actionName === "increment" ? 1 : -1))}
              onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
              onPress={(event) => {
                const pageX = event.nativeEvent.pageX;
                if (chartWidth > 0 && Number.isFinite(pageX)) {
                  chartRef.current?.measureInWindow((x) => selectDay(Math.round((pageX - x) / chartWidth * (points.length - 1))));
                }
              }} style={styles.chart}>
              <Svg pointerEvents="none" width="100%" height={plotHeight} viewBox={`0 0 ${TREND_PLOT.width} ${TREND_PLOT.height}`}
                preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {geometry.grid.map(({ value, y }) => <Line key={value} x1={0} y1={y} x2={TREND_PLOT.width} y2={y} stroke={workspace.line} strokeWidth={1} />)}
                {selectedDay && selectedCreated && <Line x1={selectedCreated.x} y1={TREND_PLOT.top} x2={selectedCreated.x} y2={TREND_PLOT.bottom} stroke={workspace.muted} strokeWidth={1} strokeDasharray="3 3" />}
                {points.length > 1 && <>
                  <AnimatedPath d={geometry.created.path} fill="none" stroke={colors.chartCreated} strokeWidth={2.5}
                    strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${geometry.created.length} ${geometry.created.length}`} animatedProps={animated} />
                  <Path d={geometry.resolved.path} fill="none" stroke={colors.chartResolved} strokeWidth={2} strokeDasharray="5 4" />
                </>}
                {selectedResolved && <Circle cx={selectedResolved.x} cy={selectedResolved.y}
                  r={5} stroke={colors.chartResolved} strokeWidth={2} fill={workspace.surface} />}
                {selectedCreated && <Circle cx={selectedCreated.x} cy={selectedCreated.y} r={3.5} fill={colors.chartCreated} />}
              </Svg>
            </Pressable>
            <View style={ui.spread}><Text style={ui.muted}>{formatDay(points[0].periodo)}</Text>{points.length > 1 && <Text style={ui.muted}>{formatDay(points[points.length - 1].periodo)}</Text>}</View>
          </View>
        </View>
        <View style={[styles.readout, { backgroundColor: workspace.inset }]}>
          <Text style={ui.muted}>{selectedDay ? "Dia selecionado" : "Total no período"}</Text>
          <Text accessibilityLiveRegion="polite" style={ui.body}>{daySummary ?? periodTotals}</Text>
        </View>
        {points.length > 1 && <View style={styles.dayControls}>
          <ActionButton icon="chevron-back-outline" label="Dia anterior" disabled={day === 0} onPress={() => selectDay((day ?? points.length) - 1)} />
          <ActionButton icon="chevron-forward-outline" label="Próximo dia" disabled={day === points.length - 1} onPress={() => selectDay((day ?? -1) + 1)} />
        </View>}
      </>}
    </>}
  </Surface>;
}

const styles = StyleSheet.create({
  filters: { gap: 8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  key: { width: 20, height: 3, borderRadius: 2 },
  dashedKey: { height: 0, borderTopWidth: 2, borderStyle: "dashed", borderRadius: 0 },
  plotRow: { flexDirection: "row", gap: 8 },
  yAxis: { width: 34, height: plotHeight },
  tick: { position: "absolute", right: 0, lineHeight: 16 },
  chart: { minHeight: plotHeight },
  readout: { padding: 12, borderRadius: 12, gap: 2 },
  dayControls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
