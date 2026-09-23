/**
 * sync-owasp-playbooks.ts
 *
 * CLI de importação do catálogo OFICIAL da OWASP para os System Playbooks.
 * Rodado por `npm run sync:owasp-playbooks` — NUNCA por um endpoint HTTP
 * (docs/DECISIONS.md D5): um fetch ao GitHub dentro de um request
 * transformaria indisponibilidade do GitHub em indisponibilidade do Vulnera.
 *
 * Modos:
 *   (sem flag)    rede -> banco. Importa as dez categorias do Top 10 2021.
 *   --snapshot    rede -> arquivos locais em prisma/seeds/owasp/.
 *                 É o que torna a demo INDEPENDENTE DE INTERNET: depois disso,
 *                 `npm run db:seed:playbooks` popula o catálogo offline.
 *   --dry-run     baixa e parseia, mas não grava no banco.
 *
 * As URLs são constantes no owasp-sync.service.ts e passam pela allow-list de
 * host antes de cada busca — este script NÃO aceita URL por argumento.
 *
 * Conteúdo da OWASP: CC BY-SA 4.0. O snapshot guarda a licença e o link no
 * MANIFEST.json, e cada playbook importado carrega a atribuição.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/database/prisma.database";
import { makeOwaspSyncService } from "../src/factories/remediation-playbook.factory";
import { fetchFonteOficial, OWASP_SOURCES } from "../src/services/owasp-sync.service";
import { OWASP_TOP10_2021, OWASP_LICENSE, OWASP_LICENSE_URL } from "../src/utils/owasp-parser.util";

const DIR_SNAPSHOT = join(__dirname, "..", "prisma", "seeds", "owasp");

/** Versão da fonte: ano do Top 10 + data da importação. Fica gravada no banco. */
function versaoDeHoje(): string {
  return `2021@${new Date().toISOString().slice(0, 10)}`;
}

/** Baixa as fontes oficiais e grava em disco, com hash, para o seed offline. */
async function gravarSnapshot(sourceVersion: string): Promise<void> {
  mkdirSync(DIR_SNAPSHOT, { recursive: true });

  const arquivos: Array<{ url: string; file: string; sha256: string; bytes: number }> = [];

  const baixar = async (url: string, nome: string): Promise<void> => {
    const texto = await fetchFonteOficial(url);
    writeFileSync(join(DIR_SNAPSHOT, nome), texto, "utf-8");
    arquivos.push({
      url,
      file: nome,
      sha256: createHash("sha256").update(texto, "utf-8").digest("hex"),
      bytes: Buffer.byteLength(texto, "utf-8"),
    });
    console.log(`  ✓ ${nome} (${Buffer.byteLength(texto, "utf-8")} bytes)`);
  };

  console.log("Baixando fontes oficiais da OWASP...");
  await baixar(OWASP_SOURCES.INDEX_TOP_TEN, "IndexTopTen.md");
  for (const cat of OWASP_TOP10_2021) {
    await baixar(`${OWASP_SOURCES.BASE_TOP10}/${encodeURIComponent(cat.file)}`, cat.file);
  }

  const manifest = {
    sourceVersion,
    generatedAt: new Date().toISOString(),
    license: OWASP_LICENSE,
    licenseUrl: OWASP_LICENSE_URL,
    attribution: "OWASP Foundation — OWASP Top 10:2021 e OWASP Cheat Sheet Series",
    note: "Conteúdo baixado das fontes oficiais por 'npm run sync:owasp-playbooks -- --snapshot'. Não editar à mão.",
    files: arquivos,
  };
  writeFileSync(join(DIR_SNAPSHOT, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  console.log(`\nSnapshot gravado em prisma/seeds/owasp/ (${arquivos.length} arquivos).`);
  console.log("Popule o banco sem Internet com: npm run db:seed:playbooks");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sourceVersion = versaoDeHoje();

  if (args.includes("--snapshot")) {
    await gravarSnapshot(sourceVersion);
    return;
  }

  const dryRun = args.includes("--dry-run");
  console.log(`Sincronizando OWASP Top 10 2021 -> System Playbooks (${sourceVersion})`);
  if (dryRun) console.log("(--dry-run: nada será gravado)");

  const service = makeOwaspSyncService();
  const resultado = dryRun
    ? await service.sync({ sourceVersion, buscar: fetchFonteOficial, dryRun: true })
    : await service.sync({ sourceVersion });

  console.log(`\ncriados: ${resultado.created}  atualizados: ${resultado.updated}  falhas: ${resultado.failed.length}`);
  for (const f of resultado.failed) console.log(`  ✗ ${f.category}: ${f.reason}`);

  // Falha parcial não é sucesso silencioso: o exit code precisa contar a verdade.
  if (resultado.failed.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("sync:owasp-playbooks falhou:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
