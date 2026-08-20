import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Cabeçalhos de segurança HTTP básicos (Fase 8, Checkpoint 4 — achado do
 * OWASP ZAP baseline). `vite preview` não define nenhum por padrão.
 *
 * Só os headers BARATOS e de baixo risco de quebrar a aplicação: nosniff,
 * anti-clickjacking e referrer policy não interferem em nada que o app já
 * faz. Uma Content-Security-Policy de verdade fica de fora de propósito —
 * o design system usa `style` inline (`style={{...}}`) em vários
 * componentes, e uma CSP estrita o suficiente pra valer a pena exigiria
 * testar a aplicação inteira contra ela; documentado como limitação
 * conhecida no README em vez de arriscar quebrar a demo.
 */
function securityHeaders(): Plugin {
  const apply = (_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void): void => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // App não usa nenhuma dessas APIs — negar tudo é seguro por definição.
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  };
  return {
    name: "vulnera-security-headers",
    configureServer: (server) => {
      server.middlewares.use(apply);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(apply);
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
