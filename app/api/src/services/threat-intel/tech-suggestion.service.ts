/**
 * tech-suggestion.service.ts
 *
 * O inventário que se alimenta do uso (D19.5): o que o Vulnera já vê vira
 * SUGESTÃO no inventário da empresa — nunca entra direto, alguém confirma
 * (mesmo espírito do "promover com revisão humana").
 *
 *  - SBOM (CycloneDX importado no SAST/SCA): cada componente com purl de um
 *    ecossistema que o OSV cobre. A empresa é a do projeto da importação.
 *  - Fingerprint do DAST: tecnologias anunciadas pelo alvo (header Server,
 *    gerador, marcas no HTML) e os CPEs da InternetDB. O scan não tem empresa
 *    (SG-FUT-04b); a empresa é a dona da aplicação cuja URL tem o MESMO host do
 *    alvo. Sem aplicação com esse host, nada é sugerido.
 *
 * Nunca derruba quem chamou: a importação e o scan valem mesmo se sugerir falhar.
 */

import type { TechAssetRepository, NovoAtivo } from "../../repositories/tech-asset.repository";
import { ativoDoCpe22, ativoDoFingerprint, chaveDeIdentidade, nomeDeExibicao, pacoteDoPurl, type IdentidadeDoAtivo } from "../../utils/threat-intel.util";

/** Teto por importação: um SBOM de monorepo pode ter milhares de componentes. */
const MAX_SUGESTOES_POR_ORIGEM = 2000;

export interface ComponenteSbom {
  name: string;
  version: string | null;
  purl: string | null;
}

export class TechSuggestionService {
  constructor(private readonly assets: TechAssetRepository) {}

  async sugerirDoSbom(companyId: string, importId: string, componentes: ComponenteSbom[]): Promise<number> {
    const identidades = componentes.flatMap((c): IdentidadeDoAtivo[] => {
      const p = pacoteDoPurl(c.purl);
      return p ? [{ kind: "PACKAGE", ecosystem: p.ecosystem, packageName: p.name, version: p.version ?? c.version }] : [];
    });
    return this.gravar(companyId, "SBOM", importId, identidades);
  }

  async sugerirDoScan(scanId: string, alvo: string, tecnologias: { nome: string; versao: string | null }[], cpes: string[]): Promise<number> {
    const host = hostDe(alvo);
    if (!host) return 0;
    const empresas = new Set((await this.assets.aplicacoesComUrl()).filter((a) => hostDe(a.url) === host).map((a) => a.companyId));
    if (empresas.size === 0) return 0;
    const identidades = [
      ...tecnologias.flatMap((t) => {
        const a = ativoDoFingerprint(t.nome, t.versao);
        return a ? [a] : [];
      }),
      ...cpes.flatMap((c) => {
        const a = ativoDoCpe22(c);
        return a ? [a] : [];
      }),
    ];
    let total = 0;
    for (const companyId of empresas) total += await this.gravar(companyId, "FINGERPRINT", scanId, identidades);
    return total;
  }

  private async gravar(companyId: string, source: string, sourceRef: string, identidades: IdentidadeDoAtivo[]): Promise<number> {
    const porChave = new Map<string, NovoAtivo>();
    for (const i of identidades) {
      const identityKey = chaveDeIdentidade(i);
      if (porChave.has(identityKey)) continue;
      porChave.set(identityKey, {
        companyId,
        kind: i.kind,
        ecosystem: i.ecosystem ?? null,
        packageName: i.packageName ?? null,
        cpePart: i.cpePart ?? null,
        cpeVendor: i.cpeVendor ?? null,
        cpeProduct: i.cpeProduct ?? null,
        version: i.version ?? null,
        displayName: nomeDeExibicao(i),
        status: "SUGGESTED",
        source,
        sourceRef: sourceRef.slice(0, 64),
        identityKey,
      });
      if (porChave.size >= MAX_SUGESTOES_POR_ORIGEM) break;
    }
    return this.assets.criarSugestoes([...porChave.values()]);
  }
}

/** Host com porta ("host.docker.internal:8099"); null se não for URL http(s). */
export function hostDe(url: string | null | undefined): string | null {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "http:" || u.protocol === "https:" ? u.host.toLowerCase() : null;
  } catch {
    return null;
  }
}
