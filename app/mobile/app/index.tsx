/**
 * app/index.tsx
 *
 * Tela raiz sem UI própria — só decide pra onde mandar o usuário assim que
 * o SecureStore termina de reidratar (hasHydrated). Sem esperar isso, todo
 * boot piscaria a tela de login por uma fração de segundo mesmo com sessão
 * salva (o Zustand persist é assíncrono aqui, diferente do localStorage
 * síncrono do web).
 */

import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth.store";
import { LoadingState } from "../src/components/states";
import { Screen } from "../src/components/screen";

export default function Index() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  if (!hasHydrated) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Carregando sessão..." />
      </Screen>
    );
  }

  if (!accessToken || !user) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
