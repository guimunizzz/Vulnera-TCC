/**
 * Home do cliente: portfólio e resumo calculados dos projetos reais da empresa.
 * Facilita acompanhamento e busca sem criar operações de escrita no mobile.
 * Consome projectsApi; navega para detalhes e configurações autenticadas.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../../../src/api/projects.api";
import { useApiError } from "../../../src/hooks/use-api-error";
import { useAuthStore } from "../../../src/store/auth.store";
import { useTabBarClearance } from "../../../src/hooks/use-tab-bar-clearance";
import { ProjectCard } from "../../../src/components/project-card";
import { DataState, FilterChip, GlassSurface, PageHeader, SectionHeading, WorkspaceScreen } from "../../../src/components/workspace-ui";
import { FONT_FAMILY } from "../../../src/theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../../../src/theme/workspace";
import type { ProjectStatus } from "../../../src/types/project.types";
import { MotionReveal, SoftPressable as Pressable, useWorkspaceReducedMotion, useWorkspaceScroll } from "../../../src/components/workspace-motion";

const FILTERS: { value: "ALL" | ProjectStatus; label: string }[] = [
  { value: "ALL", label: "Todos" }, { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "PENDING", label: "Pendentes" }, { value: "IN_REVIEW", label: "Em revisão" }, { value: "COMPLETED", label: "Concluídos" },
];

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const bottom = useTabBarClearance();
  const errorMessage = useApiError();
  const [filter, setFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const [search, setSearch] = useState("");
  const scroll = useWorkspaceScroll();
  const reduced = useWorkspaceReducedMotion();
  const searchFocus = useSharedValue(0);
  const searchStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(searchFocus.value, [0, 1], [WORKSPACE.line, "rgba(167,139,250,0.5)"]), backgroundColor: interpolateColor(searchFocus.value, [0, 1], ["rgba(255,255,255,0.025)", "rgba(124,58,237,0.065)"]) }));
  const query = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => projectsApi.list(signal) });
  const projects = useMemo(() => query.data ?? [], [query.data]);
  const visible = useMemo(() => projects.filter((project) =>
    (filter === "ALL" || project.status === filter) && project.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))), [projects, filter, search]);
  const underway = projects.filter((project) => project.status === "IN_PROGRESS" || project.status === "IN_REVIEW").length;
  const completed = projects.filter((project) => project.status === "COMPLETED").length;
  const header = <View style={styles.header}>
    <PageHeader label="VULNERA">
      <Pressable onPress={() => router.push("/(tabs)/settings")} accessibilityRole="button" accessibilityLabel="Abrir minha conta" style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text>
      </Pressable>
    </PageHeader>
    <View style={styles.hero}>
      <Text accessibilityRole="header" style={ui.title}>Olá, {user?.name?.split(" ")[0] ?? "cliente"}<Text style={{ color: WORKSPACE.lavender }}>.</Text></Text>
      <Text style={ui.body}>Acompanhe suas análises de segurança.</Text>
    </View>
    {!query.isPending && query.data && <MotionReveal delay={60}><GlassSurface style={styles.metrics}>
      <View style={styles.metric}><View style={ui.row}><Ionicons name="scan-outline" size={20} color={WORKSPACE.lavender} /><Text style={styles.metricNumber}>{underway}</Text></View><Text style={ui.muted}>Em análise ou revisão</Text></View>
      <View style={styles.metricDivider} />
      <View style={styles.metric}><View style={ui.row}><Ionicons name="checkmark-done-outline" size={20} color="#8bddb0" /><Text style={styles.metricNumber}>{completed}</Text></View><Text style={ui.muted}>Projetos concluídos</Text></View>
    </GlassSurface></MotionReveal>}
    <View style={styles.portfolio}>
      <SectionHeading title="Seus projetos" meta={query.data ? `${projects.length} no total` : undefined} />
      <Animated.View style={[styles.search, searchStyle]}>
        <Ionicons name="search-outline" size={19} color={WORKSPACE.muted} />
        <TextInput accessibilityLabel="Buscar projetos pelo nome" placeholder="Buscar um projeto" placeholderTextColor={WORKSPACE.muted}
          value={search} onChangeText={setSearch} style={styles.searchInput} returnKeyType="search"
          onFocus={() => { searchFocus.value = withTiming(1, { duration: reduced ? 0 : 180 }); }} onBlur={() => { searchFocus.value = withTiming(0, { duration: reduced ? 0 : 220 }); }} />
        {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setSearch("")} style={styles.clear}><Ionicons name="close-circle" size={18} color={WORKSPACE.muted} /></Pressable>}
      </Animated.View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => <FilterChip key={item.value} label={item.label} selected={filter === item.value} onPress={() => setFilter(item.value)} />)}
      </ScrollView>
    </View>
    {query.isError && query.data && <DataState error title="Não foi possível atualizar" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />}
  </View>;

  return <WorkspaceScreen scroll={false} scrollY={scroll.scrollY}>
    <Animated.FlatList onScroll={scroll.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" data={query.data ? visible : []} keyExtractor={(project) => project.id} showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + 16 }]} ListHeaderComponent={header}
      refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
      renderItem={({ item, index }) => <MotionReveal delay={Math.min(index, 3) * 40}><ProjectCard project={item} onPress={() => router.push(`/(tabs)/home/project/${item.id}`)} /></MotionReveal>}
      ListEmptyComponent={query.isPending ? <DataState loading title="Buscando seus projetos" message="Carregando as análises da sua empresa." />
        : query.isError && !query.data ? <DataState error title="Projetos indisponíveis" message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
        : <DataState title={search || filter !== "ALL" ? "Nenhum resultado" : "Seu próximo projeto começa aqui"}
          message={search || filter !== "ALL" ? "Experimente outro nome ou selecione Todos." : "Quando uma análise for aberta para sua empresa, você poderá acompanhá-la aqui."} />}
    />
  </WorkspaceScreen>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12, flexGrow: 1 }, header: { gap: 20, marginBottom: 4 },
  avatar: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,58,237,0.12)", borderWidth: 1, borderColor: WORKSPACE.line },
  avatarText: { fontFamily: FONT_FAMILY.semibold, fontSize: 16, color: WORKSPACE.lavender },
  hero: { gap: 8, paddingVertical: 4 },
  metrics: { flexDirection: "row", gap: 16, padding: 16 }, metric: { flex: 1, gap: 6 }, metricDivider: { width: 1, backgroundColor: WORKSPACE.line },
  metricNumber: { fontFamily: FONT_FAMILY.medium, fontSize: 26, lineHeight: 32, color: WORKSPACE.text },
  portfolio: { gap: 12 }, search: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 4, minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: WORKSPACE.line },
  searchInput: { flex: 1, minWidth: 0, padding: 12, color: WORKSPACE.text, fontFamily: FONT_FAMILY.regular, fontSize: 15 },
  clear: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, filters: { gap: 8 },
});
