/**
 * app/login.tsx
 *
 * Único ponto de entrada do app — mobile não tem register (ADR-004: o
 * cadastro de empresa/usuário é fluxo do onboarding web). Depois do login,
 * barra a entrada de ADMIN/PENTESTER aqui mesmo: o mobile é exclusivo do
 * CLIENT, e deixar os outros dois papéis entrarem só pra ver telas vazias
 * (sem "meus projetos", sem findings visíveis pelas mesmas regras RN16/RN17)
 * seria pior do que recusar com uma mensagem clara.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { authApi } from "../src/api/auth.api";
import { useAuthStore } from "../src/store/auth.store";
import { useApiError } from "../src/hooks/use-api-error";
import { haptics } from "../src/lib/haptics";
import { Button } from "../src/components/button";
import { VulneraMark } from "../src/components/vulnera-mark";
import { COLORS, FONT_FAMILY, FONT_SIZE, RADIUS, SPACING } from "../src/theme/tokens";

/** Cursor de terminal piscando ao lado do wordmark — mesmo `@keyframes blink` do Lockup.dc.html (0.15↔1 opacidade, 1.2s, contínuo). */
function BlinkingCursor() {
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    opacity.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.cursor, style]} />;
}

function FocusField({
  icon,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: (props: { onFocus: () => void; onBlur: () => void }) => ReactNode;
}) {
  const focus = useSharedValue(0);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [COLORS.borderDefault, COLORS.accent]),
  }));
  const iconColorStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + focus.value * 0.4,
  }));

  return (
    <Animated.View style={[styles.fieldWrap, borderStyle]}>
      <Animated.View style={iconColorStyle}>
        <Ionicons name={icon} size={18} color={COLORS.accentInk} />
      </Animated.View>
      {children({
        onFocus: () => {
          focus.value = withTiming(1, { duration: 180 });
        },
        onBlur: () => {
          focus.value = withTiming(0, { duration: 180 });
        },
      })}
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const getErrorMessage = useApiError();

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email: email.trim(), password }),
    onSuccess: (auth) => {
      if (auth.user.role !== "CLIENT") {
        // Não persiste sessão de ADMIN/PENTESTER — mobile é exclusivo do CLIENT (ADR-004).
        clearAuth();
        setError("Este aplicativo é exclusivo para clientes. Administradores e pentesters usam o navegador.");
        haptics.warning();
        return;
      }
      setError(null);
      haptics.success();
      setAuth(auth);
      router.replace("/(tabs)/home");
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err));
      haptics.warning();
    },
  });

  return (
    <View style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Animated.View entering={FadeInUp.duration(420)} style={styles.header}>
            <View style={styles.lockup}>
              <VulneraMark size={60} />
              <View style={styles.divider} />
              <View>
                <View style={styles.wordRow}>
                  <Text style={styles.wordmark}>VULNERA</Text>
                  <BlinkingCursor />
                </View>
                <Text style={styles.security}>SECURITY</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(420).delay(120)} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <FocusField icon="mail-outline">
                {({ onFocus, onBlur }) => (
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="voce@empresa.com"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                )}
              </FocusField>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <FocusField icon="lock-closed-outline">
                {({ onFocus, onBlur }) => (
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    textContentType="password"
                  />
                )}
              </FocusField>
            </View>

            {error && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.dangerInk} />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            <Button
              onPress={() => loginMutation.mutate()}
              disabled={!email || !password || loginMutation.isPending}
              loading={loginMutation.isPending}
            >
              Entrar
            </Button>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING[6],
    gap: SPACING[8],
  },
  header: {
    alignItems: "center",
    gap: SPACING[3],
  },
  lockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[4],
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.borderDefault,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  wordmark: {
    fontSize: FONT_SIZE.xl,
    fontFamily: FONT_FAMILY.monoBold,
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  cursor: {
    width: 6,
    height: 18,
    backgroundColor: COLORS.accent,
    marginLeft: 2,
  },
  security: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  form: {
    gap: SPACING[4],
  },
  field: {
    gap: SPACING[1],
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONT_FAMILY.medium,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING[3],
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
    paddingVertical: SPACING[2],
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING[2],
    backgroundColor: COLORS.dangerSurface,
    borderRadius: RADIUS.control,
    padding: SPACING[3],
  },
  errorText: {
    flex: 1,
    color: COLORS.dangerInk,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONT_FAMILY.regular,
  },
});
