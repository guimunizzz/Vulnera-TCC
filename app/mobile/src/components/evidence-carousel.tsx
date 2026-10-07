/**
 * Carrossel de evidências reais com dimensões medidas no próprio componente.
 * Mantém autenticação nos headers e trata falha de arquivo sem simular imagem.
 * Consumidor: aba Evidências do detalhe de vulnerabilidade do cliente.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../api/client";
import { evidencesApi } from "../api/evidences.api";
import { useAuthStore } from "../store/auth.store";
import { WORKSPACE, workspaceStyles as ui } from "../theme/workspace";
import { FONT_FAMILY } from "../theme/tokens";
import { displayBytes, displayDate } from "../lib/display";
import { ActionButton, GlassSurface } from "./workspace-ui";
import type { Evidence } from "../types/evidence.types";

function EvidenceImage({ evidence, vulnerabilityId }: { evidence: Evidence; vulnerabilityId: string }) {
  const token = useAuthStore((state) => state.accessToken);
  const [webUrl, setWebUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  async function retryImage() {
    if (retrying) return;
    setRetrying(true);
    try {
      // Image nativa não usa o interceptor; esta leitura renova uma sessão expirada.
      if (Platform.OS !== "web") await apiClient.get("/users/me");
      setAttempt((value) => value + 1);
    } catch { setFailed(true); }
    finally { setRetrying(false); }
  }
  useEffect(() => {
    setLoading(true); setFailed(false);
    if (Platform.OS !== "web") return;
    // No preview web, <img> não envia headers: Axios autentica antes do blob.
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setWebUrl(undefined);
    void apiClient.get<Blob>(`/vulnerabilities/${vulnerabilityId}/evidences/${evidence.id}`, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(data); setWebUrl(objectUrl); } })
      .catch(() => { if (!controller.signal.aborted) { setFailed(true); setLoading(false); } });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [vulnerabilityId, evidence.id, token, attempt]);
  if (failed) return <View style={styles.file}><Ionicons name="image-outline" size={30} color={WORKSPACE.muted} /><Text style={ui.muted}>Não foi possível carregar a imagem.</Text>
    <ActionButton label={retrying ? "Carregando..." : "Tentar novamente"} disabled={retrying} onPress={() => { void retryImage(); }} /></View>;
  const uri = Platform.OS === "web" ? webUrl : evidencesApi.downloadUrl(vulnerabilityId, evidence.id);
  return <View style={styles.imageWrap}>
    {uri && <Image key={`${evidence.id}-${attempt}`} source={{ uri, headers: Platform.OS !== "web" && token ? { Authorization: `Bearer ${token}` } : undefined }}
      accessibilityLabel={evidence.proof || evidence.originalName} style={styles.image} resizeMode="contain"
      onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />}
    {loading && <ActivityIndicator color={WORKSPACE.lavender} style={StyleSheet.absoluteFill} />}
  </View>;
}

export function EvidenceCarousel({ vulnerabilityId, evidences }: { vulnerabilityId: string; evidences: Evidence[] }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  if (!evidences.length) return null;
  return <View style={{ gap: 14 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    {width > 0 && <FlatList key={width} data={evidences} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      keyExtractor={(evidence) => evidence.id} getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={(event) => setActive(Math.max(0, Math.min(evidences.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      renderItem={({ item }) => <View style={{ width }}><GlassSurface style={styles.slide}>
        <View style={ui.spread}><View style={[ui.row, ui.grow, { gap: 8 }]}><Ionicons name="attach-outline" size={18} color={WORKSPACE.lavender} /><Text numberOfLines={2} style={[styles.fileName, ui.grow]}>{item.originalName}</Text></View><Text style={ui.mono}>{displayBytes(item.sizeBytes)}</Text></View>
        {item.mimeType.startsWith("image/") ? <EvidenceImage vulnerabilityId={vulnerabilityId} evidence={item} /> : <View style={styles.file}>
          <Ionicons name="document-text-outline" size={36} color={WORKSPACE.lavender} /><Text style={ui.body}>Arquivo anexado</Text><Text style={[ui.muted, { textAlign: "center" }]}>Consulte este documento na plataforma web.</Text>
        </View>}
        {!!item.proof && <Text style={ui.body}>{item.proof}</Text>}<Text style={ui.muted}>Enviada em {displayDate(item.createdAt)}</Text>
      </GlassSurface></View>}
    />}
    <View style={ui.spread}><Text style={ui.muted}>Deslize para consultar os arquivos</Text><Text style={ui.mono}>{Math.min(active + 1, evidences.length)} / {evidences.length}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  slide: { gap: 16, padding: 16 }, fileName: { color: WORKSPACE.text, fontFamily: FONT_FAMILY.medium, fontSize: 12, lineHeight: 18 },
  imageWrap: { height: 235, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.25)", overflow: "hidden" }, image: { width: "100%", height: "100%" },
  file: { minHeight: 235, padding: 20, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.22)", gap: 12, alignItems: "center", justifyContent: "center" },
});
