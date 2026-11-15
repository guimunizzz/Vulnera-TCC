/**
 * threat-intel.service.ts
 *
 * O QUE FAZ
 * As regras da Threat Intel (ADR-053) que a tela usa: qual empresa o ator
 * enxerga, o inventário de tecnologias (com as sugestões), as CVEs que afetam
 * a empresa (triagem e promoção para Vulnerability), o feed de publicadas e o
 * estado da sincronização. Sem HTTP e sem Prisma.
 *
 * QUEM PODE O QUÊ (D19.9)
 *   ver ............ ADMIN (qualquer empresa) · CLIENT (a própria) · PENTESTER
 *                    (empresas em que é membro de algum projeto)
 *   inventário ..... ADMIN · CLIENT OWNER da empresa
 *   triar .......... ADMIN · CLIENT OWNER · PENTESTER membro
 *   promover ....... ADMIN · PENTESTER membro DO PROJETO de destino (a mesma
 *                    regra de escrita de Vulnerability)
 *   sincronizar .... ADMIN
 *
 * TENANCY (SEC2)
 * A empresa do CLIENT vem do banco, nunca da query. A do ADMIN/PENTESTER vem
 * da query e é validada. Todo casamento e toda tecnologia carregada por id tem
 * a empresa conferida contra o escopo do ator — outra empresa é 404, sem
 * confirmar que o id existe.
 */

import type { DastTriageStatus, Vulnerability } from "@prisma/client";
import type { ThreatIntelRepository, CasamentoCompleto } from "../../repositories/threat-intel.repository";
import type { TechAssetRepository } from "../../repositories/tech-asset.repository";
import type { UserRepository } from "../../repositories/user.repository";
import type { ProjectRepository } from "../../repositories/project.repository";
import type { ProjectMemberRepository } from "../../repositories/project-member.repository";
import type { VulnerabilityRepository } from "../../repositories/vulnerability.repository";
import type { AuditLogRepository } from "../../repositories/audit-log.repository";
import type { ApplicationRepository } from "../../repositories/application.repository";
import type { SlaPolicyService } from "../sla-policy.service";
import type { UserRole } from "../../models/user.model";
import type { FontesDeAvisos } from "./fontes";
import type { ThreatIntelSyncService } from "./threat-intel-sync.service";
import {
  toAtivoDTO,
  toAvisoDTO,
  toCasamentoDTO,
  toExecucaoDTO,
  type AtivoDTO,
  type AvisoDTO,
  type CasamentoDTO,
  type ExecucaoDTO,
  type PermissoesThreatIntel,
} from "../../models/threat-intel.model";
import { ECOSSISTEMAS, PARTES_CPE, chaveDeIdentidade, nomeDeExibicao, normalizarVersao, type IdentidadeDoAtivo } from "../../utils/threat-intel.util";
import { calculateCvss } from "../../utils/cvss.util";
import { computeSlaCycle } from "../../utils/sla.util";
import { calcularVrs } from "../../utils/vrs.util";

interface Actor {
  userId: string;
  role: UserRole;
}

interface Escopo {
  companyId: string;
  permissoes: PermissoesThreatIntel;
}

const TRIAGENS: DastTriageStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "ACCEPTED_RISK"];
const SEVERIDADES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
const NOME_MAX = 255;
// Nome de pacote e de produto: letras, números e a pontuação que os ecossistemas usam. Barra fica de fora
// do produto CPE (não existe nele) e dentro do pacote (escopos do npm, "@angular/core").
const RE_PACOTE = /^[@A-Za-z0-9][\w.@/:+-]{0,254}$/;
const RE_CPE = /^[a-z0-9][a-z0-9_.+~!-]{0,127}$/;
const RE_VERSAO = /^[\w.+~:-]{1,64}$/;
const FEED_DIAS_MAX = 30;
const FEED_LIMITE = 300;

export interface NovoAtivoDTO {
  kind?: string;
  ecosystem?: string;
  packageName?: string;
  cpePart?: string;
  cpeVendor?: string;
  cpeProduct?: string;
  version?: string | null;
}

export interface PromoverCasamentoDTO {
  projectId?: string;
  title?: string;
  description?: string;
  owaspCategory?: string;
  cvssVector?: string;
  recommendation?: string;
}

export class ThreatIntelService {
  constructor(
    private readonly repository: ThreatIntelRepository,
    private readonly assets: TechAssetRepository,
    private readonly users: UserRepository,
    private readonly projects: ProjectRepository,
    private readonly projectMembers: ProjectMemberRepository,
    private readonly vulnerabilities: VulnerabilityRepository,
    private readonly auditLog: AuditLogRepository,
    private readonly slaPolicy: SlaPolicyService,
    private readonly applications: ApplicationRepository,
    private readonly fontes: FontesDeAvisos,
    private readonly sync: ThreatIntelSyncService,
  ) {}

  // ==========================================================================
  // Escopo
  // ==========================================================================

  async empresasVisiveis(actor: Actor): Promise<{ id: string; name: string }[]> {
    if (actor.role === "ADMIN") return this.repository.empresas();
    if (actor.role === "PENTESTER") return this.repository.empresasDoPentester(actor.userId);
    const user = await this.users.findById(actor.userId);
    return user?.companyId ? this.repository.empresas([user.companyId]) : [];
  }

  /** Empresa e permissões do ator. CLIENT ignora o parâmetro (a empresa dele é a do banco). */
  async escopo(actor: Actor, companyIdPedido: string | undefined): Promise<Escopo> {
    if (actor.role === "CLIENT") {
      const user = await this.users.findById(actor.userId);
      if (!user?.companyId) throw new Error("COMPANY_NOT_FOUND");
      const dono = user.companyRole === "OWNER";
      return { companyId: user.companyId, permissoes: { editarInventario: dono, triar: dono, promover: false, sincronizar: false } };
    }
    if (!companyIdPedido) throw new Error("MISSING_COMPANY_ID");
    if (actor.role === "ADMIN") {
      if ((await this.repository.empresas([companyIdPedido])).length === 0) throw new Error("COMPANY_NOT_FOUND");
      return { companyId: companyIdPedido, permissoes: { editarInventario: true, triar: true, promover: true, sincronizar: true } };
    }
    if (actor.role === "PENTESTER" && (await this.repository.pentesterEhMembroDaEmpresa(actor.userId, companyIdPedido))) {
      return { companyId: companyIdPedido, permissoes: { editarInventario: false, triar: true, promover: true, sincronizar: false } };
    }
    throw new Error("FORBIDDEN");
  }

  async resumo(actor: Actor, companyId: string | undefined) {
    const e = await this.escopo(actor, companyId);
    const [inventario, casamentos, ultimas] = await Promise.all([
      this.assets.contarPorStatus(e.companyId),
      this.repository.resumoDeCasamentos(e.companyId),
      this.repository.ultimasExecucoes(1),
    ]);
    return {
      companyId: e.companyId,
      permissoes: e.permissoes,
      inventario: { confirmados: inventario.CONFIRMED ?? 0, sugeridos: inventario.SUGGESTED ?? 0, descartados: inventario.DISMISSED ?? 0 },
      casamentos,
      ultimaExecucao: ultimas[0] ? toExecucaoDTO(ultimas[0]) : null,
      sincronizando: this.sync.emAndamento(),
    };
  }

  // ==========================================================================
  // Inventário
  // ==========================================================================

  async listarAtivos(actor: Actor, companyId: string | undefined, status: string | undefined): Promise<AtivoDTO[]> {
    const e = await this.escopo(actor, companyId);
    const filtro = status ? status.split(",").filter((s) => ["SUGGESTED", "CONFIRMED", "DISMISSED"].includes(s)) : ["SUGGESTED", "CONFIRMED"];
    if (filtro.length === 0) throw new Error("INVALID_STATUS");
    return (await this.assets.listar(e.companyId, filtro)).map(toAtivoDTO);
  }

  async adicionarAtivo(actor: Actor, companyId: string | undefined, dto: NovoAtivoDTO): Promise<AtivoDTO> {
    const e = await this.escopo(actor, companyId);
    if (!e.permissoes.editarInventario) throw new Error("FORBIDDEN");
    const identidade = validarIdentidade(dto);
    const identityKey = chaveDeIdentidade(identidade);
    const existente = await this.assets.buscarPorIdentidade(e.companyId, identityKey);
    const agora = new Date();
    let ativo;
    if (existente) {
      // Já estava sugerida ou descartada: adicionar à mão é confirmar.
      if (existente.status === "CONFIRMED") throw new Error("TECH_ASSET_ALREADY_EXISTS");
      ativo = await this.assets.atualizar(existente.id, { status: "CONFIRMED", confirmedAt: agora });
    } else {
      ativo = await this.assets.criar({
        companyId: e.companyId,
        kind: identidade.kind,
        ecosystem: identidade.ecosystem ?? null,
        packageName: identidade.packageName ?? null,
        cpePart: identidade.cpePart ?? null,
        cpeVendor: identidade.cpeVendor ?? null,
        cpeProduct: identidade.cpeProduct ?? null,
        version: identidade.version ?? null,
        displayName: nomeDeExibicao(identidade),
        status: "CONFIRMED",
        source: "MANUAL",
        identityKey,
        createdById: actor.userId,
        confirmedAt: agora,
      });
    }
    await this.auditar(actor, e.companyId, "TechAsset", ativo.id, "CREATE", { identityKey, status: "CONFIRMED" });
    this.backfill([ativo.id]);
    return toAtivoDTO(ativo);
  }

  async removerAtivo(actor: Actor, id: string): Promise<void> {
    const ativo = await this.ativoDoEscopo(actor, id, "editarInventario");
    await this.assets.remover(ativo.id);
    await this.auditar(actor, ativo.companyId, "TechAsset", ativo.id, "DELETE", { identityKey: ativo.identityKey });
  }

  async confirmarSugestao(actor: Actor, id: string): Promise<AtivoDTO> {
    const ativo = await this.ativoDoEscopo(actor, id, "editarInventario");
    if (ativo.status === "CONFIRMED") throw new Error("TECH_ASSET_ALREADY_CONFIRMED");
    const atualizado = await this.assets.atualizar(ativo.id, { status: "CONFIRMED", confirmedAt: new Date() });
    await this.auditar(actor, ativo.companyId, "TechAsset", ativo.id, "STATUS_CHANGE", { from: ativo.status, to: "CONFIRMED" });
    this.backfill([ativo.id]);
    return toAtivoDTO(atualizado);
  }

  async descartarSugestao(actor: Actor, id: string): Promise<AtivoDTO> {
    const ativo = await this.ativoDoEscopo(actor, id, "editarInventario");
    if (ativo.status !== "SUGGESTED") throw new Error("TECH_ASSET_NOT_SUGGESTED");
    const atualizado = await this.assets.atualizar(ativo.id, { status: "DISMISSED" });
    await this.auditar(actor, ativo.companyId, "TechAsset", ativo.id, "STATUS_CHANGE", { from: ativo.status, to: "DISMISSED" });
    return toAtivoDTO(atualizado);
  }

  async confirmarTodas(actor: Actor, companyId: string | undefined): Promise<{ confirmadas: number }> {
    const e = await this.escopo(actor, companyId);
    if (!e.permissoes.editarInventario) throw new Error("FORBIDDEN");
    const ids = await this.assets.confirmarSugestoes(e.companyId, new Date());
    if (ids.length > 0) {
      await this.auditar(actor, e.companyId, "TechAsset", e.companyId, "STATUS_CHANGE", { to: "CONFIRMED", quantidade: ids.length });
      this.backfill(ids);
    }
    return { confirmadas: ids.length };
  }

  /** Busca no dicionário CPE do NVD para o formulário de "Produto". */
  async buscarProdutos(actor: Actor, companyId: string | undefined, termo: string | undefined) {
    const e = await this.escopo(actor, companyId);
    if (!e.permissoes.editarInventario) throw new Error("FORBIDDEN");
    const t = (termo ?? "").trim();
    if (t.length < 2 || t.length > 80) throw new Error("INVALID_SEARCH");
    try {
      return await this.fontes.nvdBuscarProdutos(t);
    } catch {
      // A tela oferece digitar fabricante e produto à mão; aqui só diz que a busca não respondeu.
      throw new Error("CPE_SEARCH_UNAVAILABLE");
    }
  }

  // ==========================================================================
  // CVEs que afetam a empresa
  // ==========================================================================

  async listarCasamentos(
    actor: Actor,
    companyId: string | undefined,
    q: { triagem?: string; kev?: boolean; severidade?: string; preexistentes?: boolean; assetId?: string },
  ): Promise<CasamentoDTO[]> {
    const e = await this.escopo(actor, companyId);
    const triagem = q.triagem ? q.triagem.split(",") : [];
    if (triagem.some((t) => !TRIAGENS.includes(t as DastTriageStatus))) throw new Error("INVALID_TRIAGE_STATUS");
    const severidades = q.severidade ? q.severidade.split(",") : [];
    if (severidades.some((s) => !SEVERIDADES.includes(s))) throw new Error("INVALID_SEVERITY");
    const linhas = await this.repository.listarCasamentos({
      companyId: e.companyId,
      triagem: triagem as DastTriageStatus[],
      apenasKev: q.kev,
      severidades,
      incluirPreexistentes: q.preexistentes !== false,
      assetId: q.assetId,
    });
    return linhas.map(toCasamentoDTO);
  }

  async triar(actor: Actor, matchId: string, dto: { triageStatus?: string; note?: string | null }): Promise<CasamentoDTO> {
    if (!dto.triageStatus) throw new Error("MISSING_TRIAGE_STATUS");
    if (!TRIAGENS.includes(dto.triageStatus as DastTriageStatus)) throw new Error("INVALID_TRIAGE_STATUS");
    const nota = typeof dto.note === "string" ? dto.note.trim() : "";
    if (nota.length > 2000) throw new Error("INVALID_TRIAGE_NOTE");
    const m = await this.casamentoDoEscopo(actor, matchId, "triar");
    const atualizado = await this.repository.triar(m.id, {
      triageStatus: dto.triageStatus as DastTriageStatus,
      triageNote: nota || null,
      triagedById: actor.userId,
      triagedAt: new Date(),
    });
    await this.auditar(actor, m.companyId, "ThreatMatch", m.id, "STATUS_CHANGE", { from: m.triageStatus, to: dto.triageStatus });
    return toCasamentoDTO(atualizado);
  }

  async rascunhoDePromocao(actor: Actor, matchId: string) {
    const m = await this.casamentoDoEscopo(actor, matchId, "promover");
    const projetos = await this.projetosParaPromover(actor, m.companyId);
    const a = m.advisory;
    const vetorValido = a.cvssVector && /^CVSS:3\.[01]\//.test(a.cvssVector) && valido(a.cvssVector) ? a.cvssVector : "";
    const linhas = [
      a.description ?? a.title ?? a.id,
      "",
      `Tecnologia afetada: ${m.asset.displayName}${m.versionConfirmed ? "" : " (versão não confirmada no inventário)"}.`,
      m.fixedVersion ? `Versão corrigida: ${m.fixedVersion}.` : null,
      a.kev ? `Explorada ativamente: está no catálogo KEV da CISA${a.kevAddedAt ? ` desde ${a.kevAddedAt.toISOString().slice(0, 10)}` : ""}.` : null,
      a.epssScore !== null ? `EPSS: ${(a.epssScore * 100).toFixed(1)}% de probabilidade de exploração em 30 dias.` : null,
      `Fonte: ${a.source} (${a.id}).`,
    ].filter((l): l is string => l !== null);
    return {
      title: `${a.id} em ${m.asset.displayName}`.slice(0, 180),
      description: linhas.join("\n").slice(0, 5000),
      // Componente com CVE conhecida é, por definição, a A06 do OWASP Top 10 2021.
      owaspCategory: "A06",
      cvssVector: vetorValido,
      cvssVectorSource: vetorValido ? a.source : "NONE",
      recommendation: m.fixedVersion
        ? `Atualizar ${m.asset.displayName} para ${m.fixedVersion} ou posterior.`
        : "Aplicar a correção do fabricante indicada no aviso; enquanto não houver, mitigar a exposição do componente.",
      projetos,
      alreadyPromotedTo: m.promotedVulnerability?.id ?? null,
    };
  }

  async promover(actor: Actor, matchId: string, dto: PromoverCasamentoDTO): Promise<Vulnerability> {
    const m = await this.casamentoDoEscopo(actor, matchId, "promover");
    if (m.promotedVulnerability) throw new Error("FINDING_ALREADY_PROMOTED");
    if (!dto.projectId) throw new Error("MISSING_PROJECT_ID");
    if (!dto.title?.trim()) throw new Error("MISSING_TITLE");
    if (!dto.description?.trim()) throw new Error("MISSING_DESCRIPTION");
    if (!dto.owaspCategory?.trim()) throw new Error("MISSING_OWASP_CATEGORY");
    if (!/^A(0[1-9]|10)$/.test(dto.owaspCategory.trim())) throw new Error("INVALID_OWASP_CATEGORY");
    if (!dto.cvssVector?.trim()) throw new Error("MISSING_CVSS_VECTOR");

    const project = await this.projects.findById(dto.projectId);
    // Projeto de outra empresa é tratado como inexistente: não confirma que o id existe.
    if (!project || project.companyId !== m.companyId) throw new Error("PROJECT_NOT_FOUND");
    if (actor.role !== "ADMIN" && !(await this.projectMembers.findOne(project.id, actor.userId))) throw new Error("FORBIDDEN");

    // RN10: o score sai do vetor que o humano confirmou na tela.
    const { score, severity } = calculateCvss(dto.cvssVector.trim());
    const agora = new Date();
    const politica = await this.slaPolicy.resolveFor(project.companyId);
    const ciclo = computeSlaCycle(agora, politica.window, severity);
    const application = await this.applications.findById(project.applicationId);
    const vrs = application
      ? calcularVrs(
          {
            cvssScore: score,
            criticality: application.criticality,
            environment: application.environment,
            internetFacing: application.internetFacing,
            dataSensitivity: application.dataSensitivity,
          },
          agora,
        )
      : null;

    let criada: Vulnerability;
    try {
      criada = await this.vulnerabilities.create({
        projectId: project.id,
        applicationId: project.applicationId,
        companyId: project.companyId,
        createdBy: actor.userId,
        title: dto.title.trim().slice(0, 191),
        description: dto.description.trim(),
        owaspCategory: dto.owaspCategory.trim(),
        cvssVector: dto.cvssVector.trim(),
        cvssScore: score,
        severityCalculated: severity,
        severityFinal: severity,
        recommendation: dto.recommendation?.trim() || undefined,
        sourceType: "THREAT_INTEL",
        sourceThreatMatchId: m.id,
        createdAt: agora,
        slaStartedAt: ciclo?.slaStartedAt ?? null,
        slaDueAt: ciclo?.slaDueAt ?? null,
        slaDueSoonAt: ciclo?.slaDueSoonAt ?? null,
        slaPolicyId: ciclo ? politica.policyId : null,
        vrsScore: vrs?.score ?? null,
        vrsFactors: vrs ? JSON.stringify(vrs.breakdown) : null,
        vrsComputedAt: agora,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new Error("FINDING_ALREADY_PROMOTED");
      throw error;
    }

    if (m.triageStatus === "NEW") {
      await this.repository.triar(m.id, { triageStatus: "CONFIRMED", triageNote: m.triageNote, triagedById: actor.userId, triagedAt: agora });
    }
    await this.auditar(actor, criada.companyId, "Vulnerability", criada.id, "CREATE", {
      title: criada.title,
      severity: criada.severityFinal,
      sourceType: "THREAT_INTEL",
      sourceThreatMatchId: m.id,
      advisoryId: m.advisoryId,
    });
    return criada;
  }

  // ==========================================================================
  // Feed e sincronização
  // ==========================================================================

  async feed(actor: Actor, companyId: string | undefined, q: { dias?: number; kev?: boolean; severidade?: string }): Promise<(AvisoDTO & { afeta: boolean })[]> {
    const e = await this.escopo(actor, companyId);
    const dias = q.dias ?? 7;
    if (!Number.isInteger(dias) || dias < 1 || dias > FEED_DIAS_MAX) throw new Error("INVALID_DAYS");
    const severidades = q.severidade ? q.severidade.split(",") : [];
    if (severidades.some((s) => !SEVERIDADES.includes(s))) throw new Error("INVALID_SEVERITY");
    const avisos = await this.repository.feed(new Date(Date.now() - dias * 24 * 3600_000), { apenasKev: q.kev, severidades }, FEED_LIMITE);
    const afetam = await this.repository.avisosQueAfetam(e.companyId, avisos.map((a) => a.id));
    return avisos.map((a) => ({ ...toAvisoDTO(a), afeta: afetam.has(a.id) }));
  }

  async execucoes(actor: Actor, companyId: string | undefined): Promise<{ sincronizando: boolean; execucoes: ExecucaoDTO[] }> {
    await this.escopo(actor, companyId);
    return { sincronizando: this.sync.emAndamento(), execucoes: (await this.repository.ultimasExecucoes(10)).map(toExecucaoDTO) };
  }

  /** "Sincronizar agora" (ADMIN): dispara em segundo plano, como o scan do DAST (ADR-030). */
  async sincronizarAgora(actor: Actor): Promise<{ iniciada: boolean }> {
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
    if (this.sync.emAndamento()) return { iniciada: false };
    this.sync.executar("MANUAL").catch((e) => console.error("Threat Intel: a sincronização manual falhou", e));
    return { iniciada: true };
  }

  // ==========================================================================
  // Privados
  // ==========================================================================

  private backfill(ids: string[]): void {
    // Em segundo plano: confirmar não espera o NVD (até 6,5 s por produto sem chave).
    this.sync.executar("ASSET", ids).catch((e) => console.error("Threat Intel: backfill do inventário falhou", e));
  }

  private async ativoDoEscopo(actor: Actor, id: string, permissao: keyof PermissoesThreatIntel) {
    const ativo = await this.assets.buscarPorId(id);
    if (!ativo) throw new Error("TECH_ASSET_NOT_FOUND");
    const e = await this.escopoOuNaoEncontrado(actor, ativo.companyId, "TECH_ASSET_NOT_FOUND");
    if (!e.permissoes[permissao]) throw new Error("FORBIDDEN");
    return ativo;
  }

  private async casamentoDoEscopo(actor: Actor, id: string, permissao: keyof PermissoesThreatIntel): Promise<CasamentoCompleto> {
    const m = await this.repository.buscarCasamento(id);
    if (!m) throw new Error("THREAT_MATCH_NOT_FOUND");
    const e = await this.escopoOuNaoEncontrado(actor, m.companyId, "THREAT_MATCH_NOT_FOUND");
    if (!e.permissoes[permissao]) throw new Error("FORBIDDEN");
    return m;
  }

  /** Recurso de outra empresa vira "não encontrado", nunca 403 (não confirma que o id existe). */
  private async escopoOuNaoEncontrado(actor: Actor, companyId: string, naoEncontrado: string): Promise<Escopo> {
    try {
      const e = await this.escopo(actor, companyId);
      if (e.companyId !== companyId) throw new Error(naoEncontrado);
      return e;
    } catch (err) {
      if (err instanceof Error && ["FORBIDDEN", "COMPANY_NOT_FOUND"].includes(err.message)) throw new Error(naoEncontrado);
      throw err;
    }
  }

  private async projetosParaPromover(actor: Actor, companyId: string): Promise<{ id: string; name: string }[]> {
    const lista = actor.role === "ADMIN" ? await this.projects.findByCompany(companyId) : (await this.projects.findByMember(actor.userId)).filter((p) => p.companyId === companyId);
    return lista.map((p) => ({ id: p.id, name: p.name }));
  }

  private async auditar(actor: Actor, companyId: string, entityType: string, entityId: string, action: string, diff: object): Promise<void> {
    await this.auditLog.create({ actorId: actor.userId, companyId, entityType, entityId, action, diffJson: JSON.stringify(diff) });
  }
}

function valido(vetor: string): boolean {
  try {
    calculateCvss(vetor);
    return true;
  } catch {
    return false;
  }
}

/** Valida o formulário do inventário e devolve a identidade normalizada. */
export function validarIdentidade(dto: NovoAtivoDTO): IdentidadeDoAtivo {
  const versao = dto.version === null || dto.version === undefined ? null : normalizarVersao(String(dto.version));
  if (versao && !RE_VERSAO.test(versao)) throw new Error("INVALID_VERSION");
  if (dto.kind === "PACKAGE") {
    if (!ECOSSISTEMAS.includes(dto.ecosystem as never)) throw new Error("INVALID_ECOSYSTEM");
    const nome = (dto.packageName ?? "").trim();
    if (!nome) throw new Error("MISSING_PACKAGE_NAME");
    if (nome.length > NOME_MAX || !RE_PACOTE.test(nome)) throw new Error("INVALID_PACKAGE_NAME");
    return { kind: "PACKAGE", ecosystem: dto.ecosystem, packageName: nome, version: versao };
  }
  if (dto.kind === "PRODUCT") {
    const parte = (dto.cpePart ?? "a").trim().toLowerCase();
    if (!PARTES_CPE.includes(parte as never)) throw new Error("INVALID_CPE_PART");
    const fabricante = (dto.cpeVendor ?? "").trim().toLowerCase();
    const produto = (dto.cpeProduct ?? "").trim().toLowerCase();
    if (!fabricante || !produto) throw new Error("MISSING_CPE_PRODUCT");
    if (!RE_CPE.test(fabricante) || !RE_CPE.test(produto)) throw new Error("INVALID_CPE_PRODUCT");
    return { kind: "PRODUCT", cpePart: parte, cpeVendor: fabricante, cpeProduct: produto, version: versao };
  }
  throw new Error("INVALID_TECH_KIND");
}
