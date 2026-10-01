import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildCsp, hashesDosScriptsInline } from "./config/csp";

/**
 * Cabeçalhos de segurança HTTP (Fase 8, Checkpoint 4 — achado do OWASP ZAP
 * baseline; CSP acrescentada no CP-5). `vite preview` não define nenhum por
 * padrão.
 *
 * Nosniff, anti-clickjacking e referrer policy valem para dev e preview: são
 * baratos e não interferem em nada que o app faz.
 *
 * ==========================================================================
 * A CSP VAI SÓ NO PREVIEW — E ISSO É INTENCIONAL
 * ==========================================================================
 * `vite preview` é como o Dockerfile serve o web (ADR-022) e é o alvo que o
 * ZAP escaneia; é lá que a política importa. No servidor de DESENVOLVIMENTO
 * ela fica de fora porque o `@vitejs/plugin-react` injeta um preâmbulo inline
 * de Fast Refresh que muda a cada boot: cobri-lo exigiria `'unsafe-inline'` em
 * `script-src`, ou seja, uma CSP sem a única diretiva que faz diferença contra
 * XSS.
 *
 * O conteúdo da política e o racional de cada diretiva estão em `config/csp.ts`.
 *
 * 📌 Nota histórica: até o CP-5 este arquivo dizia que "uma CSP de verdade
 * fica de fora de propósito" por causa dos estilos inline do design system.
 * O que mudou: o catálogo de remediação passou a renderizar Markdown de
 * terceiros, e o estilo inline foi resolvido com `style-src 'unsafe-inline'`,
 * mantendo `script-src` estrita — que é onde está a proteção contra XSS.
 */
function securityHeaders(): Plugin {
  const basicos = (res: { setHeader: (name: string, value: string) => void }): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // App não usa nenhuma dessas APIs — negar tudo é seguro por definição.
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  };

  /**
   * O hash vem do HTML REALMENTE SERVIDO: `dist/index.html` depois do build
   * (o Vite pode mexer no inline), com o `index.html` de origem como reserva.
   * Um hash constante no código viraria mentira silenciosa no dia em que
   * alguém editasse o script de tema.
   */
  const hashesDoHtml = (raiz: string, outDir: string): string[] => {
    for (const caminho of [join(raiz, outDir, "index.html"), join(raiz, "index.html")]) {
      try {
        return hashesDosScriptsInline(readFileSync(caminho, "utf-8"));
      } catch {
        continue;
      }
    }
    return [];
  };

  return {
    name: "vulnera-security-headers",
    configureServer: (server) => {
      server.middlewares.use((_req, res, next) => {
        basicos(res);
        next();
      });
    },
    configurePreviewServer: (server) => {
      const csp = buildCsp({
        apiUrl: process.env.VITE_API_URL,
        scriptHashes: hashesDoHtml(server.config.root, server.config.build.outDir),
      });
      server.middlewares.use((_req, res, next) => {
        basicos(res);
        res.setHeader("Content-Security-Policy", csp);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), securityHeaders()],
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
    // `vite preview` (usado no Dockerfile de produção, ADR-022) bloqueia por
    // padrão hosts fora de localhost/127.0.0.1 — proteção contra DNS
    // rebinding. `host.docker.internal` é como ferramentas rodando em outro
    // container (ex.: OWASP ZAP, Fase 8 Checkpoint 4) alcançam este serviço;
    // sem risco real aqui, o container só existe pra demo/dev local, nunca
    // exposto na internet.
    allowedHosts: ["host.docker.internal", "localhost"],
  },
});
