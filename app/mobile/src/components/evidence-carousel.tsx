/**
 * evidence-carousel.tsx
 *
 * Carrossel horizontal com paginação (FlatList + pagingEnabled) — o padrão
 * mobile-nativo pra navegar entre várias imagens num espaço pequeno, com
 * pontinhos indicando posição. Imagem é buscada com <Image source={{uri,
 * headers}}> — o token vai no HEADER Authorization, nunca na query string
 * da URL (mesma regra do resto do produto).
 *
 * PDF/TXT não têm como virar pixel num <Image> — viram um card com nome do
 * arquivo em vez de tentar embutir (mesma decisão do PDF Técnico da Fase 6:
 * "não dá pra virar pixel, então não finge que dá").
 */

import { useState } from "react";
import { Dimensions, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { evidencesApi } from "../api/evidences.api";
import { useAuthStore } from "../store/auth.store";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../theme/tokens";
import type { Evidence } from "../types/evidence.types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SLIDE_WIDTH = SCREEN_WIDTH - SPACING[4] * 2; // largura da Screen menos o padding horizontal dela

function isImage(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg";
}

export function EvidenceCarousel({
  vulnerabilityId,
  evidences,
}: {
  vulnerabilityId: string;
  evidences: Evidence[];
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [activeIndex, setActiveIndex] = useState(0);

  if (evidences.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={evidences}
        keyExtractor={(e) => e.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH));
        }}
        // Alguns swipes de paginação (sobretudo no Android) terminam sem
        // velocidade residual e nunca disparam onMomentumScrollEnd — sem
        // isso, o ponto ativo podia ficar preso na página anterior.
        onScrollEndDrag={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH));
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SLIDE_WIDTH }]}>
            {isImage(item.mimeType) ? (
              <Image
                source={{
                  uri: evidencesApi.downloadUrl(vulnerabilityId, item.id),
                  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.fileBox}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.fileBoxTint} />
                <Ionicons name="document-text-outline" size={40} color={COLORS.textMuted} />
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.originalName}
                </Text>
                <Text style={styles.fileHint}>Arquivo {item.mimeType} — abra pelo navegador pra visualizar</Text>
              </View>
            )}
            {!!item.proof && (
              <Text style={styles.caption} numberOfLines={2}>
                {item.proof}
              </Text>
            )}
          </View>
        )}
      />
      {evidences.length > 1 && (
        <View style={styles.dots}>
          {evidences.map((e, i) => (
            <View key={e.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING[2] },
  slide: { gap: SPACING[2] },
  image: {
    width: "100%",
    height: 220,
    borderRadius: RADIUS.container,
    backgroundColor: COLORS.inset,
  },
  fileBox: {
    height: 220,
    borderRadius: RADIUS.container,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING[2],
    paddingHorizontal: SPACING[4],
    overflow: "hidden",
  },
  fileBoxTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.inset,
    opacity: 0.7,
  },
  fileName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontFamily: FONT_FAMILY.medium },
  fileHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.regular, textAlign: "center" },
  caption: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontFamily: FONT_FAMILY.regular },
  dots: { flexDirection: "row", justifyContent: "center", gap: SPACING[1] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.borderStrong },
  dotActive: { backgroundColor: COLORS.accentInk, width: 16 },
});
