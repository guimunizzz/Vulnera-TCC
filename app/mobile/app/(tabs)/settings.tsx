/**
 * Configurações — logout e status de notificações. Sem toggle por
 * categoria (RN24 do vault descreve isso, mas o checkpoint da Fase 7 só
 * pede "logout e status de notificações" — a granularidade por categoria
 * fica pra trabalho futuro, mesmo espírito de simplificação já usado em
 * outras fases quando o vault descreve um modelo mais completo do que o
 * prompt da fase pede).
 */

import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { authApi } from "../../src/api/auth.api";
import { useAuthStore } from "../../src/store/auth.store";
import { usePushRegistration } from "../../src/hooks/use-push-registration";
import { useTabBarClearance } from "../../src/hooks/use-tab-bar-clearance";
import { haptics } from "../../src/lib/haptics";
import { Card } from "../../src/components/card";
import { Button } from "../../src/components/button";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../../src/theme/tokens";

const PUSH_LABEL: Record<string, { texto: string; cor: string; icone: keyof typeof Ionicons.glyphMap }> = {
  verificando: { texto: "Verificando...", cor: COLORS.textMuted, icone: "time-outline" },
  ativado: { texto: "Ativadas", cor: COLORS.successInk, icone: "checkmark-circle" },
  negado: { texto: "Desativadas — permita nas configurações do celular", cor: COLORS.severity.mediumInk, icone: "notifications-off-outline" },
  erro: { texto: "Não foi possível confirmar", cor: COLORS.dangerInk, icone: "alert-circle-outline" },
  indisponivel: { texto: "Indisponível neste ambiente", cor: COLORS.textMuted, icone: "close-circle-outline" },
};

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const pushStatus = usePushRegistration();
  const pushInfo = PUSH_LABEL[pushStatus];
  const contentBottomPadding = useTabBarClearance();

  async function handleLogout() {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // best-effort — mesmo se o servidor não invalidar o refresh token,
      // o app tem que sair da sessão local de qualquer jeito.
    } finally {
      clearAuth();
      router.replace("/login");
    }
  }

  function confirmLogout() {
    haptics.warning();
    Alert.alert("Sair da conta", "Você precisará entrar de novo com seu e-mail e senha.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: handleLogout },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}>
      <Animated.View entering={FadeInUp.duration(360)}>
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() ?? "?"}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(360).delay(80)}>
        <Card>
          <View style={styles.pushRow}>
            <Ionicons name={pushInfo.icone} size={22} color={pushInfo.cor} />
            <View style={styles.pushInfo}>
              <Text style={styles.pushTitle}>Notificações push</Text>
              <Text style={[styles.pushStatus, { color: pushInfo.cor }]}>{pushInfo.texto}</Text>
            </View>
          </View>
          <Text style={styles.pushHint}>
            Você recebe um alerta quando um finding crítico é registrado num projeto da sua empresa.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(360).delay(140)}>
        <Button variant="perigo" onPress={confirmLogout}>
          Sair
        </Button>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  content: {
    padding: SPACING[4],
    gap: SPACING[4],
  },
  // Card já dá vidro fosco + sombra — aqui só o layout em linha e a faixa
  // de acento à esquerda (detalhe, não o card inteiro pintado).
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: COLORS.accentInk,
    fontSize: FONT_SIZE.lg,
    fontFamily: FONT_FAMILY.bold,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.base,
    fontFamily: FONT_FAMILY.semibold,
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
  },
  pushRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[3],
  },
  pushInfo: {
    flex: 1,
    gap: 2,
  },
  pushTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.semibold,
  },
  pushStatus: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
  },
  pushHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.regular,
    marginTop: SPACING[2],
  },
});
