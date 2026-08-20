/**
 * main.tsx — ponto de entrada da aplicação.
 *
 * ORDEM DOS IMPORTS DE CSS (não mexa sem ler o cabeçalho de index.css):
 *   1. `index.css`        — fontes, tokens e o preflight do Tailwind
 *   2. `styles/base.css`  — regras de base do produto, DEPOIS do reset
 *
 * ORDEM DOS PROVIDERS (de fora para dentro):
 *   ThemeProvider  — precisa envolver tudo que pode ler o tema
 *   QueryProvider  — estado de servidor
 *   BrowserRouter  — as rotas
 *   ToastProvider  — dentro do Router porque um toast pode conter <Link>
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { ThemeProvider } from "./design/theme-provider";
import { ToastProvider } from "./components/ui/toast";
import { App } from "./App";
import "./index.css";
import "./styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
