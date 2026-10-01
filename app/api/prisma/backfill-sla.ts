/**
 * backfill-sla.ts — dá relógio aos findings que existiam antes do CP-2
 *
 * O QUE FAZ
 * Para cada Vulnerability ATIVA (OPEN / IN_PROGRESS) sem SLA, grava:
 *   slaStartedAt = createdAt
 *   slaDueAt     = createdAt + prazo da política vigente da empresa
 *   slaDueSoonAt = o instante dos 20% restantes
 *   slaPolicyId  = a política usada
 *
 * O QUE NÃO FAZ (docs/DECISIONS.md D1)
 * NÃO toca em FIXED/CLOSED. Aplicar uma política que não existia na época a
 * findings já encerrados inventaria conformidade (ou descumprimento)
 * histórica que ninguém mediu. O relógio só vale para quem ainda pode ser
 * remediado.
 *
 * NÃO reescreve quem já tem prazo. Rodar duas vezes produz o mesmo estado —
 * mesmo padrão de idempotência do seed-demo.
 *
 * EFEITO ESPERADO NO BANCO DE DEMONSTRAÇÃO
 * Dos ~40 findings OPEN da TechNova, vários têm mais de 30 dias: nascerão já
 * BREACHED. É verdade — são riscos conhecidos há semanas — e é o que faz o
 * SLA aparecer no dashboard em vez de ficar tudo verde.
 *
 * COMO USAR
 *   npm run sla:backfill              # banco do .env
 *   npm run sla:backfill -- --dry-run # só conta, não grava
 *
 * QUEM USA
 * Operação única pós-migration, e a demonstração. Não roda no boot.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { computeSlaCycle, SLA_ACTIVE_STATUSES } from "../src/utils/sla.util";
import { DEFAULT_SLA_WINDOW } from "../src/models/sla-policy.model";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`⏱️  Backfill de SLA${dryRun ? " (dry-run)" : ""}...`);

  const candidatos = await prisma.vulnerability.findMany({
    where: { status: { in: [...SLA_ACTIVE_STATUSES] }, slaDueAt: null },
    select: { id: true, companyId: true, severityFinal: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`  ${candidatos.length} findings ativos sem SLA`);

  // Política por empresa resolvida UMA vez (não uma consulta por finding).
  const politicaPadrao = await prisma.slaPolicy.findFirst({ where: { companyId: null, isActive: true } });
  const cache = new Map<string, { window: typeof DEFAULT_SLA_WINDOW; policyId: string | null }>();
  async function politicaDe(companyId: string) {
    const hit = cache.get(companyId);
    if (hit) return hit;
    const own = await prisma.slaPolicy.findFirst({ where: { companyId, isActive: true } });
    const p = own ?? politicaPadrao;
    const r = p
      ? { window: { criticalDays: p.criticalDays, highDays: p.highDays, mediumDays: p.mediumDays, lowDays: p.lowDays }, policyId: p.id }
      : { window: DEFAULT_SLA_WINDOW, policyId: null };
    cache.set(companyId, r);
    return r;
  }

  let gravados = 0;
  let semPrazo = 0;
  let jaVencidos = 0;
  const agora = Date.now();

  for (const v of candidatos) {
    const p = await politicaDe(v.companyId);
    const ciclo = computeSlaCycle(v.createdAt, p.window, v.severityFinal);
    if (!ciclo) {
      semPrazo++;
      continue;
    }
    if (ciclo.slaDueAt.getTime() < agora) jaVencidos++;
    if (!dryRun) {
      await prisma.vulnerability.update({
        where: { id: v.id },
        data: { ...ciclo, slaPolicyId: p.policyId },
      });
    }
    gravados++;
  }

  console.log(`  ✓ ${gravados} ${dryRun ? "seriam gravados" : "gravados"} · ${semPrazo} sem prazo (severidade NONE) · ${jaVencidos} já nascem vencidos`);
  console.log("✅ Backfill concluído");
}

main()
  .catch((e) => {
    console.error("❌ Backfill falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
