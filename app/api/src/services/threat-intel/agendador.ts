/**
 * agendador.ts
 *
 * O "cron" da Threat Intel (ADR-053): um `setInterval` dentro do processo da
 * API, como o watchdog do DAST. Supersede PARCIALMENTE o ADR-030 ("sem
 * scheduler"): ele continua valendo para o resto do produto (expiração
 * preguiçosa do aceite de risco), mas uma CVE nova só chega ao Vulnera se
 * alguém for buscá-la — e a notificação existe justamente para quando ninguém
 * está olhando.
 *
 * Primeira execução 1 min depois do boot (não disputa a subida da API), depois
 * a cada `THREAT_INTEL_SYNC_INTERVAL_MIN` (padrão 360 = 6 h). Desligável com
 * `THREAT_INTEL_SYNC_ENABLED=false`. Iniciado só pelo `server.ts`: os testes,
 * que importam o `app.ts`, nunca ligam o relógio.
 */

import type { ThreatIntelSyncService } from "./threat-intel-sync.service";

const ATRASO_INICIAL_MS = 60_000;

export function iniciarAgendador(sync: ThreatIntelSyncService, intervaloMin: number): () => void {
  const intervaloMs = Math.max(15, intervaloMin) * 60_000;
  const rodar = () => {
    sync
      .executar("SCHEDULED")
      .then((r) => {
        if (r) console.log(`🛰️  Threat Intel: ${r.status} · ${r.newAdvisories} avisos novos · ${r.newMatches} casamentos · ${r.notifications} notificações`);
      })
      .catch((e) => console.error("Threat Intel: a sincronização agendada falhou", e));
  };
  const primeira = setTimeout(rodar, ATRASO_INICIAL_MS);
  const repetir = setInterval(rodar, intervaloMs);
  // Não segura o processo vivo sozinho (encerramento limpo).
  primeira.unref();
  repetir.unref();
  return () => {
    clearTimeout(primeira);
    clearInterval(repetir);
  };
}
