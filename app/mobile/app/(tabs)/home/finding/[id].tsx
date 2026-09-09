/**
 * FindingDetail — read-only (mobile nunca escreve, ver ADR-004). Badge de
 * severidade, descrição/impacto/recomendação, evidências em carrossel e
 * comentários. Sem botão de transição/override/upload/comentar — isso é
 * escrita, fora do escopo do mobile por decisão explícita da Fase 7.
 */

import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { vulnerabilitiesApi } from "../../../../src/api/vulnerabilities.api";
import { evidencesApi } from "../../../../src/api/evidences.api";
import { vulnerabilityCommentsApi } from "../../../../src/api/vulnerability-comments.api";
import { usersApi } from "../../../../src/api/users.api";
import { useAuthStore } from "../../../../src/store/auth.store";
import { useApiError } from "../../../../src/hooks/use-api-error";
import { SeverityBadge, StatusBadge } from "../../../../src/components/badge";
import { Card } from "../../../../src/components/card";
import { IconAvatar } from "../../../../src/components/icon-avatar";
import { EvidenceCarousel } from "../../../../src/components/evidence-carousel";
import { ErrorState, LoadingState } from "../../../../src/components/states";
import { Screen } from "../../../../src/components/screen";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../../../../src/theme/tokens";
import { OWASP_LABELS } from "../../../../src/types/vulnerability.types";

function Section({
  icon,
  label,
  children,
  tone = "neutral",
}: {
  icon: ComponentProps<typeof IconAvatar>["name"];
  label: string;
  children: ReactNode;
  tone?: ComponentProps<typeof IconAvatar>["tone"];
}) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <IconAvatar name={icon} tone={tone} size={32} />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </Card>
  );
}

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
  const authorInitial = (authorId: string): string => authorName(authorId).charAt(0).toUpperCase();

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(320)} style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <SeverityBadge severidade={finding.severityFinal} cvss={finding.cvssScore} />
          <StatusBadge status={finding.status} />
        </View>
        <Text style={styles.title}>{finding.title}</Text>
        <Text style={styles.owasp}>{OWASP_LABELS[finding.owaspCategory] ?? finding.owaspCategory}</Text>
      </Animated.View>

      {finding.severityOverrideReason && (
        <Section icon="swap-vertical-outline" label="SEVERIDADE AJUSTADA MANUALMENTE" tone="medium">
          <Text style={styles.bodyText}>{finding.severityOverrideReason}</Text>
        </Section>
      )}

      <Section icon="document-text-outline" label="DESCRIÇÃO" tone="accent">
        <Text style={styles.bodyText}>{finding.description}</Text>
      </Section>

      {finding.impact && (
        <Section icon="flash-outline" label="IMPACTO" tone="high">
          <Text style={styles.bodyText}>{finding.impact}</Text>
        </Section>
      )}

      {finding.recommendation && (
        <Section icon="bulb-outline" label="RECOMENDAÇÃO" tone="success">
          <Text style={styles.bodyText}>{finding.recommendation}</Text>
        </Section>
      )}

      <View style={styles.sectionGroup}>
        <View style={styles.sectionTitleRow}>
          <IconAvatar name="images-outline" tone="neutral" size={28} />
          <Text style={styles.sectionTitle}>Evidências</Text>
        </View>
        {evidencesQuery.isLoading && <LoadingState label="Carregando evidências..." />}
        {!evidencesQuery.isLoading && (evidencesQuery.data?.length ?? 0) === 0 && (
          <Text style={styles.mutedText}>Nenhuma evidência anexada.</Text>
        )}
        {!!evidencesQuery.data?.length && (
          <EvidenceCarousel vulnerabilityId={id!} evidences={evidencesQuery.data} />
        )}
      </View>

      <View style={styles.sectionGroup}>
        <View style={styles.sectionTitleRow}>
          <IconAvatar name="chatbubbles-outline" tone="neutral" size={28} />
          <Text style={styles.sectionTitle}>Comentários</Text>
        </View>
        {commentsQuery.isLoading && <LoadingState label="Carregando comentários..." />}
        {!commentsQuery.isLoading && (commentsQuery.data?.items.length ?? 0) === 0 && (
          <Text style={styles.mutedText}>Nenhum comentário ainda.</Text>
        )}
        <View style={styles.commentList}>
          {commentsQuery.data?.items.map((comment, i) => (
            <Animated.View key={comment.id} entering={FadeInDown.duration(280).delay(Math.min(i, 6) * 40)}>
              <Card style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthorRow}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{authorInitial(comment.authorId)}</Text>
                    </View>
                    <Text style={styles.commentAuthor}>{authorName(comment.authorId)}</Text>
                  </View>
                  <Text style={styles.commentDate}>
                    {new Date(comment.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </Text>
                </View>
                <Text style={styles.bodyText}>{comment.content}</Text>
              </Card>
            </Animated.View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: SPACING[2],
  },
  headerRow: {
    flexDirection: "row",
    gap: SPACING[2],
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontFamily: FONT_FAMILY.bold,
    color: COLORS.textPrimary,
  },
  owasp: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textMuted,
  },
  sectionCard: {
    gap: SPACING[2],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.accentInk,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bodyText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZE.sm * 1.5,
  },
  sectionGroup: {
    gap: SPACING[2],
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
    marginBottom: SPACING[1],
  },
  sectionTitle: {
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.textPrimary,
  },
  mutedText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textMuted,
  },
  commentList: {
    gap: SPACING[2],
  },
  commentCard: {
    gap: SPACING[2],
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.accentSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.bold,
    color: COLORS.accentInk,
  },
  commentAuthor: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.semibold,
    color: COLORS.textPrimary,
  },
  commentDate: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.regular,
    color: COLORS.textMuted,
  },
});
