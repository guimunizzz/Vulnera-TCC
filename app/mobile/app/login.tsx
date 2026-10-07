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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Stack, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useMutation } from "@tanstack/react-query";
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
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
import { MotionReveal, SOFT_MOTION, useWorkspaceMotionActive, useWorkspaceReducedMotion, WorkspaceMotionProvider } from "../src/components/workspace-motion";

/** Cursor com pulsação lenta; para fora da tela e respeita movimento reduzido. */
function BlinkingCursor() {
  const active = useWorkspaceMotionActive();
  const opacity = useSharedValue(0.65);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.45, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else { cancelAnimation(opacity); opacity.value = 0.65; }
    return () => cancelAnimation(opacity);
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View testID="login-cursor" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.cursor, style]} />;
}

function FocusField({
  icon,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: (props: { onFocus: () => void; onBlur: () => void }) => ReactNode;
}) {
  const focus = useSharedValue(0);
  const focused = useRef(false);
  const reduced = useWorkspaceReducedMotion();
  useEffect(() => {
    focus.value = withTiming(focused.current ? 1 : 0, { ...SOFT_MOTION, duration: reduced ? 0 : 180 });
    return () => cancelAnimation(focus);
  }, [focus, reduced]);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [COLORS.borderDefault, COLORS.accent]),
  }));
  const iconColorStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + focus.value * 0.4,
  }));

  return (
    <Animated.View style={[styles.fieldWrap, borderStyle]}>
      <BlurView intensity={30} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.fieldTint} />
      <Animated.View pointerEvents="none" style={iconColorStyle}>
        <Ionicons name={icon} size={18} color={COLORS.accentInk} />
      </Animated.View>
      {children({
        onFocus: () => {
          focused.current = true;
          focus.value = withTiming(1, { ...SOFT_MOTION, duration: reduced ? 0 : 180 });
        },
        onBlur: () => {
          focused.current = false;
          focus.value = withTiming(0, { ...SOFT_MOTION, duration: reduced ? 0 : 180 });
        },
      })}
    </Animated.View>
  );
}

export default function LoginScreen() {
  return <WorkspaceMotionProvider><LoginContent /></WorkspaceMotionProvider>;
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const getErrorMessage = useApiError();
  const passwordInput = useRef<TextInput>(null);
  const submitting = useRef(false);
  const reduced = useWorkspaceReducedMotion();

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ email: email.trim(), password }),
    onMutate: () => setError(null),
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
    onSettled: () => { submitting.current = false; },
  });

  function submitLogin() {
    if (!email.trim() || !password || submitting.current || loginMutation.isPending) return;
    // Enter repetido antes do próximo render também não duplica autenticação.
    submitting.current = true;
    haptics.tap();
    Keyboard.dismiss();
    loginMutation.mutate();
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ animation: reduced ? "none" : "fade", animationDuration: 280 }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <MotionReveal layout style={styles.header}>
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
          </MotionReveal>

          <MotionReveal layout delay={60} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <FocusField icon="mail-outline">
                {({ onFocus, onBlur }) => (
                  <TextInput
                    accessibilityLabel="E-mail"
                    style={styles.input}
                    value={email}
                    editable={!loginMutation.isPending}
                    onChangeText={setEmail}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="voce@empresa.com"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordInput.current?.focus()}
                  />
                )}
              </FocusField>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <FocusField icon="lock-closed-outline">
                {({ onFocus, onBlur }) => (
                  <TextInput
                    ref={passwordInput}
                    accessibilityLabel="Senha"
                    style={styles.input}
                    value={password}
                    editable={!loginMutation.isPending}
                    onChangeText={setPassword}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    textContentType="password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    returnKeyType="go"
                    onSubmitEditing={submitLogin}
                  />
                )}
              </FocusField>
            </View>

            {error && (
              <MotionReveal style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.dangerInk} />
                <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>
              </MotionReveal>
            )}

            <Button
              onPress={submitLogin}
              disabled={!email.trim() || !password || loginMutation.isPending}
              loading={loginMutation.isPending}
              glass
              soft
            >
              Entrar
            </Button>
          </MotionReveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  container: {
    // flexGrow (não flex) — é contentContainerStyle de ScrollView agora:
    // garante que o conteúdo preenche pelo menos a altura da tela (pro
    // justifyContent:"center" continuar centralizando com teclado fechado)
    // mas ainda permite rolar quando o teclado empurra o conteúdo.
    flexGrow: 1,
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
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING[3],
    overflow: "hidden",
  },
  // Tint sólido por cima do blur — mesma razão da tab bar flutuante: vidro
  // fosco puro varia demais de legibilidade dependendo do que tem atrás.
  fieldTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.surface,
    opacity: 0.5,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
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
