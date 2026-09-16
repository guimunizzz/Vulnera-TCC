/**
 * playbooks.fixture.ts
 *
 * Popula o catálogo System (OWASP Top 10) no banco de TESTE a partir do
 * mesmo snapshot offline que o seed de produção usa — `prisma/seeds/owasp/`.
 *
 * 🎯 POR QUE NÃO UMA FIXTURE INVENTADA: o teste tem de exercitar o conteúdo
 * real. Um "playbook A03 de mentira" provaria que a API guarda o que eu
 * mandei; o snapshot prova que o pipeline inteiro — parse do Markdown oficial,
 * sanitização e gravação — produz um catálogo utilizável. E, como o mesmo
 * arquivo alimenta a demo, uma quebra aqui é a quebra que apareceria na
 * apresentação.
 *
 * NÃO TOCA A REDE: o `buscar` injetado lê do disco.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { prisma } from "../../src/database/prisma.database";
import { RemediationPlaybookRepository } from "../../src/repositories/remediation-playbook.repository";
import { OwaspSyncService, OWASP_SOURCES } from "../../src/services/owasp-sync.service";
import type { SyncResult } from "../../src/services/owasp-sync.service";

const DIR = join(__dirname, "..", "..", "prisma", "seeds", "owasp");

export const SNAPSHOT_DISPONIVEL = existsSync(join(DIR, "MANIFEST.json"));

/** O `buscar` offline do sync: a URL oficial vira o caminho do arquivo local. */
export function lerDoSnapshot(url: string): Promise<string> {
  const nome = url === OWASP_SOURCES.INDEX_TOP_TEN ? "IndexTopTen.md" : decodeURIComponent(basename(url));
  const caminho = join(DIR, nome);
  if (!existsSync(caminho)) return Promise.reject(new Error(`SNAPSHOT_MISSING:${nome}`));
  return Promise.resolve(readFileSync(caminho, "utf-8"));
}

/** Importa as dez categorias oficiais. Devolve o resultado para o teste conferir. */
export async function seedOwaspSystemPlaybooks(sourceVersion = "2021@test"): Promise<SyncResult> {
  const service = new OwaspSyncService(new RemediationPlaybookRepository(prisma));
  return service.sync({ buscar: lerDoSnapshot, sourceVersion });
}

/** Um service de sync pronto para o teste, sem passar pela factory (que usa rede). */
export function makeSyncServiceDeTeste(): OwaspSyncService {
  return new OwaspSyncService(new RemediationPlaybookRepository(prisma));
}
