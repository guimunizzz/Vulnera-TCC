import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  // expo-server-sdk publica ESM puro — o Jest (CommonJS) não consegue nem
  // parsear o import. Mock manual global (ver tests/mocks/expo-server-sdk.ts)
  // evita isso pra QUALQUER teste que importe app.ts (a cadeia de imports
  // chega em push.util.ts via vulnerability.service.ts).
  moduleNameMapper: {
    "^expo-server-sdk$": "<rootDir>/tests/mocks/expo-server-sdk.ts",
  },
};

export default config;
