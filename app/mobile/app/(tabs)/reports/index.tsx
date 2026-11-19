/** Lista projetos para consulta dos relatórios executivos; consumida pela aba Relatórios. */
import { Text, View, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { projectsApi } from "../../../src/api/projects.api";
import { StatusBadge } from "../../../src/components/badge";
import { DataState, GlassSurface, PageHeader, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { SoftPressable } from "../../../src/components/workspace-motion";
import { useApiError } from "../../../src/hooks/use-api-error";
import { isReportReady } from "../../../src/lib/executive-report";
import { useAuthStore } from "../../../src/store/auth.store";
import { FONT_FAMILY } from "../../../src/theme/tokens";
import { useAppTheme } from "../../../src/theme/use-app-theme";

export default function ReportsScreen() {
  const { workspace, ui } = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const errorMessage = useApiError();
  const projects = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  return <WorkspaceScreen refreshing={projects.isRefetching} onRefresh={() => { void projects.refetch(); }}>
    <PageHeader label="RELATÓRIOS"><SoftPressable accessibilityRole="button" accessibilityLabel="Abrir minha conta" onPress={() => router.push("/(tabs)/settings")} style={[styles.avatar, { borderColor: workspace.line, backgroundColor: workspace.neutralTint }]}><Text style={[styles.avatarText, { color: workspace.secondary }]}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text></SoftPressable></PageHeader>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.title}>Relatórios executivos</Text><Text style={ui.body}>Escolha um projeto para consultar seu relatório e histórico.</Text></View>
    {projects.isPending ? <DataState loading title="Carregando projetos" /> : projects.isError && !projects.data ? <DataState error title="Projetos indisponíveis" message={errorMessage(projects.error)} onRetry={() => { void projects.refetch(); }} /> : !projects.data?.length ? <DataState title="Nenhum projeto" message="Os relatórios aparecerão quando houver projetos para sua empresa." /> : projects.data.map((project) => <GlassSurface key={project.id} onPress={() => router.push(`/(tabs)/reports/${project.id}`)} accessibilityLabel={`${project.name}, ${isReportReady(project.status) ? "relatório disponível" : "relatório ainda indisponível"}`}>
      <View style={ui.spread}><Text style={[ui.heading, ui.grow]}>{project.name}</Text><StatusBadge status={project.status} /></View><Text style={ui.muted}>{isReportReady(project.status) ? "Relatório executivo disponível" : "Disponível em revisão ou concluído"}</Text>
    </GlassSurface>)}
  </WorkspaceScreen>;
}

const styles = StyleSheet.create({ avatar: { width: 48, height: 48, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" }, avatarText: { fontFamily: FONT_FAMILY.semibold, fontSize: 16 } });
