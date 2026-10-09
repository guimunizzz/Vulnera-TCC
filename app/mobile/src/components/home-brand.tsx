/**
 * Assinatura compacta autenticada, escolhida na opção 4 do comparativo de logos.
 * Preserva a geometria oficial do V do login em uma marca discreta e estática.
 * Consumidores: cabeçalhos da Home e Minha conta; o login mantém sua animação própria.
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { FONT_FAMILY } from "../theme/tokens";
import { WORKSPACE } from "../theme/workspace";

export function HomeBrand() {
  return <View accessible accessibilityRole="image" accessibilityLabel="Vulnera Security" testID="home-brand" style={styles.brand}>
    <Svg width={28} height={28} viewBox="0 0 100 100" fill="none" accessible={false}>
      <Polyline points="10,10 40,45 50,85" stroke={WORKSPACE.lavender} strokeWidth={7} strokeLinecap="square" strokeLinejoin="miter" />
      <Polyline points="90,10 60,45 50,85" stroke={WORKSPACE.lavender} strokeWidth={7} strokeLinecap="square" strokeLinejoin="miter" />
    </Svg>
    <View style={styles.signature} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text accessible={false} style={styles.name}>VULNERA</Text>
      <Text accessible={false} style={styles.subtitle}>SECURITY</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  signature: { gap: 4 },
  name: { fontFamily: FONT_FAMILY.monoBold, fontSize: 15, lineHeight: 20, letterSpacing: 1.8, color: WORKSPACE.text },
  subtitle: { fontFamily: FONT_FAMILY.mono, fontSize: 7, lineHeight: 10, letterSpacing: 3, color: WORKSPACE.muted },
});
