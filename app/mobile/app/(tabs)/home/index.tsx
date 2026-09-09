/**
 * Home — lista de projetos da company do CLIENT logado. GET /projects sem
 * filtro já vem escopado pelo backend (RN16); aqui só lista e navega.
 *
 * Chips de status filtram só no cliente (a lista inteira já veio da API) —
 * não é uma feature nova de backend, é só uma lente sobre o que já chegou,
 * no mesmo espírito das categorias do Mercado Livre.
 */

import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../../src/api/projects.api";
import { useApiError } from "../../../src/hooks/use-api-error";
import { useAuthStore } from "../../../src/store/auth.store";
import { useTabBarClearance } from "../../../src/hooks/use-tab-bar-clearance";
import { haptics } from "../../../src/lib/haptics";
import { ProjectCard } from "../../../src/components/project-card";
import { ProjectCardSkeleton, SkeletonList } from "../../../src/components/skeleton";
import { EmptyState, ErrorState } from "../../../src/components/states";
import { Screen } from "../../../src/components/screen";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../../../src/theme/tokens";
import type { ProjectStatus } from "../../../src/types/project.types";

type Filtro = "TODOS" | ProjectStatus;

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "PENDING", rotulo: "Pendente" },
  { valor: "IN_PROGRESS", rotulo: "Em andamento" },
  { valor: "IN_REVIEW", rotulo: "Em revisão" },
  { valor: "COMPLETED", rotulo: "Concluído" },
];

export default function HomeScreen() {
  const router = useRouter();
  const getErrorMessage = useApiError();
  const userName = useAuthStore((s) => s.user?.name);
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const listaBottomPadding = useTabBarClearance();

  const { data: projects, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const projetosFiltrados = useMemo(() => {
    if (!projects) return [];
    if (filtro === "TODOS") return projects;
    return projects.filter((p) => p.status === filtro);
  }, [projects, filtro]);

  const primeiroNome = userName?.split(" ")[0];

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>Seus projetos</Text>
        </View>
        <SkeletonList Item={ProjectCardSkeleton} />
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
        data={projetosFiltrados}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingBottom: listaBottomPadding }]}
        refreshing={isRefetching}
        onRefresh={() => {
          haptics.tap();
          refetch();
        }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.greetingWrap}>
              <Text style={styles.greeting}>{primeiroNome ? `Olá, ${primeiroNome}` : "Seus projetos"}</Text>
              <Text style={styles.greetingSubtitle}>
                {projects?.length ?? 0} projeto{(projects?.length ?? 0) === 1 ? "" : "s"} ao todo
              </Text>
            </View>
            <FlatList
              horizontal
              data={FILTROS}
              keyExtractor={(f) => f.valor}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              renderItem={({ item }) => {
                const ativo = item.valor === filtro;
                return (
                  <Pressable
                    onPress={() => {
                      haptics.tap();
                      setFiltro(item.valor);
                    }}
                    style={[styles.chip, ativo && styles.chipBordaAtiva]}
                  >
                    <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[styles.chipTint, ativo && styles.chipTintAtivo]} />
                    <Text style={[styles.chipText, ativo && styles.chipTextAtivo]}>{item.rotulo}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        renderItem={({ item, index }) => (
          <ProjectCard project={item} index={index} onPress={() => router.push(`/(tabs)/home/project/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title={filtro === "TODOS" ? "Nenhum projeto ainda" : "Nenhum projeto nesse status"}
            subtitle={
              filtro === "TODOS"
                ? "Assim que uma análise de segurança for aberta para a sua empresa, ela aparece aqui."
                : "Tenta outro filtro ali em cima."
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: SPACING[4],
    paddingBottom: SPACING[4],
    gap: SPACING[3],
    flexGrow: 1,
  },
  headerBlock: {
    gap: SPACING[3],
    paddingTop: SPACING[2],
    marginBottom: SPACING[1],
  },
  greetingWrap: {
    paddingHorizontal: SPACING[4],
    gap: 2,
  },
  greeting: {
    fontSize: FONT_SIZE.xl,
    fontFamily: FONT_FAMILY.bold,
    color: COLORS.textPrimary,
  },
  greetingSubtitle: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textMuted,
  },
  chipsRow: {
    gap: SPACING[2],
    paddingHorizontal: SPACING[4],
  },
  chip: {
    paddingHorizontal: SPACING[4],
    paddingVertical: SPACING[2],
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    overflow: "hidden",
  },
  // Inativo: tint neutro. Ativo: tint na cor do acento — mesmo espírito do
  // botão "Entrar" do login, vidro com cor de destaque em vez de virar
  // cinza quando selecionado.
  chipTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
    opacity: 0.6,
  },
  chipTintAtivo: {
    backgroundColor: COLORS.accent,
    opacity: 0.7,
  },
  chipBordaAtiva: {
    borderColor: COLORS.accent,
  },
  chipText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.medium,
    color: COLORS.textSecondary,
  },
  chipTextAtivo: {
    color: COLORS.accentFg,
  },
});
