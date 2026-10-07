/**
 * Conta do cliente: perfil real, estado compartilhado do push e saída segura.
 * Mantém o escopo da Fase 7, sem preferências fictícias nem edição de cadastro.
 * Consome /users/me e o registro único do layout; limpa consultas ao sair.
 */
import { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { usersApi } from "../../src/api/users.api";
import { authApi } from "../../src/api/auth.api";
import { useAuthStore } from "../../src/store/auth.store";
import { usePushStatus } from "../../src/hooks/use-push-registration";
import { useApiError } from "../../src/hooks/use-api-error";
import { ActionButton, DataState, DetailField, GlassSurface, PageHeader, SectionHeading, WorkspaceScreen } from "../../src/components/workspace-ui";
import { FONT_FAMILY } from "../../src/theme/tokens";
import { WORKSPACE, workspaceStyles as ui } from "../../src/theme/workspace";
import { displayDate } from "../../src/lib/display";
import { MotionReveal } from "../../src/components/workspace-motion";

const PUSH_LABELS = {
  verificando: { title: "Verificando notificações", description: "Confirmando a permissão e o registro deste dispositivo.", icon: "time-outline" },
  ativado: { title: "Notificações ativadas", description: "Você recebe alertas de novas vulnerabilidades críticas nos projetos da sua empresa.", icon: "notifications-outline" },
  negado: { title: "Permissão desativada", description: "Permita notificações nas configurações do celular para receber alertas críticos.", icon: "notifications-off-outline" },
  erro: { title: "Registro não confirmado", description: "Não foi possível ativar os alertas deste dispositivo. Confira a conexão e tente ao reabrir o aplicativo.", icon: "cloud-offline-outline" },
  indisponivel: { title: "Alertas indisponíveis aqui", description: "Você pode continuar acompanhando seus projetos normalmente neste ambiente.", icon: "notifications-off-outline" },
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
    <View style={{ gap: 8 }}><Text style={ui.title}>Seu perfil</Text><Text style={ui.body}>Seus dados e o acesso ao aplicativo.</Text></View>
    <GlassSurface strong>
      <View style={ui.row}><View style={styles.avatar}><Text style={styles.initial}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text></View><View style={[ui.grow, { gap: 4 }]}><Text style={ui.heading}>{user?.name ?? "Carregando perfil"}</Text><Text style={ui.muted}>{user?.email}</Text></View></View>
      <View style={ui.divider} /><DetailField label="TIPO DE CONTA" value="Cliente" />
      {user?.createdAt && <DetailField label="MEMBRO DESDE" value={displayDate(user.createdAt)} />}
    </GlassSurface>
    {profile.isPending && <Text style={ui.muted}>Atualizando os dados da sua conta...</Text>}
    {profile.isError && <DataState error title="Perfil não atualizado" message={errorMessage(profile.error)} onRetry={() => { void profile.refetch(); }} />}
    <SectionHeading title="Notificações" />
    <GlassSurface><View style={ui.row}><View style={styles.notificationIcon}><Ionicons name={push.icon} size={23} color={pushStatus === "ativado" ? "#6ee7a0" : WORKSPACE.lavender} /></View>
      <View style={ui.grow}><Text style={[ui.heading, { fontSize: 17 }]}>{push.title}</Text></View></View><Text style={ui.body}>{push.description}</Text>
      {pushStatus === "negado" && Platform.OS !== "web" && <ActionButton icon="settings-outline" label="Abrir configurações do celular" onPress={() => { void Linking.openSettings().catch(() => setSettingsError(true)); }} />}
      {settingsError && <Text style={ui.muted}>Não foi possível abrir as configurações. Use os ajustes do seu celular.</Text>}
    </GlassSurface>
    <SectionHeading title="Sua sessão" />
    <MotionReveal layout><GlassSurface><View style={ui.row}><Ionicons name="lock-closed-outline" size={20} color={WORKSPACE.lavender} /><Text style={[ui.heading, { fontSize: 17 }]}>Acesso pessoal</Text></View><Text style={ui.body}>Os projetos e as vulnerabilidades exibidos pertencem à sua empresa.</Text>
      {confirming ? <MotionReveal style={{ gap: 12 }}><Text style={ui.body}>Deseja sair? Você precisará entrar novamente para acompanhar seus projetos.</Text><ActionButton danger icon="log-out-outline" label={loggingOut ? "Saindo..." : "Confirmar saída"} disabled={loggingOut} onPress={() => { void logout(); }} /><ActionButton icon="close-outline" label="Continuar no app" disabled={loggingOut} onPress={() => setConfirming(false)} /></MotionReveal>
        : <ActionButton danger icon="log-out-outline" label="Sair da conta" onPress={() => setConfirming(true)} />}
    </GlassSurface></MotionReveal>
    <MotionReveal layout style={styles.footer}><Text style={styles.wordmark}>VULNERA</Text><Text style={ui.muted}>Versão {Constants.expoConfig?.version ?? "1.0.0"} · Segurança em acompanhamento</Text></MotionReveal>
  </WorkspaceScreen>;
}
const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: "rgba(124,58,237,0.15)", borderWidth: 1, borderColor: WORKSPACE.line, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 24, fontFamily: FONT_FAMILY.medium, color: WORKSPACE.lavender }, notificationIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(124,58,237,0.08)", alignItems: "center", justifyContent: "center" },
  footer: { alignItems: "center", gap: 6, paddingVertical: 12 }, wordmark: { fontFamily: FONT_FAMILY.monoBold, fontSize: 14, letterSpacing: 3, color: WORKSPACE.muted },
});
