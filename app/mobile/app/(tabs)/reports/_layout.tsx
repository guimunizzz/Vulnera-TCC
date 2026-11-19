/** Stack dos relatórios executivos; mantém lista e detalhe na mesma aba do cliente. */
import { Stack } from "expo-router";
import { useAppTheme } from "../../../src/theme/use-app-theme";
import { useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";

export default function ReportsLayout() {
  const { workspace } = useAppTheme();
  const reduced = useWorkspaceReducedMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: workspace.background }, animation: reduced ? "none" : "slide_from_right", animationDuration: reduced ? 0 : 300 }}><Stack.Screen name="index" /><Stack.Screen name="[projectId]" /></Stack>;
}
