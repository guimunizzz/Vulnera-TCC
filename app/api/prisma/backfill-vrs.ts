/**
 * backfill-vrs.ts — dá Vulnera Risk Score aos findings que existiam antes do CP-3
 *
 * O QUE FAZ
 * Para cada aplicação, recalcula o VRS de TODOS os findings dela (qualquer
 * status) com o contexto de risco atual — exatamente o que o gancho de
 * mudança de contexto faz em produção (services/vrs.service.ts), só que para
 * o banco inteiro de uma vez.
 *
 * POR QUE TODOS OS STATUS
 * O VRS não tem tempo dentro; um finding fechado com score refletindo o
 * contexto atual é consistente, e a listagem não fica com número velho ao
 * lado de número novo (D3).
 *
 * IDEMPOTENTE: rodar de novo recalcula tudo e chega ao mesmo resultado —
 * a fórmula é determinística. Não há "já tem, pula": se o contexto mudou
 * entre duas execuções, a segunda é que está certa.
 *
 * COMO USAR
 *   npm run vrs:backfill
 *   npm run vrs:backfill -- --dry-run
 *
 * QUEM USA
 * Operação única pós-migration (CP-3) e a demonstração. Não roda no boot.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { VulnerabilityRepository } from "../src/repositories/vulnerability.repository";
import { VrsService } from "../src/services/vrs.service";
import { vrsBand } from "../src/utils/vrs.util";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`🎯 Backfill de VRS${dryRun ? " (dry-run)" : ""}...`);

  const apps = await prisma.application.findMany({ orderBy: { name: "asc" } });
  const service = new VrsService(new VulnerabilityRepository(prisma));

  let total = 0;
  for (const app of apps) {
    const n = dryRun ? await prisma.vulnerability.count({ where: { applicationId: app.id } }) : await service.recomputeForApplication(app);
    total += n;
    console.log(`  ${app.name.padEnd(32)} ${String(n).padStart(4)} findings  [${app.criticality} · ${app.environment} · ${app.internetFacing ? "exposta" : "interna"} · ${app.dataSensitivity}]`);
  }

  if (!dryRun) {
    const dist = await prisma.vulnerability.findMany({
      where: { vrsScore: { not: null } },
      select: { vrsScore: true },
    });
    const porFaixa: Record<string, number> = {};
    for (const v of dist) porFaixa[vrsBand(v.vrsScore!)] = (porFaixa[vrsBand(v.vrsScore!)] ?? 0) + 1;
    console.log(`  distribuição: ${Object.entries(porFaixa).map(([f, n]) => `${f} ${n}`).join(" · ")}`);
  }

  console.log(`✅ ${total} findings ${dryRun ? "seriam recalculados" : "recalculados"}`);
}

main()
  .catch((e) => {
    console.error("❌ Backfill de VRS falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
