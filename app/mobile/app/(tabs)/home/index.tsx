/**
 * Home do cliente: portfólio e resumo calculados dos projetos reais da empresa.
 * Facilita acompanhamento e busca sem criar operações de escrita no mobile.
 * Consome projectsApi; navega para detalhes e configurações autenticadas.
 */
import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../../src/api/projects.api";
import { useApiError } from "../../../src/hooks/use-api-error";
import { useTabBarClearance } from "../../../src/hooks/use-tab-bar-clearance";
import { ProjectCard } from "../../../src/components/project-card";
import { DataState, FilterChip, PageHeader, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { WorkspaceSkeleton } from "../../../src/components/workspace-skeleton";
import { FONT_FAMILY } from "../../../src/theme/tokens";
import { useAppTheme } from "../../../src/theme/use-app-theme";
import type { ProjectStatus } from "../../../src/types/project.types";
import { MotionReveal, SoftPressable as Pressable, useWorkspaceReducedMotion } from "../../../src/components/workspace-motion";

const FILTERS: { value: "ALL" | ProjectStatus; label: string }[] = [
  { value: "ALL", label: "Todos" }, { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "PENDING", label: "Pendentes" }, { value: "IN_REVIEW", label: "Em revisão" }, { value: "COMPLETED", label: "Concluídos" },
];

export default function HomeScreen() {
  const { workspace, ui } = useAppTheme();
  const router = useRouter();
  const bottom = useTabBarClearance();
  const errorMessage = useApiError();
  const [filter, setFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const [search, setSearch] = useState("");
  const reduced = useWorkspaceReducedMotion();
  const searchFocus = useSharedValue(0);
  const searchStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(searchFocus.value, [0, 1], [workspace.line, workspace.searchFocusBorder]),
    backgroundColor: interpolateColor(searchFocus.value, [0, 1], [workspace.searchBg, workspace.searchFocusBg]),
  }));
  const query = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  const projects = useMemo(() => query.data ?? [], [query.data]);
  const visible = useMemo(() => projects.filter((project) =>
    (filter === "ALL" || project.status === filter) && project.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))), [projects, filter, search]);
  const header = <View style={styles.header}>
    <PageHeader account />
    <MotionReveal distance={8} style={styles.hero}>
      <Text accessibilityRole="header" style={ui.title}>Seus projetos</Text>
      <Text style={ui.body}>Acompanhe suas análises de segurança.</Text>
    </MotionReveal>
    <MotionReveal delay={80} distance={8} style={styles.portfolio}>
      {query.data && <Text style={ui.muted}>{projects.length} {projects.length === 1 ? "projeto" : "projetos"} no total</Text>}
      <Animated.View style={[styles.search, { borderColor: workspace.line }, searchStyle]}>
        <Ionicons name="search-outline" size={19} color={workspace.muted} />
        <TextInput accessibilityLabel="Buscar projetos pelo nome" placeholder="Buscar um projeto" placeholderTextColor={workspace.muted}
          value={search} onChangeText={setSearch} style={[styles.searchInput, { color: workspace.text }]} returnKeyType="search"
          onFocus={() => { searchFocus.value = withTiming(1, { duration: reduced ? 0 : 180 }); }} onBlur={() => { searchFocus.value = withTiming(0, { duration: reduced ? 0 : 220 }); }} />
        {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearch("")} style={styles.clear}><Ionicons name="close-circle" size={18} color={workspace.muted} /></Pressable>}
      </Animated.View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => <FilterChip key={item.value} label={item.label} selected={filter === item.value} onPress={() => setFilter(item.value)} />)}
      </ScrollView>
    </MotionReveal>
    {query.isError && query.data && <DataState error title="Não foi possível atualizar" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />}
  </View>;

  return <WorkspaceScreen scroll={false}>
    <FlatList keyboardShouldPersistTaps="handled" data={query.data ? visible : []} keyExtractor={(project) => project.id} showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + 16 }]} ListHeaderComponent={header}
      refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
      renderItem={({ item, index }) => <MotionReveal animate={index < 4} delay={Math.min(index, 2) * 30} distance={4}><ProjectCard project={item} onPress={() => router.push(`/(tabs)/home/project/${item.id}`)} /></MotionReveal>}
      ListEmptyComponent={query.isPending ? <WorkspaceSkeleton kind="projects" label="Buscando seus projetos" />
        : query.isError && !query.data ? <DataState error title="Projetos indisponíveis" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
        : <DataState title={search || filter !== "ALL" ? "Nenhum resultado" : "Seu próximo projeto começa aqui"}
          message={search || filter !== "ALL" ? "Experimente outro nome ou selecione Todos." : "Quando uma análise for aberta para sua empresa, você poderá acompanhá-la aqui."} />}
      removeClippedSubviews={false}
    />
  </WorkspaceScreen>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12, flexGrow: 1 }, header: { gap: 20, marginBottom: 4 },
  hero: { gap: 8, paddingVertical: 4 },
  portfolio: { gap: 12 }, search: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4, minHeight: 52, borderRadius: 18, borderWidth: 1 },
  searchInput: { flex: 1, minWidth: 0, padding: 12, fontFamily: FONT_FAMILY.regular, fontSize: 15 },
  clear: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, filters: { gap: 8 },
});
