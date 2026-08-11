/**
 * FindingDetail — read-only (mobile nunca escreve, ver ADR-004). Badge de
 * severidade, descrição/impacto/recomendação, evidências em carrossel e
 * comentários. Sem botão de transição/override/upload/comentar — isso é
 * escrita, fora do escopo do mobile por decisão explícita da Fase 7.
 */

import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../../../../src/api/vulnerabilities.api";
import { evidencesApi } from "../../../../src/api/evidences.api";
import { vulnerabilityCommentsApi } from "../../../../src/api/vulnerability-comments.api";
import { usersApi } from "../../../../src/api/users.api";
import { useAuthStore } from "../../../../src/store/auth.store";
import { useApiError } from "../../../../src/hooks/use-api-error";
import { SeverityBadge, StatusBadge } from "../../../../src/components/badge";
import { Card } from "../../../../src/components/card";
import { EvidenceCarousel } from "../../../../src/components/evidence-carousel";
import { ErrorState, LoadingState } from "../../../../src/components/states";
import { Screen } from "../../../../src/components/screen";
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from "../../../../src/theme/tokens";
import { OWASP_LABELS } from "../../../../src/types/vulnerability.types";

export default function FindingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const getErrorMessage = useApiError();
  const currentUser = useAuthStore((s) => s.user);

  const findingQuery = useQuery({
    queryKey: ["vulnerabilities", id],
    queryFn: () => vulnerabilitiesApi.getById(id!),
    enabled: !!id,
  });
  const evidencesQuery = useQuery({
    queryKey: ["evidences", id],
    queryFn: () => evidencesApi.list(id!),
    enabled: !!id,
  });
  const commentsQuery = useQuery({
    queryKey: ["comments", id],
    queryFn: () => vulnerabilityCommentsApi.list(id!),
    enabled: !!id,
  });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  if (findingQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Carregando finding..." />
      </Screen>
    );
  }

  if (findingQuery.isError || !findingQuery.data) {
    return (
      <Screen scroll={false}>
        <ErrorState message={getErrorMessage(findingQuery.error)} onRetry={findingQuery.refetch} />
      </Screen>
    );
  }

  const finding = findingQuery.data;
  const authorName = (authorId: string): string =>
    authorId === currentUser?.id ? "Você" : (usersQuery.data?.find((u) => u.id === authorId)?.name ?? "Usuário");

  return (
    <Screen>
      <View style={styles.headerRow}>
        <SeverityBadge severidade={finding.severityFinal} cvss={finding.cvssScore} />
        <StatusBadge status={finding.status} />
      </View>
      <Text style={styles.title}>{finding.title}</Text>
      <Text style={styles.owasp}>{OWASP_LABELS[finding.owaspCategory] ?? finding.owaspCategory}</Text>

      {finding.severityOverrideReason && (
        <Card style={styles.overrideCard}>
          <Text style={styles.sectionLabel}>SEVERIDADE AJUSTADA MANUALMENTE</Text>
          <Text style={styles.bodyText}>{finding.severityOverrideReason}</Text>
        </Card>
      )}

      <Card>
        <Text style={styles.sectionLabel}>DESCRIÇÃO</Text>
        <Text style={styles.bodyText}>{finding.description}</Text>
      </Card>

      {finding.impact && (
        <Card>
          <Text style={styles.sectionLabel}>IMPACTO</Text>
          <Text style={styles.bodyText}>{finding.impact}</Text>
        </Card>
      )}

      {finding.recommendation && (
        <Card>
          <Text style={styles.sectionLabel}>RECOMENDAÇÃO</Text>
          <Text style={styles.bodyText}>{finding.recommendation}</Text>
        </Card>
      )}

      <View>
        <Text style={styles.sectionTitle}>Evidências</Text>
        {evidencesQuery.isLoading && <LoadingState label="Carregando evidências..." />}
        {!evidencesQuery.isLoading && (evidencesQuery.data?.length ?? 0) === 0 && (
          <Text style={styles.mutedText}>Nenhuma evidência anexada.</Text>
        )}
        {!!evidencesQuery.data?.length && (
          <EvidenceCarousel vulnerabilityId={id!} evidences={evidencesQuery.data} />
        )}
      </View>

      <View>
        <Text style={styles.sectionTitle}>Comentários</Text>
        {commentsQuery.isLoading && <LoadingState label="Carregando comentários..." />}
        {!commentsQuery.isLoading && (commentsQuery.data?.items.length ?? 0) === 0 && (
          <Text style={styles.mutedText}>Nenhum comentário ainda.</Text>
        )}
        <View style={styles.commentList}>
          {commentsQuery.data?.items.map((comment) => (
            <Card key={comment.id} style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{authorName(comment.authorId)}</Text>
                <Text style={styles.commentDate}>
                  {new Date(comment.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </Text>
              </View>
              <Text style={styles.bodyText}>{comment.content}</Text>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  owasp: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginTop: -SPACING[2],
  },
  overrideCard: {
    borderColor: COLORS.severity.mediumSurface,
    backgroundColor: COLORS.severity.mediumSurface,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.accentInk,
    textTransform: "uppercase",
  },
  bodyText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING[2],
  },
  mutedText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  commentList: {
    gap: SPACING[2],
  },
  commentCard: {
    gap: SPACING[1],
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  commentAuthor: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  commentDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
  },
});
