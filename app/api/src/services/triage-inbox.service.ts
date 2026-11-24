/**
 * triage-inbox.service.ts
 *
 * O QUE FAZ
 * A caixa de triagem única (ADR-062): junta o que espera triagem no DAST, no
 * SAST/SCA e no Threat Intel, numa lista só.
 *
 * ACESSO — sempre o de cada fonte, nunca uma regra nova
 *   DAST          os scans que `DastScanService.list` devolve ao ator
 *                 (ADMIN: todos; PENTESTER: os dele). Só PENTESTER/ADMIN.
 *   SAST/SCA      as importações de `CodeScanService.listImports` (projetos de
 *                 que o PENTESTER é membro; ADMIN: todas), só a ÚLTIMA de cada
 *                 (projeto, ferramenta). Só PENTESTER/ADMIN.
 *   Threat Intel  as empresas de `empresasVisiveis`, e só aquelas em que o
 *                 `escopo` do ator tem `permissoes.triar` — a caixa não mostra
 *                 o que a pessoa não pode decidir (CLIENT MEMBER fica de fora).
 * Uma fonte que falha (ex.: o ator não pode) não derruba as outras.
 *
 * QUEM USA
 * `triage-inbox.controller.ts`, via `triage-inbox.factory.ts`.
 */

import type { UserRole } from "../models/user.model";
import type { CasamentoDTO } from "../models/threat-intel.model";
import type { TriageInboxRepository } from "../repositories/triage-inbox.repository";
import {
  caminhoDaUrl,
  LIMITE_DA_CAIXA,
  LIMITE_DE_EMPRESAS,
  LIMITE_DE_IMPORTACOES,
  LIMITE_DE_SCANS,
  LIMITE_POR_FONTE,
  ordenarItens,
  resumir,
  severidadeDaCaixa,
  ultimasImportacoes,
  type CaixaDeTriagemDTO,
  type ItemDaCaixaDTO,
} from "../models/triage-inbox.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/** O que a caixa usa de cada serviço de fonte (o resto deles não importa aqui). */
export interface FontesDaCaixa {
  dast: { list(actor: Actor): Promise<Array<{ id: string; targetUrl: string; toResponse(): { createdAt: string } }>> };
  codigo: {
    listImports(
      actor: Actor,
      projectId: undefined,
    ): Promise<Array<{ id: string; projectId: string; applicationName: string; toolName: string; createdAt: string }>>;
  };
  threatIntel: {
    empresasVisiveis(actor: Actor): Promise<Array<{ id: string; name: string }>>;
    escopo(actor: Actor, companyId: string | undefined): Promise<{ companyId: string; permissoes: { triar: boolean } }>;
    listarCasamentos(actor: Actor, companyId: string | undefined, q: { triagem?: string }): Promise<CasamentoDTO[]>;
  };
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export class TriageInboxService {
  constructor(
    private readonly repository: TriageInboxRepository,
    private readonly fontes: FontesDaCaixa,
  ) {}

  async caixa(actor: Actor, agora: Date = new Date()): Promise<CaixaDeTriagemDTO> {
    const tecnico = actor.role === "ADMIN" || actor.role === "PENTESTER";
    const [dast, codigo, threat] = await Promise.all([
      tecnico ? this.doDast(actor).catch(() => []) : Promise.resolve([]),
      tecnico ? this.doCodigo(actor).catch(() => []) : Promise.resolve([]),
      this.doThreatIntel(actor).catch(() => []),
    ]);
    const todos = ordenarItens([...dast, ...codigo, ...threat]);
    return {
      geradoEm: agora.toISOString(),
      porFonte: { DAST: dast.length, CODIGO: codigo.length, THREAT_INTEL: threat.length },
      total: todos.length,
      itens: todos.slice(0, LIMITE_DA_CAIXA),
    };
  }

  private async doDast(actor: Actor): Promise<ItemDaCaixaDTO[]> {
    // Os mais recentes primeiro: a caixa é o trabalho de agora.
    const scans = (await this.fontes.dast.list(actor))
      .sort((a, b) => Date.parse(b.toResponse().createdAt) - Date.parse(a.toResponse().createdAt))
      .slice(0, LIMITE_DE_SCANS);
    const achados = await this.repository.dastNovos(scans.map((s) => s.id), LIMITE_POR_FONTE);
    return achados.map((f) => ({
      fonte: "DAST" as const,
      id: f.id,
      titulo: f.title,
      severidade: severidadeDaCaixa(f.risk),
      contexto: `${hostDe(f.scan.targetUrl)} · ${caminhoDaUrl(f.url)}${f.param ? ` · parâmetro ${f.param}` : ""}`,
      detalhe: resumir(f.description),
      criadoEm: f.createdAt.toISOString(),
      link: `/dast/scans/${f.scanId}`,
      companyId: null,
    }));
  }

  private async doCodigo(actor: Actor): Promise<ItemDaCaixaDTO[]> {
    const importacoes = ultimasImportacoes(await this.fontes.codigo.listImports(actor, undefined))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, LIMITE_DE_IMPORTACOES);
    const porId = new Map(importacoes.map((i) => [i.id, i]));
    const achados = await this.repository.codigoNovos([...porId.keys()], LIMITE_POR_FONTE);
    return achados.map((f) => {
      const imp = porId.get(f.importId)!;
      const onde =
        f.category === "SCA"
          ? `${f.packageName ?? "pacote"}${f.packageVersion ? `@${f.packageVersion}` : ""}`
          : `${f.filePath ?? "arquivo"}${f.startLine ? `:${f.startLine}` : ""}`;
      return {
        fonte: "CODIGO" as const,
        id: f.id,
        titulo: f.title,
        severidade: severidadeDaCaixa(f.severity),
        contexto: `${imp.applicationName} · ${imp.toolName} · ${onde}`,
        detalhe: resumir(f.advisoryId ? `${f.advisoryId} — ${f.description ?? ""}` : f.description),
        criadoEm: f.createdAt.toISOString(),
        link: `/sast-sca/imports/${f.importId}`,
        companyId: null,
      };
    });
  }

  private async doThreatIntel(actor: Actor): Promise<ItemDaCaixaDTO[]> {
    const empresas = (await this.fontes.threatIntel.empresasVisiveis(actor)).slice(0, LIMITE_DE_EMPRESAS);
    const porEmpresa = await Promise.all(
      empresas.map(async (empresa) => {
        const escopo = await this.fontes.threatIntel.escopo(actor, empresa.id).catch(() => null);
        if (!escopo?.permissoes.triar) return [];
        const casamentos = await this.fontes.threatIntel.listarCasamentos(actor, escopo.companyId, { triagem: "NEW" }).catch(() => []);
        return casamentos.slice(0, LIMITE_POR_FONTE).map(
          (m): ItemDaCaixaDTO => ({
            fonte: "THREAT_INTEL",
            id: m.id,
            titulo: m.advisory.title ?? m.advisory.id,
            severidade: severidadeDaCaixa(m.advisory.severity),
            contexto: `${empresa.name} · ${m.asset.displayName}${m.asset.version ? ` ${m.asset.version}` : ""} · ${m.advisory.id}${m.advisory.kev ? " · KEV" : ""}`,
            detalhe: resumir(m.advisory.description),
            criadoEm: m.createdAt,
            link: `/threat-intel?empresa=${encodeURIComponent(escopo.companyId)}&match=${encodeURIComponent(m.id)}`,
            companyId: escopo.companyId,
          }),
        );
      }),
    );
    return porEmpresa.flat();
  }
}
