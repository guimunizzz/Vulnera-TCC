/** Consulta Threat Intel do cliente em Segurança; compartilha dados e permissões com a Web. */
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { threatIntelApi, type ThreatAdvisory } from "../api/threat-intel.api";
import { useApiError } from "../hooks/use-api-error";
import { displayDate } from "../lib/display";
import { useAuthStore } from "../store/auth.store";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { SeverityBadge } from "./badge";
import { DataState, FilterChip, GlassSurface, PageHeader, WorkspaceScreen } from "./workspace-ui";
import { SoftPressable } from "./workspace-motion";

type Section = "matches" | "assets" | "feed";
const triage: Record<string, string> = { NEW: "Novo", CONFIRMED: "Confirmado", FALSE_POSITIVE: "Falso positivo", ACCEPTED: "Aceito", DISMISSED: "Descartado" };
const assetStatus: Record<string, string> = { SUGGESTED: "Sugerido", CONFIRMED: "Confirmado", DISMISSED: "Descartado" };

export function ThreatIntelScreen({ navigation }: { navigation: ReactNode }) {
  const { workspace, ui } = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const errorMessage = useApiError();
  const [section, setSection] = useState<Section>("matches");
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const overview = useQuery({ queryKey: ["threat-intel", "overview"], queryFn: ({ signal }) => threatIntelApi.overview(signal) });
  const matches = useQuery({ queryKey: ["threat-intel", "matches"], queryFn: ({ signal }) => threatIntelApi.matches(signal), enabled: section === "matches" });
  const assets = useQuery({ queryKey: ["threat-intel", "assets"], queryFn: ({ signal }) => threatIntelApi.assets(signal), enabled: section === "assets" });
  const feed = useQuery({ queryKey: ["threat-intel", "feed", 30], queryFn: ({ signal }) => threatIntelApi.feed(signal), enabled: section === "feed" });
  const current = section === "matches" ? matches : section === "assets" ? assets : feed;
  const switchSection = (next: Section) => { setSection(next); setSelected(null); setLimit(20); };
  const refresh = () => { void overview.refetch(); void current.refetch(); };
  return <WorkspaceScreen refreshing={overview.isRefetching || current.isRefetching} onRefresh={refresh}>
    <PageHeader label="SEGURANÇA" assistantContext="threat-intel"><SoftPressable accessibilityRole="button" accessibilityLabel="Abrir minha conta" onPress={() => router.push("/(tabs)/settings")} style={[styles.avatar, { borderColor: workspace.line, backgroundColor: workspace.neutralTint }]}><Text style={[styles.avatarText, { color: workspace.secondary }]}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text></SoftPressable></PageHeader>
    {navigation}
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.title}>Threat Intel</Text><Text style={ui.body}>Ameaças relacionadas às tecnologias acompanhadas pela sua empresa.</Text></View>
    {overview.isPending ? <DataState loading title="Carregando panorama" /> : overview.isError ? <DataState error title="Panorama indisponível" message={errorMessage(overview.error)} onRetry={() => { void overview.refetch(); }} /> : overview.data && <GlassSurface>
      <View style={styles.summary}><View style={ui.grow}><Text style={ui.heading}>{overview.data.casamentos.criticosAbertos}</Text><Text style={ui.muted}>críticas abertas</Text></View><View style={ui.grow}><Text style={ui.heading}>{overview.data.casamentos.kevAbertos}</Text><Text style={ui.muted}>KEV em aberto</Text></View><View style={ui.grow}><Text style={ui.heading}>{overview.data.inventario.confirmados}</Text><Text style={ui.muted}>ativos confirmados</Text></View></View>
      <Text style={ui.muted}>{overview.data.sincronizando ? "Atualização em andamento" : overview.data.ultimaExecucao?.finishedAt ? `Última atualização: ${displayDate(overview.data.ultimaExecucao.finishedAt, true)}` : "Ainda não há atualização registrada."}</Text>
    </GlassSurface>}
    <View style={styles.tabs}><FilterChip tab label="Afeta você" selected={section === "matches"} onPress={() => switchSection("matches")} /><FilterChip tab label="Inventário" selected={section === "assets"} onPress={() => switchSection("assets")} /><FilterChip tab label="Feed" selected={section === "feed"} onPress={() => switchSection("feed")} /></View>
    {current.isPending ? <DataState loading title="Carregando informações" /> : current.isError ? <DataState error title="Informações indisponíveis" message={errorMessage(current.error)} onRetry={() => { void current.refetch(); }} /> : <>
      {section === "matches" && matches.data && (matches.data.length ? matches.data.slice(0, limit).map((item) => <GlassSurface key={item.id} onPress={() => setSelected(selected === item.id ? null : item.id)} accessibilityLabel={`${item.advisory.title ?? item.advisory.aliases[0] ?? "Ameaça"}, ${item.asset.displayName}`}>
        <View style={ui.spread}><View style={ui.grow}><Text style={ui.heading}>{item.advisory.title ?? item.advisory.aliases[0] ?? "Ameaça sem título"}</Text><Text style={ui.muted}>{item.asset.displayName}{item.asset.version ? ` · ${item.asset.version}` : ""}</Text></View><SeverityBadge severidade={item.advisory.severity ?? "NONE"} cvss={item.advisory.cvssScore} /></View>
        <Text style={ui.muted}>{triage[item.triageStatus] ?? item.triageStatus}{item.advisory.kev ? " · Catálogo KEV" : ""}{item.versionConfirmed ? " · Versão confirmada" : " · Versão não confirmada"}</Text>
        {selected === item.id && <AdvisoryDetails advisory={item.advisory} fixedVersion={item.fixedVersion} />}
      </GlassSurface>) : <DataState title="Nenhuma ameaça relacionada" message="As correspondências aparecerão quando houver dados para os ativos da empresa." />)}
      {section === "assets" && assets.data && (assets.data.length ? assets.data.slice(0, limit).map((item) => <GlassSurface key={item.id}><Text style={ui.heading}>{item.displayName}</Text><Text style={ui.body}>{assetStatus[item.status] ?? item.status}{item.version ? ` · Versão ${item.version}` : " · Versão não informada"}</Text><Text style={ui.muted}>{item.casamentos} correspondência(s) · Origem: {item.source}</Text></GlassSurface>) : <DataState title="Nenhum ativo no inventário" message="Ativos cadastrados na Web aparecerão aqui." />)}
      {section === "feed" && feed.data && (feed.data.length ? feed.data.slice(0, limit).map((item) => <GlassSurface key={item.id} onPress={() => setSelected(selected === item.id ? null : item.id)} accessibilityLabel={item.title ?? item.aliases[0] ?? "Aviso de segurança"}>
        <View style={ui.spread}><Text style={[ui.heading, ui.grow]}>{item.title ?? item.aliases[0] ?? "Aviso de segurança"}</Text><SeverityBadge severidade={item.severity ?? "NONE"} cvss={item.cvssScore} /></View><Text style={ui.muted}>{item.afeta ? "Relacionada ao inventário" : "Não relacionada ao inventário"}{item.kev ? " · Catálogo KEV" : ""}</Text>{selected === item.id && <AdvisoryDetails advisory={item} />}
      </GlassSurface>) : <DataState title="Nenhum aviso no período" message="O feed mostra os últimos 30 dias disponíveis." />)}
      {(current.data?.length ?? 0) > limit && <SoftPressable accessibilityRole="button" onPress={() => setLimit((value) => value + 20)} style={[styles.more, { borderColor: workspace.line }]}><Text style={ui.body}>Mostrar mais</Text></SoftPressable>}
    </>}
  </WorkspaceScreen>;
}

function AdvisoryDetails({ advisory, fixedVersion }: { advisory: ThreatAdvisory; fixedVersion?: string | null }) {
  const { ui } = useAppTheme();
  return <View style={{ gap: 8 }}><Text style={ui.body}>{advisory.description || "Descrição não disponível."}</Text><Text style={ui.muted}>{advisory.aliases.join(" · ") || "Identificador não informado"} · Publicação: {displayDate(advisory.publishedAt)}</Text>{fixedVersion && <Text style={ui.muted}>Versão corrigida: {fixedVersion}</Text>}{advisory.epssScore != null && <Text style={ui.muted}>EPSS: {(advisory.epssScore * 100).toFixed(1)}%</Text>}</View>;
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" }, avatarText: { fontFamily: FONT_FAMILY.semibold, fontSize: 16 },
  summary: { flexDirection: "row", gap: 12 }, tabs: { flexDirection: "row", gap: 6 }, more: { minHeight: 48, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
