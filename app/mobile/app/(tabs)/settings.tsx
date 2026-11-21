/**
 * Conta do cliente: perfil real, preferência entre Roxo profundo e Claro,
 * estado compartilhado do push e saída segura.
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
import { haptics } from "../../src/lib/haptics";
import { ActionButton, DataState, DetailField, Surface, PageHeader, SectionHeading, WorkspaceScreen } from "../../src/components/workspace-ui";
import { FONT_FAMILY } from "../../src/theme/tokens";
import { useAppTheme } from "../../src/theme/use-app-theme";
import type { ThemeMode } from "../../src/store/theme.store";
import { displayDate } from "../../src/lib/display";
import { MotionReveal, SoftPressable } from "../../src/components/workspace-motion";

const PUSH_LABELS = {
  verificando: { label: "Verificando", description: "Confirmando os alertas deste dispositivo.", icon: "time-outline" },
  ativado: { label: "Ativadas", description: "Alertas de vulnerabilidades críticas.", icon: "notifications-outline" },
  negado: { label: "Desativadas", description: "Ative a permissão nos ajustes do celular para receber alertas críticos.", icon: "notifications-off-outline" },
  erro: { label: "Não confirmado", description: "Não foi possível ativar os alertas. Confira a conexão e reabra o aplicativo.", icon: "cloud-offline-outline" },
  indisponivel: { label: "Indisponíveis", description: "Alertas indisponíveis neste ambiente.", icon: "notifications-off-outline" },
} as const;

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: "moon" | "sunny-outline" }[] = [
  { value: "deep", label: "Roxo profundo", icon: "moon" },
  { value: "light", label: "Claro", icon: "sunny-outline" },
];

export default function SettingsScreen() {
  const { mode, setMode, workspace, ui } = useAppTheme();
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
    <PageHeader />
    <MotionReveal distance={8} style={{ gap: 8 }}><Text accessibilityRole="header" style={ui.title}>Minha conta</Text><Text style={ui.body}>Seus dados, aparência e o acesso ao aplicativo.</Text></MotionReveal>
    <MotionReveal delay={40} distance={8}><Surface strong>
      <View style={ui.row}><View style={[styles.avatar, { backgroundColor: workspace.neutralTint, borderColor: workspace.line }]}><Text style={[styles.initial, { color: workspace.secondary }]}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text></View><View style={[ui.grow, { gap: 4 }]}><Text style={ui.heading}>{user?.name ?? "Carregando perfil"}</Text><Text style={ui.muted}>{user?.email}</Text></View></View>
      <View style={ui.divider} /><DetailField label="TIPO DE CONTA" value="Cliente" />
      {user?.createdAt && <DetailField label="MEMBRO DESDE" value={displayDate(user.createdAt)} />}
    </Surface></MotionReveal>
    {profile.isPending && <Text style={ui.muted}>Atualizando os dados da sua conta...</Text>}
    {profile.isError && <DataState error title="Perfil não atualizado" message={errorMessage(profile.error)} onRetry={() => { void profile.refetch(); }} />}

    <MotionReveal delay={60} distance={8} style={{ gap: 20 }}>
      <SectionHeading title="Aparência" />
      <Surface>
        <View accessibilityRole="radiogroup" accessibilityLabel="Tema do aplicativo" style={[styles.themeGroup, { backgroundColor: workspace.inset, borderColor: workspace.line }]}>
          {THEME_OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <SoftPressable
                key={option.value}
                testID={`theme-option-${option.value}`}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active, checked: active }}
                aria-checked={active}
                onPress={() => {
                  if (!active) {
                    haptics.tap();
                    setMode(option.value);
                  }
                }}
                style={[
                  styles.themeButton,
                  active && {
                    backgroundColor: workspace.chipActiveBg,
                    borderColor: workspace.chipActiveBorder,
                  },
                ]}
              >
                <Ionicons name={option.icon} size={18} color={active ? workspace.lavender : workspace.muted} />
                <Text style={[styles.themeButtonText, { color: active ? workspace.text : workspace.muted }]}>{option.label}</Text>
              </SoftPressable>
            );
          })}
        </View>
      </Surface>
    </MotionReveal>

    <MotionReveal delay={80} distance={8} style={{ gap: 20 }}><SectionHeading title="Notificações" />
    <Surface><View style={ui.row}><View style={[styles.notificationIcon, { backgroundColor: workspace.neutralTint }]}><Ionicons name={push.icon} size={23} color={pushStatus === "ativado" ? workspace.successAccent : workspace.secondary} /></View>
      <View style={ui.grow}><Text accessibilityLiveRegion="polite" style={[ui.heading, { fontSize: 17 }]}>{push.label}</Text></View></View><Text style={ui.body}>{push.description}</Text>
      {pushStatus === "negado" && Platform.OS !== "web" && <ActionButton icon="settings-outline" label="Abrir configurações do celular" onPress={() => { void Linking.openSettings().catch(() => setSettingsError(true)); }} />}
      {settingsError && <Text style={ui.muted}>Não foi possível abrir as configurações. Use os ajustes do seu celular.</Text>}
    </Surface></MotionReveal>
    <MotionReveal delay={120} distance={8} layout style={{ gap: 20 }}><SectionHeading title="Sua sessão" />
    <Surface><View style={ui.row}><Ionicons name="lock-closed-outline" size={20} color={workspace.secondary} /><Text style={[ui.heading, { fontSize: 17 }]}>Acesso pessoal</Text></View><Text style={ui.body}>Os projetos e as vulnerabilidades exibidos pertencem à sua empresa.</Text>
      {confirming ? <MotionReveal style={{ gap: 12 }}><Text style={ui.body}>Deseja sair? Você precisará entrar novamente para acompanhar seus projetos.</Text><ActionButton variant="danger" icon="log-out-outline" label={loggingOut ? "Saindo..." : "Confirmar saída"} disabled={loggingOut} onPress={() => { void logout(); }} /><ActionButton icon="close-outline" label="Continuar no app" disabled={loggingOut} onPress={() => setConfirming(false)} /></MotionReveal>
        : <ActionButton variant="danger" icon="log-out-outline" label="Sair da conta" onPress={() => setConfirming(true)} />}
    </Surface></MotionReveal>
    <MotionReveal delay={160} distance={8} layout style={styles.footer}><Text style={[styles.wordmark, { color: workspace.muted }]}>VULNERA</Text><Text style={ui.muted}>Versão {Constants.expoConfig?.version ?? "1.0.0"} · Segurança em acompanhamento</Text></MotionReveal>
  </WorkspaceScreen>;
}
const styles = StyleSheet.create({
  avatar: { width: 56, height: 56, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 24, fontFamily: FONT_FAMILY.medium },
  themeGroup: { flexDirection: "row", gap: 8, padding: 6, borderRadius: 18, borderWidth: 1 },
  themeButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 10 },
  themeButtonText: { fontFamily: FONT_FAMILY.medium, fontSize: 13, flexShrink: 1, textAlign: "center" },
  notificationIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  footer: { alignItems: "center", gap: 6, paddingVertical: 12 },
  wordmark: { fontFamily: FONT_FAMILY.monoBold, fontSize: 14, letterSpacing: 3 },
});
