/**
 * Histórico semanal do Painel, com duas linhas e os valores de cada semana abaixo.
 * Mantém a mesma escala nas duas séries e uma leitura textual para acessibilidade.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { weeklyActivity } from "../lib/exposure-trend";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

const wholeNumber = new Intl.NumberFormat("pt-BR");
const compactNumber = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 });
const shortDate = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const plotHeight = 124;
const plotPadding = 9;
const labelWidth = 68;

function chartNumber(value: number) {
  return value < 1000 ? wholeNumber.format(value) : compactNumber.format(value);
}

type Activity = NonNullable<ReturnType<typeof weeklyActivity>>;

export function ExposureTrend({ activity }: { activity: Activity }) {
  const { colors, ui, workspace } = useAppTheme();
  const [width, setWidth] = useState(0);
  const step = Math.ceil(activity.max / 2);
  const scale = step * 2;
  const ticks = [0, step, scale];
  const series = [
    { label: "Novos", key: "criados", total: activity.created, color: colors.chartCreated, outlined: false },
    { label: "Resolvidos", key: "resolvidos", total: activity.resolved, color: colors.chartResolved, outlined: true },
  ] as const;
  const y = (value: number) => plotPadding + (1 - value / scale) * (plotHeight - 2 * plotPadding);
  const lines = series.map((line) => ({
    ...line,
    points: activity.weeks.map((week, index) => ({
      x: (index + 0.5) * width / activity.weeks.length,
      y: y(week[line.key]),
    })),
  }));

  return <>
    <Text style={ui.muted}>
      <Text style={styles.summary}>{wholeNumber.format(activity.created)}</Text>{" novos · "}
      <Text style={styles.summary}>{wholeNumber.format(activity.resolved)}</Text>{" resolvidos no período"}
    </Text>
    <View testID="dashboard-weekly-trend" accessible accessibilityRole="image"
      accessibilityLabel={activity.weeks.map((week) =>
        `Semana de ${shortDate(week.periodo)}, novos: ${week.criados}, resolvidos: ${week.resolvidos}`).join(". ")}
      style={[styles.panel, { backgroundColor: workspace.inset, borderColor: workspace.line }]}>
      <View style={styles.row}>
        <View style={styles.axis}>
          {ticks.map((tick) => <Text key={tick} numberOfLines={1} maxFontSizeMultiplier={1.25}
            style={[styles.tick, { color: workspace.muted, top: y(tick) - 7 }]}>{chartNumber(tick)}</Text>)}
        </View>
        <View style={styles.plot} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 && <Svg width={width} height={plotHeight} accessible={false}>
            {ticks.map((tick) => <Line key={tick} x1={0} x2={width} y1={y(tick)} y2={y(tick)} stroke={workspace.line} strokeWidth={1} />)}
            {lines.map((line) => <Polyline key={line.key}
              points={line.points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none" stroke={line.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray={line.outlined ? "5 4" : undefined} />)}
            {lines.map((line) => line.points.map((point, index) => (
              <Circle key={line.key + activity.weeks[index].periodo} cx={point.x} cy={point.y}
                r={line.outlined ? 5 : 3.5} fill={line.outlined ? "none" : line.color}
                stroke={line.color} strokeWidth={line.outlined ? 2 : 0} />
            )))}
          </Svg>}
        </View>
      </View>
      <View style={[styles.readings, { borderTopColor: workspace.line }]}>
        <View style={styles.row}>
          <View style={styles.label} />
          {activity.weeks.map((week) => <Text key={week.periodo} maxFontSizeMultiplier={1.3}
            style={[ui.mono, styles.cell]}>{shortDate(week.periodo)}</Text>)}
        </View>
        {series.map(({ key, label, color, outlined }) => <View key={key} style={styles.row}>
          <View style={[styles.label, styles.seriesLabel]}>
            <View style={[styles.marker, { borderColor: color, backgroundColor: outlined ? "transparent" : color }]} />
            <Text style={[ui.muted, styles.seriesName]}>{label}</Text>
          </View>
          {activity.weeks.map((week) => (
            <Text key={week.periodo} maxFontSizeMultiplier={1.3}
              style={[styles.value, styles.cell, { color: workspace.text }]}>{chartNumber(week[key])}</Text>
          ))}
        </View>)}
      </View>
    </View>
  </>;
}

const styles = StyleSheet.create({
  summary: { fontFamily: FONT_FAMILY.semibold, fontVariant: ["tabular-nums"] },
  panel: { padding: 12, borderWidth: 1, borderRadius: 16, gap: 6 },
  row: { flexDirection: "row", alignItems: "center" },
  axis: { width: labelWidth, height: plotHeight },
  tick: { position: "absolute", right: 8, width: 44, textAlign: "right", fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] },
  plot: { flex: 1, minWidth: 0, height: plotHeight },
  readings: { gap: 6, borderTopWidth: 1, paddingTop: 9 },
  label: { width: labelWidth },
  seriesLabel: { flexDirection: "row", alignItems: "center", gap: 5 },
  marker: { width: 7, height: 7, borderWidth: 1.25, borderRadius: 4 },
  seriesName: { flexShrink: 1, fontSize: 11, lineHeight: 15 },
  cell: { flex: 1, minWidth: 0, textAlign: "center" },
  value: { fontFamily: FONT_FAMILY.medium, fontSize: 13, lineHeight: 17, fontVariant: ["tabular-nums"] },
});
