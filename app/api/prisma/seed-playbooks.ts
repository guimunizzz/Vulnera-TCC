/**
 * seed-playbooks.ts
 *
 * Popula os System Playbooks a partir do SNAPSHOT LOCAL da OWASP, sem tocar a
 * rede. Rodado por `npm run db:seed:playbooks`.
 *
 * ==========================================================================
 * POR QUE EXISTE UM SEED SEPARADO DO SYNC
 * ==========================================================================
 * Porque a demo do TCC precisa funcionar sem Internet (docs/DECISIONS.md D5).
 * Um catálogo que só existe se o GitHub responder é um catálogo que some na
 * hora da apresentação. O snapshot em `prisma/seeds/owasp/` é conteúdo oficial
 * baixado uma vez (`npm run sync:owasp-playbooks -- --snapshot`), com hash
 * registrado no MANIFEST.json.
 *
 * 🎯 O PIPELINE É O MESMO DO SYNC. Este arquivo só troca a função `buscar`:
 * em vez de ir à rede, lê o arquivo do disco. Parse, sanitização e gravação
 * continuam sendo os do `OwaspSyncService` — se fossem caminhos diferentes, o
 * catálogo semeado e o sincronizado poderiam divergir, e a divergência só
 * apareceria em produção.
 *
 * Conteúdo da OWASP sob CC BY-SA 4.0 (ver prisma/seeds/owasp/MANIFEST.json).
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { prisma } from "../src/database/prisma.database";
import { makeOwaspSyncService } from "../src/factories/remediation-playbook.factory";
import { OWASP_SOURCES } from "../src/services/owasp-sync.service";

const DIR_SNAPSHOT = join(__dirname, "seeds", "owasp");
const MANIFEST = join(DIR_SNAPSHOT, "MANIFEST.json");

interface ManifestSnapshot {
  sourceVersion: string;
  generatedAt: string;
  license: string;
  files: Array<{ url: string; file: string; sha256: string; bytes: number }>;
}

/**
 * O `buscar` offline: recebe a URL oficial que o service pediria e devolve o
 * arquivo correspondente do snapshot. A URL nunca sai daqui — é só a chave.
 */
function lerDoSnapshot(url: string): Promise<string> {
  const nome = url === OWASP_SOURCES.INDEX_TOP_TEN ? "IndexTopTen.md" : decodeURIComponent(basename(url));
  const caminho = join(DIR_SNAPSHOT, nome);
  if (!existsSync(caminho)) return Promise.reject(new Error(`SNAPSHOT_MISSING:${nome}`));
  return Promise.resolve(readFileSync(caminho, "utf-8"));
}

async function main(): Promise<void> {
  if (!existsSync(MANIFEST)) {
    console.error("Snapshot da OWASP não encontrado em prisma/seeds/owasp/.");
    console.error("Gere-o uma vez com: npm run sync:owasp-playbooks -- --snapshot");
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8")) as ManifestSnapshot;
  console.log(`Semeando System Playbooks do snapshot ${manifest.sourceVersion} (offline).`);

  const service = makeOwaspSyncService();
  const resultado = await service.sync({
    buscar: lerDoSnapshot,
    sourceVersion: manifest.sourceVersion,
  });

  console.log(`criados: ${resultado.created}  atualizados: ${resultado.updated}  falhas: ${resultado.failed.length}`);
  for (const f of resultado.failed) console.log(`  ✗ ${f.category}: ${f.reason}`);
  console.log(`Licença do conteúdo: ${manifest.license} — OWASP Foundation.`);

  if (resultado.created + resultado.updated < 10) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("db:seed:playbooks falhou:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
