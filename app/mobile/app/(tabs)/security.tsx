/** Área de segurança com exposição e Threat Intel; consumida pelas abas autenticadas. */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import ExposureScreen from "./home/exposure";
import { ThreatIntelScreen } from "../../src/components/threat-intel-screen";
import { FilterChip } from "../../src/components/workspace-ui";

export default function SecurityScreen() {
  const { section: requested } = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<"exposure" | "intel">(requested === "intel" ? "intel" : "exposure");
  useEffect(() => { if (requested === "intel" || requested === "exposure") setSection(requested); }, [requested]);
  const navigation = <View style={{ flexDirection: "row", gap: 8 }}><FilterChip tab label="Exposição" selected={section === "exposure"} onPress={() => setSection("exposure")} /><FilterChip tab label="Threat Intel" selected={section === "intel"} onPress={() => setSection("intel")} /></View>;
  return section === "exposure" ? <ExposureScreen root navigation={navigation} /> : <ThreatIntelScreen navigation={navigation} />;
}
