/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * vitest.config.ts — testes do frontend (Fase 6.5).
 *
 * POR QUE VITEST E NÃO JEST
 * O backend usa Jest e continua usando. Aqui o critério é outro: o frontend já
 * roda em Vite, e o Vitest reaproveita a MESMA transformação — o mesmo
 * `tsconfig`, os mesmos aliases, o mesmo tratamento de CSS e de `import.meta.env`.
 * Com Jest seria preciso duplicar toda essa configuração em `ts-jest` +
 * `moduleNameMapper`, e cada divergência entre as duas viraria um teste que
 * passa e uma tela que quebra (ou o contrário).
 *
 * AMBIENTE
 * `jsdom`, porque tudo que interessa testar aqui é DOM: foco, ARIA, teclado.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // `restoreMocks` evita o vazamento clássico: um `matchMedia` mockado num
    // teste de tema alterando o resultado do teste de movimento seguinte.
    restoreMocks: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
