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
  // Rede Docker onde o container do ZAP é criado. Preenchida no
  // docker-compose.yml (a API roda EM container e alcança o ZAP pelo nome do
  // container). Vazia = API rodando no host: o runner publica uma porta
  // efêmera em 127.0.0.1 e fala com o ZAP por lá. Ver zap-runner.service.ts.
  DAST_ZAP_NETWORK = "DAST_ZAP_NETWORK",
  // Teto de scans REAIS simultâneos (o watchdog enfileira o excedente).
  DAST_MAX_CONCURRENT_SCANS = "DAST_MAX_CONCURRENT_SCANS",
  // Tempo máximo esperando o daemon do ZAP responder /JSON/core/view/version/
  // depois do `docker run` (a JVM do ZAP leva ~20-40s pra subir).
  DAST_ZAP_STARTUP_TIMEOUT_MS = "DAST_ZAP_STARTUP_TIMEOUT_MS",
  // Teto de minutos do spider — sem isso um alvo grande rastreia "pra sempre"
  // e o scan só termina no timeout global.
  DAST_ZAP_SPIDER_MAX_DURATION_MIN = "DAST_ZAP_SPIDER_MAX_DURATION_MIN",
  // Silêncio máximo tolerado por scan em execução: o runner pulsa a cada
  // poll; sem pulso por esse tempo o watchdog aborta e avisa.
  DAST_HEARTBEAT_TIMEOUT_MS = "DAST_HEARTBEAT_TIMEOUT_MS",
  // Teto de RAM de CADA container do ZAP (formato do Docker: "2g", "1536m").
  // Complementa DAST_MAX_CONCURRENT_SCANS: aquele limita QUANTOS scans, este
  // limita QUANTO cada um consome. Sem os dois, 2 scans ainda derrubam a
  // máquina — medido em 2026-09-09, ver ADR-031 § "Limites de recurso".
  DAST_ZAP_MEMORY = "DAST_ZAP_MEMORY",
  // Teto de CPUs de cada container do ZAP (aceita fração: "2", "1.5").
  DAST_ZAP_CPUS = "DAST_ZAP_CPUS",
}
