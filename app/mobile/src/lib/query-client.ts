import { QueryClient } from "@tanstack/react-query";

// Espelha app/web/src/lib/query-client.ts — refetchOnWindowFocus não existe
// em RN (não há "foco de janela" nesse sentido), mas deixar a opção não
// quebra nada; refetchOnReconnect fica no default (true), que é o
// comportamento que importa no mobile: voltar de uma queda de rede refaz a query.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
