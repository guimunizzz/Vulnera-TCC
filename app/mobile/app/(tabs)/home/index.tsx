/**
 * Home — lista de projetos da company do CLIENT logado. GET /projects sem
 * filtro já vem escopado pelo backend (RN16); aqui só lista e navega.
 */

import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../../src/api/projects.api";
import { useApiError } from "../../../src/hooks/use-api-error";
import { ProjectCard } from "../../../src/components/project-card";
import { EmptyState, ErrorState, LoadingState } from "../../../src/components/states";
import { Screen } from "../../../src/components/screen";
import { SPACING } from "../../../src/theme/tokens";

export default function HomeScreen() {
  const router = useRouter();
  const getErrorMessage = useApiError();

  const { data: projects, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Carregando projetos..." />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scroll={false}>
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: SPACING[4], gap: SPACING[3], flexGrow: 1 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <ProjectCard project={item} onPress={() => router.push(`/(tabs)/home/project/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nenhum projeto ainda"
            subtitle="Assim que uma análise de segurança for aberta para a sua empresa, ela aparece aqui."
          />
        }
      />
    </Screen>
  );
}
