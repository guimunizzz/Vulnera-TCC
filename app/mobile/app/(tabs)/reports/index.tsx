/** Lista projetos para consulta dos relatórios executivos; consumida pela aba Relatórios. */
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { projectsApi } from "../../../src/api/projects.api";
import { StatusBadge } from "../../../src/components/badge";
import { DataState, Surface, PageHeader, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { useApiError } from "../../../src/hooks/use-api-error";
import { isReportReady } from "../../../src/lib/executive-report";
import { useAppTheme } from "../../../src/theme/use-app-theme";

export default function ReportsScreen() {
  const { ui } = useAppTheme();
  const router = useRouter();
  const errorMessage = useApiError();
  const projects = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  return <WorkspaceScreen refreshing={projects.isRefetching} onRefresh={() => { void projects.refetch(); }}>
    <PageHeader account />
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.title}>Relatórios executivos</Text><Text style={ui.body}>Escolha um projeto para consultar seu relatório e histórico.</Text></View>
    {projects.isPending ? <DataState loading title="Carregando projetos" /> : projects.isError && !projects.data ? <DataState error title="Projetos indisponíveis" message={errorMessage(projects.error)} onRetry={() => { void projects.refetch(); }} /> : !projects.data?.length ? <DataState title="Nenhum projeto" message="Os relatórios aparecerão quando houver projetos para sua empresa." /> : projects.data.map((project) => <Surface key={project.id} onPress={() => router.push(`/(tabs)/reports/${project.id}`)} accessibilityLabel={`${project.name}, ${isReportReady(project.status) ? "relatório disponível" : "relatório ainda indisponível"}`}>
      <View style={ui.spread}><Text style={[ui.heading, ui.grow]}>{project.name}</Text><StatusBadge status={project.status} /></View><Text style={ui.muted}>{isReportReady(project.status) ? "Relatório executivo disponível" : "Disponível em revisão ou concluído"}</Text>
    </Surface>)}
  </WorkspaceScreen>;
}
