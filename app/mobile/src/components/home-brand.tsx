/**
 * Assinatura compacta autenticada, escolhida na opção 4 do comparativo de logos.
 * Preserva a geometria oficial do V do login nos temas escuro e claro.
 * Consumidores: cabeçalhos da Home, Relatórios e Minha conta.
 */
import { StyleSheet, Text, View } from "react-native";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { VulneraMark } from "./vulnera-mark";

export function HomeBrand() {
  const { workspace } = useAppTheme();
  return <View accessible accessibilityRole="image" accessibilityLabel="Vulnera Security" testID="home-brand" style={styles.brand}>
    <VulneraMark size={28} animate={false} />
    <View style={styles.signature} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text accessible={false} style={[styles.name, { color: workspace.text }]}>VULNERA</Text>
      <Text accessible={false} style={[styles.subtitle, { color: workspace.muted }]}>SECURITY</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  signature: { gap: 4 },
  name: { fontFamily: FONT_FAMILY.monoBold, fontSize: 15, lineHeight: 20, letterSpacing: 1.8 },
  subtitle: { fontFamily: FONT_FAMILY.mono, fontSize: 7, lineHeight: 10, letterSpacing: 3 },
});
