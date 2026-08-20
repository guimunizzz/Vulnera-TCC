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

import { useState } from "react";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../src/api/auth.api";
import { useAuthStore } from "../src/store/auth.store";
import { useApiError } from "../src/hooks/use-api-error";
import { Button } from "../src/components/button";
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from "../src/theme/tokens";

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
        return;
      }
      setError(null);
      setAuth(auth);
      router.replace("/(tabs)/home");
    },
    onError: (err: unknown) => setError(getErrorMessage(err)),
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>VULNERA</Text>
          <Text style={styles.subtitle}>Acompanhe suas análises de segurança</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="voce@empresa.com"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              textContentType="password"
            />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            onPress={() => loginMutation.mutate()}
            disabled={!email || !password || loginMutation.isPending}
            loading={loginMutation.isPending}
          >
            Entrar
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    gap: SPACING[2],
  },
  wordmark: {
    fontSize: FONT_SIZE["2xl"],
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.accentInk,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  form: {
    gap: SPACING[4],
  },
  field: {
    gap: SPACING[1],
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING[3],
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    fontSize: FONT_SIZE.sm,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSurface,
    borderRadius: RADIUS.control,
    padding: SPACING[3],
  },
  errorText: {
    color: COLORS.dangerInk,
    fontSize: FONT_SIZE.sm,
  },
});
