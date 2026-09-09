export enum EnvKeys {
  PORT = "PORT",
  DATABASE_URL = "DATABASE_URL",
  JWT_ACCESS_SECRET = "JWT_ACCESS_SECRET",
  JWT_ACCESS_TTL = "JWT_ACCESS_TTL",
  JWT_REFRESH_SECRET = "JWT_REFRESH_SECRET",
  JWT_REFRESH_TTL = "JWT_REFRESH_TTL",
  BCRYPT_COST = "BCRYPT_COST",
  NODE_ENV = "NODE_ENV",
  CORS_ORIGIN = "CORS_ORIGIN",
  UPLOADS_DIR = "UPLOADS_DIR",
  // Módulo DAST (scans via OWASP ZAP) — ver zap-runner.service.ts
  DAST_REPORTS_DIR = "DAST_REPORTS_DIR",
  DAST_ALLOW_PRIVATE_TARGETS = "DAST_ALLOW_PRIVATE_TARGETS",
  DAST_SCAN_TIMEOUT_MS = "DAST_SCAN_TIMEOUT_MS",
  DAST_ZAP_IMAGE = "DAST_ZAP_IMAGE",
  // "true" força o fallback simulado mesmo com Docker disponível — usado em
  // .env.test pra a suíte nunca depender de Docker/rede real (CLAUDE.md §12).
  DAST_FORCE_SIMULATE = "DAST_FORCE_SIMULATE",
}
