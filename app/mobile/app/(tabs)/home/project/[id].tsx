/**
 * ProjectDetail — metadados do projeto + lista de findings. Sem filtro (o
 * web tem filtro de severidade/status/OWASP; o mobile não — RN "não faça
 * paridade com o web", a lista tende a ser curta o bastante pra rolar).
 *
 * FlatList com ListHeaderComponent em vez de ScrollView+FlatList aninhados
 * (RN não recomenda VirtualizedList dentro de ScrollView — perde a
 * virtualização e ainda solta warning no console).
 */

import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../../../src/api/projects.api";
import { vulnerabilitiesApi } from "../../../../src/api/vulnerabilities.api";
import { useApiError } from "../../../../src/hooks/use-api-error";
import { StatusBadge } from "../../../../src/components/badge";
import { Card } from "../../../../src/components/card";
import { FindingRow } from "../../../../src/components/finding-row";
import { EmptyState, ErrorState, LoadingState } from "../../../../src/components/states";
import { Screen } from "../../../../src/components/screen";
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from "../../../../src/theme/tokens";

const ANALYSIS_LEVEL_LABELS: Record<string, string> = {
  BASIC: "Básico",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const getErrorMessage = useApiError();

  const projectQuery = useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const findingsQuery = useQuery({
    queryKey: ["vulnerabilities", "byProject", id],
    queryFn: () => vulnerabilitiesApi.listByProject(id!),
    enabled: !!id,
  });

  if (projectQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Carregando projeto..." />
      </Screen>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <Screen scroll={false}>
        <ErrorState message={getErrorMessage(projectQuery.error)} onRetry={projectQuery.refetch} />
      </Screen>
    );
  }

  const project = projectQuery.data;
  const criticalOpen = (findingsQuery.data ?? []).filter(
    (f) => f.severityFinal === "CRITICAL" && f.status !== "CLOSED",
  ).length;

  return (
    <Screen scroll={false}>
      <FlatList
        data={findingsQuery.data ?? []}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        refreshing={findingsQuery.isRefetching}
        onRefresh={findingsQuery.refetch}
        renderItem={({ item }) => (
          <FindingRow finding={item} onPress={() => router.push(`/(tabs)/home/finding/${item.id}`)} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{project.name}</Text>
                <StatusBadge status={project.status} />
              </View>
              <Text style={styles.meta}>
                {project.analysisType} · {ANALYSIS_LEVEL_LABELS[project.analysisLevel] ?? project.analysisLevel}
              </Text>
              {criticalOpen > 0 && (
                <View style={styles.criticalPill}>
                  <Text style={styles.criticalText}>
                    {criticalOpen} crítico{criticalOpen > 1 ? "s" : ""} em aberto
                  </Text>
                </View>
              )}
              {project.description && <Text style={styles.description}>{project.description}</Text>}
              {project.scopeIn && (
                <View style={styles.scopeBlock}>
                  <Text style={styles.scopeLabel}>ESCOPO</Text>
                  <Text style={styles.scopeText}>{project.scopeIn}</Text>
                </View>
              )}
            </Card>
            <Text style={styles.sectionTitle}>Findings</Text>
          </View>
        }
        ListEmptyComponent={
          findingsQuery.isLoading ? (
            <LoadingState label="Carregando findings..." />
          ) : (
            <EmptyState title="Nenhum finding registrado" subtitle="Ainda não há achados nesta análise." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: SPACING[4],
    gap: SPACING[3],
    flexGrow: 1,
  },
  header: {
    gap: SPACING[4],
    marginBottom: SPACING[1],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING[2],
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  meta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  criticalPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.severity.criticalSurface,
    borderRadius: 999,
    paddingHorizontal: SPACING[3],
    paddingVertical: SPACING[1],
  },
  criticalText: {
    color: COLORS.severity.criticalInk,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  scopeBlock: {
    gap: SPACING[1],
  },
  scopeLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentInk,
  },
  scopeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
});
