/** Área de segurança com exposição e Threat Intel; consumida pelas abas autenticadas. */
import { useState } from "react";
import { View } from "react-native";
import ExposureScreen from "./home/exposure";
import { ThreatIntelScreen } from "../../src/components/threat-intel-screen";
import { FilterChip } from "../../src/components/workspace-ui";

export default function SecurityScreen() {
  const [section, setSection] = useState<"exposure" | "intel">("exposure");
  const navigation = <View style={{ flexDirection: "row", gap: 8 }}><FilterChip tab label="Exposição" selected={section === "exposure"} onPress={() => setSection("exposure")} /><FilterChip tab label="Threat Intel" selected={section === "intel"} onPress={() => setSection("intel")} /></View>;
  return section === "exposure" ? <ExposureScreen root navigation={navigation} /> : <ThreatIntelScreen navigation={navigation} />;
}
