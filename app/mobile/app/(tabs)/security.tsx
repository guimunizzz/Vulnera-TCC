/** Área de segurança com exposição e Threat Intel; consumida pelas abas autenticadas. */
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import ExposureScreen from "./home/exposure";
import { ThreatIntelScreen } from "../../src/components/threat-intel-screen";
import { FilterChip } from "../../src/components/workspace-ui";

export default function SecurityScreen() {
  const { section: requested } = useLocalSearchParams<{ section?: string }>();
  const router = useRouter();
  const section = requested === "intel" ? "intel" : "exposure";
  const navigation = <View style={{ flexDirection: "row", gap: 8 }}><FilterChip tab label="Exposição" selected={section === "exposure"} onPress={() => router.setParams({ section: "exposure" })} /><FilterChip tab label="Threat Intel" selected={section === "intel"} onPress={() => router.setParams({ section: "intel" })} /></View>;
  return section === "exposure" ? <ExposureScreen root navigation={navigation} /> : <ThreatIntelScreen navigation={navigation} />;
}
