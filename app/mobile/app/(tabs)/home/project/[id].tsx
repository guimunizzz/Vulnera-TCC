/**
 * ProjectDetail — metadados do projeto + lista de findings. Sem filtro (o
 * web tem filtro de severidade/status/OWASP; o mobile não — RN "não faça
 * paridade com o web", a lista tende a ser curta o bastante pra rolar).
 *
 * FlatList com ListHeaderComponent em vez de ScrollView+FlatList aninhados
 * (RN não recomenda VirtualizedList dentro de ScrollView — perde a
 * virtualização e ainda solta warning no console).
 */

import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { projectsApi } from "../../../../src/api/projects.api";
import { vulnerabilitiesApi } from "../../../../src/api/vulnerabilities.api";
import { useApiError } from "../../../../src/hooks/use-api-error";
import { useTabBarClearance } from "../../../../src/hooks/use-tab-bar-clearance";
import { haptics } from "../../../../src/lib/haptics";
import { StatusBadge } from "../../../../src/components/badge";
import { Card } from "../../../../src/components/card";
import { FindingRow } from "../../../../src/components/finding-row";
import { FindingRowSkeleton, SkeletonList } from "../../../../src/components/skeleton";
import { EmptyState, ErrorState, LoadingState } from "../../../../src/components/states";
import { Screen } from "../../../../src/components/screen";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../../../../src/theme/tokens";
import type { Vulnerability } from "../../../../src/types/vulnerability.types";

const ANALYSIS_LEVEL_LABELS: Record<string, string> = {
  BASIC: "Básico",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};

const SEVERITY_TILES: { chave: Vulnerability["severityFinal"]; rotulo: string; cor: string; fundo: string }[] = [
  { chave: "CRITICAL", rotulo: "Crítico", cor: COLORS.severity.critical, fundo: COLORS.severity.criticalSurface },
  { chave: "HIGH", rotulo: "Alto", cor: COLORS.severity.high, fundo: COLORS.severity.highSurface },
  { chave: "MEDIUM", rotulo: "Médio", cor: COLORS.severity.medium, fundo: COLORS.severity.mediumSurface },
  { chave: "LOW", rotulo: "Baixo", cor: COLORS.severity.low, fundo: COLORS.severity.lowSurface },
];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const getErrorMessage = useApiError();
  const bottomClearance = useTabBarClearance();

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

  const contagemPorSeveridade = useMemo(() => {
    const contagem: Record<string, number> = {};
    for (const f of findingsQuery.data ?? []) {
      contagem[f.severityFinal] = (contagem[f.severityFinal] ?? 0) + 1;
    }
    return contagem;
  }, [findingsQuery.data]);

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

  return (
    <Screen scroll={false}>
      <FlatList
        data={findingsQuery.data ?? []}
        keyExtractor={(f) => f.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomClearance }]}
        refreshing={findingsQuery.isRefetching}
        onRefresh={() => {
          haptics.tap();
          // Também reconsulta o projeto — puxar pra atualizar só a lista de
          // findings deixava nome/status/descrição do hero desatualizados
          // se o projeto mudasse de status com a tela já aberta.
          projectQuery.refetch();
          findingsQuery.refetch();
        }}
        renderItem={({ item, index }) => (
          <FindingRow finding={item} index={index} onPress={() => router.push(`/(tabs)/home/finding/${item.id}`)} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Animated.View entering={FadeInDown.duration(360)}>
              <Card style={styles.hero}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{project.name}</Text>
                  <StatusBadge status={project.status} />
                </View>
                <Text style={styles.meta}>
                  {project.analysisType} · {ANALYSIS_LEVEL_LABELS[project.analysisLevel] ?? project.analysisLevel}
                </Text>
              </Card>
            </Animated.View>

            <View style={styles.tilesRow}>
              {SEVERITY_TILES.map((tile) => (
                <View key={tile.chave} style={[styles.tile, { backgroundColor: tile.fundo }]}>
                  <Text style={[styles.tileCount, { color: tile.cor }]}>{contagemPorSeveridade[tile.chave] ?? 0}</Text>
                  <Text style={[styles.tileLabel, { color: tile.cor }]}>{tile.rotulo}</Text>
                </View>
              ))}
            </View>

            {(project.description || project.scopeIn) && (
              <Card style={styles.infoCard}>
                {project.description && <Text style={styles.description}>{project.description}</Text>}
                {project.scopeIn && (
                  <View style={styles.scopeBlock}>
                    <Text style={styles.scopeLabel}>ESCOPO</Text>
                    <Text style={styles.scopeText}>{project.scopeIn}</Text>
                  </View>
                )}
              </Card>
            )}

            <Text style={styles.sectionTitle}>Findings</Text>
            {findingsQuery.isLoading && <SkeletonList count={3} Item={FindingRowSkeleton} />}
          </View>
        }
        ListEmptyComponent={
          findingsQuery.isLoading ? null : (
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
  // Card já dá vidro fosco + sombra — aqui só a faixa de acento à esquerda
  // (detalhe de destaque, não o card inteiro pintado).
  hero: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
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
    fontFamily: FONT_FAMILY.bold,
    color: COLORS.textPrimary,
  },
  meta: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.medium,
    color: COLORS.textSecondary,
  },
  tilesRow: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  tile: {
    flex: 1,
    borderRadius: RADIUS.container,
    paddingVertical: SPACING[3],
    alignItems: "center",
    gap: 2,
  },
  tileCount: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONT_FAMILY.bold,
  },
  tileLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.medium,
  },
  infoCard: {
    gap: SPACING[3],
  },
  description: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textSecondary,
  },
  scopeBlock: {
    gap: SPACING[1],
  },
  scopeLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.accentInk,
  },
  scopeText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.textPrimary,
  },
});
