/**
 * Conta do cliente: perfil real, estado compartilhado do push e saída segura.
 * Mostra apenas os dados essenciais para reduzir a leitura antes das ações.
 * Mantém o escopo da Fase 7, sem preferências fictícias nem edição de cadastro.
 * Consome /users/me e o registro único do layout; limpa consultas ao sair.
 */
import { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { usersApi } from "../../src/api/users.api";
import { authApi } from "../../src/api/auth.api";
import { useAuthStore } from "../../src/store/auth.store";
import { usePushStatus } from "../../src/hooks/use-push-registration";
import { useApiError } from "../../src/hooks/use-api-error";
import { ActionButton, DataState, GlassSurface, PageHeader, WorkspaceScreen } from "../../src/components/workspace-ui";
import { FONT_FAMILY } from "../../src/theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../../src/theme/workspace";
import { MotionReveal } from "../../src/components/workspace-motion";

const PUSH_LABELS = {
  verificando: { label: "Verificando", description: "Confirmando os alertas deste dispositivo." },
  ativado: { label: "Ativadas", description: "Alertas de vulnerabilidades críticas." },
  negado: { label: "Desativadas", description: "Ative a permissão nos ajustes do celular para receber alertas críticos." },
  erro: { label: "Não confirmado", description: "Não foi possível ativar os alertas. Confira a conexão e reabra o aplicativo." },
  indisponivel: { label: "Indisponíveis", description: "Alertas indisponíveis neste ambiente." },
} as const;

export default function SettingsScreen() {
  const router = useRouter();
  const storedUser = useAuthStore((state) => state.user);
  const profile = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => usersApi.me(signal) });
  const user = profile.data ?? storedUser;
  const pushStatus = usePushStatus();
  const push = PUSH_LABELS[pushStatus];
  const errorMessage = useApiError();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const { refreshToken, clearAuth } = useAuthStore.getState();
    try { if (refreshToken) await authApi.logout(refreshToken); }
    catch { /* A saída local continua possível quando o servidor está indisponível. */ }
    finally { clearAuth(); router.replace("/login"); }
  }
  return <WorkspaceScreen refreshing={profile.isRefetching} onRefresh={() => { void profile.refetch(); }}>
    <PageHeader label="MINHA CONTA" />
    <GlassSurface strong>
      <View style={ui.row}><View style={styles.avatar}><Text style={styles.initial}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text></View><View style={[ui.grow, { gap: 4 }]}><Text style={ui.heading}>{user?.name ?? "Carregando perfil"}</Text><Text style={ui.muted}>{user?.email}</Text></View></View>
    </GlassSurface>
    {profile.isPending && <Text style={ui.muted}>Atualizando perfil...</Text>}
    {profile.isError && <DataState error title="Perfil não atualizado" message={errorMessage(profile.error)} onRetry={() => { void profile.refetch(); }} />}
    <GlassSurface><View style={styles.notificationHeader}>
      <Text style={[ui.heading, { fontSize: 17 }]}>Notificações</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.notificationStatus,
        pushStatus === "ativado" && styles.notificationActive,
        pushStatus === "erro" && styles.notificationError]}>{push.label}</Text>
    </View><Text style={ui.muted}>{push.description}</Text>
      {pushStatus === "negado" && Platform.OS !== "web" && <ActionButton icon="settings-outline" label="Abrir configurações do celular" onPress={() => { void Linking.openSettings().catch(() => setSettingsError(true)); }} />}
      {settingsError && <Text style={ui.muted}>Não foi possível abrir as configurações. Use os ajustes do seu celular.</Text>}
    </GlassSurface>
    <MotionReveal layout>
      {confirming ? <GlassSurface><Text style={ui.heading}>Sair da conta?</Text><Text style={ui.muted}>Você precisará entrar novamente.</Text><ActionButton danger icon="log-out-outline" label={loggingOut ? "Saindo..." : "Confirmar saída"} disabled={loggingOut} onPress={() => { void logout(); }} /><ActionButton icon="close-outline" label="Continuar no app" disabled={loggingOut} onPress={() => setConfirming(false)} /></GlassSurface>
        : <ActionButton danger icon="log-out-outline" label="Sair da conta" onPress={() => setConfirming(true)} />}
    </MotionReveal>
    <Text style={styles.version}>Versão {Constants.expoConfig?.version ?? "1.0.0"}</Text>
  </WorkspaceScreen>;
}
const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: WORKSPACE.neutralTint, borderWidth: 1, borderColor: WORKSPACE.line, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 24, fontFamily: FONT_FAMILY.medium, color: WORKSPACE.secondary },
  notificationHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  notificationStatus: { maxWidth: "100%", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: WORKSPACE.inset, color: WORKSPACE.secondary, fontFamily: FONT_FAMILY.medium, fontSize: 12, lineHeight: 18 },
  notificationActive: { backgroundColor: "#052e16", color: "#6ee7a0" },
  notificationError: { backgroundColor: "#2f0a0a", color: "#fca5a5" },
  version: { color: WORKSPACE.muted, fontFamily: FONT_FAMILY.regular, fontSize: 12, lineHeight: 18 },
});
