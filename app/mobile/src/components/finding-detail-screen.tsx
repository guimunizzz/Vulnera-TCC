/**
 * Consulta de vulnerabilidade com resumo, evidências e comentários reais.
 * Carrega abas sob demanda, preserva erros de cada recurso e pagina comentários.
 * Consumidores: rotas de detalhe do Painel e de Projetos.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, type Href } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../api/vulnerabilities.api";
import { evidencesApi } from "../api/evidences.api";
import { vulnerabilityCommentsApi } from "../api/vulnerability-comments.api";
import { usersApi } from "../api/users.api";
import { useAuthStore } from "../store/auth.store";
import { useApiError } from "../hooks/use-api-error";
import { SeverityBadge, StatusBadge } from "./badge";
import { EvidenceCarousel } from "./evidence-carousel";
import { ActionButton, DataState, DetailField, FilterChip, Surface, PageHeader, SectionHeading, WorkspaceScreen } from "./workspace-ui";
import { FONT_FAMILY } from "../theme/tokens";
import { getSlaInk, useAppTheme } from "../theme/use-app-theme";
import { OWASP_LABELS, fraseDoSla, VRS_BAND_LABELS } from "../types/vulnerability.types";
import { displayDate } from "../lib/display";
import { CvssRing } from "./cvss-ring";
import { MotionReveal } from "./workspace-motion";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { WorkspaceDisclosure } from "./workspace-disclosure";

export function FindingDetailScreen({ backFallback }: { backFallback: Href }) {
  const { colors, workspace, ui } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<"summary" | "evidence" | "comments">("summary");
  const currentUser = useAuthStore((state) => state.user);
  const errorMessage = useApiError();
  const findingQuery = useQuery({ queryKey: ["vulnerabilities", id], queryFn: ({ signal }) => vulnerabilitiesApi.getById(id!, signal), enabled: !!id });
  const evidenceQuery = useQuery({ queryKey: ["evidences", id], queryFn: ({ signal }) => evidencesApi.list(id!, signal), enabled: !!id && !!findingQuery.data && tab === "evidence" });
  const commentsQuery = useInfiniteQuery({ queryKey: ["comments", id, "paged"], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => vulnerabilityCommentsApi.list(id!, pageParam, 20, signal),
    getNextPageParam: (last) => last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: !!id && !!findingQuery.data && tab === "comments",
  });
  const comments = commentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: ({ signal }) => usersApi.list(signal), enabled: tab === "comments" && comments.some((comment) => comment.authorId !== currentUser?.id) });
  const refresh = () => { void findingQuery.refetch(); if (tab === "evidence") void evidenceQuery.refetch(); if (tab === "comments") void commentsQuery.refetch(); };
  if (!findingQuery.data) return <WorkspaceScreen><PageHeader label="VULNERABILIDADE" back backFallback={backFallback} />
    {findingQuery.isPending ? <WorkspaceSkeleton kind="finding" label="Abrindo vulnerabilidade" /> : <DataState error title="Vulnerabilidade indisponível" message={errorMessage(findingQuery.error)} onRetry={() => { void findingQuery.refetch(); }} />}
  </WorkspaceScreen>;
  const finding = findingQuery.data;
  const score = finding.cvssScore;
  const sla = finding.sla?.state !== "NO_SLA" ? finding.sla : undefined;
  const author = (authorId: string) => authorId === currentUser?.id ? currentUser.name : usersQuery.data?.find((user) => user.id === authorId)?.name ?? "Autor não disponível";
  return <WorkspaceScreen onRefresh={refresh} refreshing={findingQuery.isRefetching || (tab === "evidence" && evidenceQuery.isRefetching) || (tab === "comments" && commentsQuery.isRefetching)}>
    <PageHeader label="VULNERABILIDADE" back backFallback={backFallback} />
    <Surface strong>
      <Text accessibilityRole="header" style={[ui.title, { fontSize: 28, lineHeight: 34 }]}>{finding.title}</Text>
      <View style={[ui.row, styles.findingStats]}><SeverityBadge severidade={finding.severityFinal} /><StatusBadge status={finding.status} /></View>
      {sla && <View style={styles.deadline}>
        <DetailField label="Prazo de remediação" value={fraseDoSla(sla.state, sla.remainingMs)} valueColor={getSlaInk(sla.state, colors)} />
        {sla.dueAt && <Text style={ui.muted}>{displayDate(sla.dueAt, true)}</Text>}
      </View>}
      <Text style={ui.muted}>{OWASP_LABELS[finding.owaspCategory] ?? finding.owaspCategory}</Text>
    </Surface>
    {findingQuery.isError && <DataState error title="Não foi possível atualizar" message={errorMessage(findingQuery.error)} onRetry={() => { void findingQuery.refetch(); }} />}
    <MotionReveal delay={80} distance={8} style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}>
      <FilterChip tab label="Resumo" selected={tab === "summary"} onPress={() => setTab("summary")} />
      <FilterChip tab label="Evidências" selected={tab === "evidence"} onPress={() => setTab("evidence")} />
      <FilterChip tab label="Comentários" selected={tab === "comments"} onPress={() => setTab("comments")} />
    </MotionReveal>
    <MotionReveal key={tab} distance={0} style={{ gap: 20 }}>
    {tab === "summary" && <>
      <Surface style={styles.scoreCard}>
        <CvssRing score={score} severity={finding.severityCalculated} /><View style={[ui.grow, { gap: 8 }]}><Text style={ui.eyebrow}>SEVERIDADE TÉCNICA</Text><Text style={ui.muted}>Registrada em {displayDate(finding.createdAt)}</Text></View>
      </Surface>
      <WorkspaceDisclosure title="DESCRIÇÃO"><Text style={ui.body}>{finding.description}</Text></WorkspaceDisclosure>
      {finding.impact && <WorkspaceDisclosure title="IMPACTO"><Text style={ui.body}>{finding.impact}</Text></WorkspaceDisclosure>}
      {finding.recommendation && <WorkspaceDisclosure title="RECOMENDAÇÃO"><Text style={ui.body}>{finding.recommendation}</Text></WorkspaceDisclosure>}
      {finding.severityOverrideReason && <WorkspaceDisclosure title="JUSTIFICATIVA DA SEVERIDADE AJUSTADA"><Text style={ui.body}>{finding.severityOverrideReason}</Text></WorkspaceDisclosure>}
      {finding.vrs?.score != null && <Surface><DetailField label="PRIORIDADE CONTEXTUAL / VRS" value={`${finding.vrs.score}/100${finding.vrs.band ? ` · ${VRS_BAND_LABELS[finding.vrs.band]}` : ""}`} /></Surface>}
      {finding.cvssVector && <WorkspaceDisclosure title="VETOR CVSS" initiallyExpanded={false}><Text style={ui.body}>{finding.cvssVector}</Text></WorkspaceDisclosure>}
      <Text style={ui.muted}>Atualizada em {displayDate(finding.updatedAt, true)}</Text>
    </>}
    {tab === "evidence" && <>
      <SectionHeading title="Evidências" meta={evidenceQuery.data ? `${evidenceQuery.data.length} arquivo(s)` : undefined} />
      {evidenceQuery.isPending ? <WorkspaceSkeleton kind="evidence" label="Carregando evidências" /> : evidenceQuery.isError ? <DataState error title="Evidências indisponíveis" message={errorMessage(evidenceQuery.error)} onRetry={() => { void evidenceQuery.refetch(); }} />
        : <MotionReveal distance={0}>{evidenceQuery.data?.length ? <EvidenceCarousel vulnerabilityId={id!} evidences={evidenceQuery.data} /> : <DataState title="Nenhuma evidência anexada" message="Os arquivos enviados pela equipe aparecerão aqui." />}</MotionReveal>}
    </>}
    {tab === "comments" && <>
      <SectionHeading title="Comentários" meta={commentsQuery.data ? `${commentsQuery.data.pages[0].total} no total` : undefined} />
      {commentsQuery.isPending && <WorkspaceSkeleton kind="comments" label="Carregando comentários" />}
      {commentsQuery.isError && <DataState error title="Comentários indisponíveis" message={errorMessage(commentsQuery.error)} onRetry={() => { if (commentsQuery.isFetchNextPageError) void commentsQuery.fetchNextPage(); else void commentsQuery.refetch(); }} />}
      {usersQuery.isError && <Text style={ui.muted}>Alguns nomes não estão disponíveis. O conteúdo dos comentários permanece abaixo.</Text>}
      {!commentsQuery.isPending && !commentsQuery.isError && !comments.length && <DataState title="A conversa ainda não começou" message="Os comentários registrados no web aparecerão aqui para consulta." />}
      {comments.map((comment, index) => <MotionReveal key={comment.id} animate={index < 3} distance={4} delay={Math.min(index, 2) * 30}><Surface style={{ gap: 14 }}><View style={ui.row}>
        <View style={[styles.authorAvatar, { backgroundColor: workspace.neutralTint }]}><Text style={[styles.authorInitial, { color: workspace.secondary }]}>{comment.authorId === currentUser?.id || usersQuery.data?.some((user) => user.id === comment.authorId) ? author(comment.authorId).charAt(0).toUpperCase() : "?"}</Text></View>
        <View style={ui.grow}><Text style={[styles.authorName, { color: workspace.text }]}>{author(comment.authorId)}</Text><Text style={ui.muted}>{displayDate(comment.createdAt, true)}</Text></View>
      </View><WorkspaceDisclosure title="Texto do comentário" surface={false}><Text style={ui.body}>{comment.content}</Text></WorkspaceDisclosure></Surface></MotionReveal>)}
      {commentsQuery.hasNextPage && !commentsQuery.isFetchNextPageError && <ActionButton icon="add-outline" label={commentsQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais comentários"} disabled={commentsQuery.isFetching} onPress={() => { void commentsQuery.fetchNextPage(); }} />}
    </>}
    </MotionReveal>
  </WorkspaceScreen>;
}
const styles = StyleSheet.create({
  findingStats: { flexWrap: "wrap", gap: 8 },
  deadline: { gap: 4 },
  scoreCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  authorAvatar: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" }, authorInitial: { fontFamily: FONT_FAMILY.semibold },
  authorName: { fontFamily: FONT_FAMILY.medium, fontSize: 14 },
});
