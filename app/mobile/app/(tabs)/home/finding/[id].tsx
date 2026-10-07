/**
 * Consulta de vulnerabilidade com resumo, evidências e comentários reais.
 * Carrega abas sob demanda, preserva erros de cada recurso e pagina comentários.
 * Consumidor: cliente autenticado; todas as ações de edição ficam no web.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../../../../src/api/vulnerabilities.api";
import { evidencesApi } from "../../../../src/api/evidences.api";
import { vulnerabilityCommentsApi } from "../../../../src/api/vulnerability-comments.api";
import { usersApi } from "../../../../src/api/users.api";
import { useAuthStore } from "../../../../src/store/auth.store";
import { useApiError } from "../../../../src/hooks/use-api-error";
import { SeverityBadge, StatusBadge } from "../../../../src/components/badge";
import { EvidenceCarousel } from "../../../../src/components/evidence-carousel";
import { ActionButton, DataState, DetailField, FilterChip, GlassSurface, PageHeader, SectionHeading, WorkspaceScreen } from "../../../../src/components/workspace-ui";
import { FONT_FAMILY } from "../../../../src/theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../../../../src/theme/workspace";
import { OWASP_LABELS, fraseDoSla, VRS_BAND_LABELS } from "../../../../src/types/vulnerability.types";
import { displayDate } from "../../../../src/lib/display";
import { CvssRing } from "../../../../src/components/cvss-ring";
import { MotionReveal } from "../../../../src/components/workspace-motion";

export default function FindingDetailScreen() {
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
  if (!findingQuery.data) return <WorkspaceScreen><PageHeader label="VULNERABILIDADE" back />
    {findingQuery.isPending ? <DataState loading title="Abrindo vulnerabilidade" /> : <DataState error title="Vulnerabilidade indisponível" message={errorMessage(findingQuery.error)} onRetry={() => { void findingQuery.refetch(); }} />}
  </WorkspaceScreen>;
  const finding = findingQuery.data;
  const score = finding.cvssScore;
  const author = (authorId: string) => authorId === currentUser?.id ? currentUser.name : usersQuery.data?.find((user) => user.id === authorId)?.name ?? "Autor não disponível";
  return <WorkspaceScreen onRefresh={refresh} refreshing={findingQuery.isRefetching || (tab === "evidence" && evidenceQuery.isRefetching) || (tab === "comments" && commentsQuery.isRefetching)}>
    <PageHeader label="VULNERABILIDADE" back />
    <View style={{ gap: 14 }}><View style={[ui.row, { flexWrap: "wrap" }]}><SeverityBadge severidade={finding.severityFinal} /><StatusBadge status={finding.status} /></View>
      <Text accessibilityRole="header" style={[ui.title, { fontSize: 28, lineHeight: 34 }]}>{finding.title}</Text>
      <Text style={ui.muted}>{OWASP_LABELS[finding.owaspCategory] ?? finding.owaspCategory}</Text></View>
    {findingQuery.isError && <DataState error title="Não foi possível atualizar" message={errorMessage(findingQuery.error)} onRetry={() => { void findingQuery.refetch(); }} />}
    <GlassSurface style={styles.scoreCard}>
      <CvssRing score={score} /><View style={[ui.grow, { gap: 8 }]}><Text style={ui.eyebrow}>SEVERIDADE TÉCNICA</Text><Text style={ui.muted}>Registrada em {displayDate(finding.createdAt)}</Text></View>
    </GlassSurface>
    <View style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}>
      <FilterChip tab label="Resumo" selected={tab === "summary"} onPress={() => setTab("summary")} />
      <FilterChip tab label="Evidências" selected={tab === "evidence"} onPress={() => setTab("evidence")} />
      <FilterChip tab label="Comentários" selected={tab === "comments"} onPress={() => setTab("comments")} />
    </View>
    <MotionReveal key={tab} style={{ gap: 20 }}>
    {tab === "summary" && <>
      <GlassSurface><DetailField label="DESCRIÇÃO" value={finding.description} /></GlassSurface>
      {finding.impact && <GlassSurface><DetailField label="IMPACTO" value={finding.impact} /></GlassSurface>}
      {finding.recommendation && <GlassSurface><DetailField label="RECOMENDAÇÃO" value={finding.recommendation} /></GlassSurface>}
      {finding.severityOverrideReason && <GlassSurface><DetailField label="JUSTIFICATIVA DA SEVERIDADE AJUSTADA" value={finding.severityOverrideReason} /></GlassSurface>}
      {(finding.sla?.state && finding.sla.state !== "NO_SLA" || finding.vrs?.score != null) && <GlassSurface>
        {finding.sla?.state && finding.sla.state !== "NO_SLA" && <DetailField label="PRAZO DE REMEDIAÇÃO" value={fraseDoSla(finding.sla.state, finding.sla.remainingMs)} />}
        {finding.sla?.dueAt && <Text style={ui.muted}>Prazo em {displayDate(finding.sla.dueAt, true)}</Text>}
        {finding.vrs?.score != null && <DetailField label="PRIORIDADE CONTEXTUAL / VRS" value={`${finding.vrs.score}/100${finding.vrs.band ? ` · ${VRS_BAND_LABELS[finding.vrs.band]}` : ""}`} />}
      </GlassSurface>}
      {finding.cvssVector && <GlassSurface><DetailField label="VETOR CVSS" value={finding.cvssVector} /></GlassSurface>}
      <Text style={ui.muted}>Atualizada em {displayDate(finding.updatedAt, true)}</Text>
    </>}
    {tab === "evidence" && <>
      <SectionHeading title="Evidências" meta={evidenceQuery.data ? `${evidenceQuery.data.length} arquivo(s)` : undefined} />
      {evidenceQuery.isPending ? <DataState loading title="Carregando evidências" /> : evidenceQuery.isError ? <DataState error title="Evidências indisponíveis" message={errorMessage(evidenceQuery.error)} onRetry={() => { void evidenceQuery.refetch(); }} />
        : evidenceQuery.data?.length ? <EvidenceCarousel vulnerabilityId={id!} evidences={evidenceQuery.data} /> : <DataState title="Nenhuma evidência anexada" message="Os arquivos enviados pela equipe aparecerão aqui." />}
    </>}
    {tab === "comments" && <>
      <SectionHeading title="Comentários" meta={commentsQuery.data ? `${commentsQuery.data.pages[0].total} no total` : undefined} />
      {commentsQuery.isPending && <DataState loading title="Carregando comentários" />}
      {commentsQuery.isError && <DataState error title="Comentários indisponíveis" message={errorMessage(commentsQuery.error)} onRetry={() => { if (commentsQuery.isFetchNextPageError) void commentsQuery.fetchNextPage(); else void commentsQuery.refetch(); }} />}
      {usersQuery.isError && <Text style={ui.muted}>Alguns nomes não estão disponíveis. O conteúdo dos comentários permanece abaixo.</Text>}
      {!commentsQuery.isPending && !commentsQuery.isError && !comments.length && <DataState title="A conversa ainda não começou" message="Os comentários registrados no web aparecerão aqui para consulta." />}
      {comments.map((comment) => <GlassSurface key={comment.id} style={{ gap: 14 }}><View style={ui.row}>
        <View style={styles.authorAvatar}><Text style={styles.authorInitial}>{comment.authorId === currentUser?.id || usersQuery.data?.some((user) => user.id === comment.authorId) ? author(comment.authorId).charAt(0).toUpperCase() : "?"}</Text></View>
        <View style={ui.grow}><Text style={styles.authorName}>{author(comment.authorId)}</Text><Text style={ui.muted}>{displayDate(comment.createdAt, true)}</Text></View>
      </View><Text style={ui.body}>{comment.content}</Text></GlassSurface>)}
      {commentsQuery.hasNextPage && !commentsQuery.isFetchNextPageError && <ActionButton icon="add-outline" label={commentsQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais comentários"} disabled={commentsQuery.isFetching} onPress={() => { void commentsQuery.fetchNextPage(); }} />}
    </>}
    </MotionReveal>
  </WorkspaceScreen>;
}
const styles = StyleSheet.create({
  scoreCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  authorAvatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(124,58,237,0.18)", alignItems: "center", justifyContent: "center" }, authorInitial: { color: WORKSPACE.lavender, fontFamily: FONT_FAMILY.semibold },
  authorName: { fontFamily: FONT_FAMILY.medium, color: WORKSPACE.text, fontSize: 14 },
});
