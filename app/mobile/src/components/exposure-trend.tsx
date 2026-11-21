/**
 * Gráfico de leitura direta das quatro semanas completas de uma aplicação.
 * Consumidor: Painel, com valores visíveis e sem seleção de datas ou de série.
 */
import { StyleSheet, Text, View } from "react-native";
import type { weeklyActivity } from "../lib/exposure-trend";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";

const wholeNumber = new Intl.NumberFormat("pt-BR");
const compactNumber = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 });
const shortDate = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const columnsHeight = 116;
const axisWidth = 32;

function chartNumber(value: number) {
  return value < 1000 ? wholeNumber.format(value) : compactNumber.format(value);
}

type Activity = NonNullable<ReturnType<typeof weeklyActivity>>;

export function ExposureTrend({ activity }: { activity: Activity }) {
  const { colors, ui, workspace } = useAppTheme();
  const step = Math.ceil(activity.max / 2);
  const scale = step * 2;
  const ticks = [0, step, scale];
  const series = [
    { label: "Novos", key: "criados", total: activity.created, color: colors.chartCreated, outlined: false },
    { label: "Resolvidos", key: "resolvidos", total: activity.resolved, color: colors.chartResolved, outlined: true },
  ] as const;

  return <>
    <View style={styles.legend}>
      {series.map(({ key, label, total, color, outlined }) => (
        <View key={key} style={styles.legendItem}>
          <View style={[styles.swatch, {
            backgroundColor: outlined ? color + "30" : color,
            borderWidth: outlined ? 1.5 : 0,
            borderColor: color,
          }]} />
          <Text style={ui.muted}>
            <Text style={[styles.total, { color: workspace.text }]}>{wholeNumber.format(total)}</Text>{" " + label}
          </Text>
        </View>
      ))}
    </View>
    <View testID="dashboard-weekly-trend"
      accessible accessibilityRole="image"
      accessibilityLabel={activity.weeks.map((week) =>
        "Semana de " + shortDate(week.periodo) + ", novos: " + week.criados + ", resolvidos: " + week.resolvidos).join(". ")}
      style={[styles.plot, { backgroundColor: workspace.inset, borderColor: workspace.line }]}>
      <View style={styles.plotRow}>
        <View style={styles.axis}>
          {ticks.map((tick, index) => <Text key={tick} numberOfLines={1} maxFontSizeMultiplier={1.25}
            style={[styles.tick, { color: workspace.muted, bottom: index * columnsHeight / 2 - 7 }]}>{chartNumber(tick)}</Text>)}
        </View>
        <View style={styles.columns}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {ticks.map((tick, index) => <View key={tick}
              style={[styles.guide, { bottom: index * columnsHeight / 2, backgroundColor: workspace.line }]} />)}
          </View>
          {activity.weeks.map((week) => (
            <View key={week.periodo} style={styles.pair}>
              {series.map(({ key, color, outlined }) => {
                const value = week[key];
                const height = value / scale * columnsHeight;
                return <View key={key} style={styles.column}>
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.25}
                    style={[styles.value, { color: value > 0 ? workspace.text : workspace.muted }]}>{chartNumber(value)}</Text>
                  {value > 0 && <View style={[styles.bar, {
                    height, backgroundColor: outlined ? color + "30" : color, borderColor: color,
                    borderWidth: outlined ? Math.min(1.5, height / 2) : 0,
                  }]} />}
                </View>;
              })}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.dates}>
        {activity.weeks.map((week) =>
          <Text key={week.periodo} maxFontSizeMultiplier={1.4} style={[ui.mono, styles.date]}>{shortDate(week.periodo)}</Text>)}
      </View>
    </View>
  </>;
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  total: { fontFamily: FONT_FAMILY.semibold, fontSize: 18, fontVariant: ["tabular-nums"] },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  plot: { padding: 12, borderWidth: 1, borderRadius: 16 },
  plotRow: { flexDirection: "row", height: columnsHeight + 22 },
  axis: { width: axisWidth },
  tick: { position: "absolute", right: 7, width: axisWidth - 7, textAlign: "right", fontSize: 11, lineHeight: 14, fontVariant: ["tabular-nums"] },
  columns: { flex: 1, flexDirection: "row" },
  guide: { position: "absolute", left: 0, right: 0, height: 1 },
  pair: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  column: { flex: 1, maxWidth: 37, minWidth: 0, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  value: { fontFamily: FONT_FAMILY.medium, fontSize: 12, lineHeight: 16, fontVariant: ["tabular-nums"] },
  bar: { width: "68%", maxWidth: 23, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dates: { flexDirection: "row", marginTop: 9, marginLeft: axisWidth },
  date: { flex: 1, textAlign: "center" },
});
