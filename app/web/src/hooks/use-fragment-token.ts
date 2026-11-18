/**
 * Lê uma única vez o token de confirmação em #token= e remove o fragmento da URL.
 * Mantém o segredo apenas em memória e preserva o estado, caminho e query atuais.
 * Consumido pela página pública de confirmação de e-mail.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface FragmentTokenState {
  token: string | null;
  ready: boolean;
  clearToken: () => void;
}

export function useFragmentToken(): FragmentTokenState {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const capturedOnce = useRef(false);
  const tokenRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (capturedOnce.current) return;
    capturedOnce.current = true;

    const rawFragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const fragment = new URLSearchParams(rawFragment);
    const captured = fragment.get("token");
    tokenRef.current = captured;
    setToken(captured);
    setReady(true);

    if (fragment.has("token")) {
      // Preserva state/path/query; o token nunca é copiado para a query string.
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  const clearToken = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
  }, []);

  return { token, ready, clearToken };
}
