import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

// O layout conecta AppState ao focusManager: voltar ao aplicativo atualiza
// dados vencidos. Falhas de rede aparecem como erro, e 429 respeita a API.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      networkMode: "always",
      retry: (count, error) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        return count < 1 && (status == null || status === 429 || status >= 500);
      },
      retryDelay: (_attempt, error) => {
        const value = axios.isAxiosError(error) ? error.response?.headers?.["retry-after"] : undefined;
        if (value != null) {
          const seconds = Number(value);
          const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(String(value)) - Date.now();
          if (Number.isFinite(delay)) return Math.max(1000, delay);
        }
        return 1500;
      },
      refetchOnWindowFocus: true,
    },
  },
});
