/**
 * dast-triage.service.ts
 *
 * O QUE FAZ
 * As três coisas que o pentester faz DEPOIS que um scan termina:
 *
 *  1. TRIAR — marcar cada finding como confirmado / falso-positivo / risco
 *     aceito, com nota. Fica dentro do silo DAST.
 *  2. PROMOVER — transformar um finding em `Vulnerability` de um Project
 *     real, com vetor CVSS revisado por humano e proveniência registrada.
 *  3. COMPARAR — diff entre duas execuções contra o mesmo alvo: o que
 *     apareceu, o que sumiu, o que continua.
 *
 * POR QUE EXISTE
 * Até aqui o módulo DAST terminava num beco: o scan rodava, mostrava 40
 * achados, e a única saída era um PDF. Não havia onde registrar "já olhei
 * este, é falso-positivo", nem como levar um achado real pro fluxo de
 * remediação que o resto do produto já tem, nem como provar que uma correção
 * funcionou. O [[ADR-029 - DAST como silo]] já listava a promoção como o
 * caminho pendente; o [[ADR-032]] é onde ela foi enfim desenhada.
 *
 * POR QUE É UM SERVICE SEPARADO de `dast-scan.service.ts`
 * Aquele orquestra a EXECUÇÃO (fila, watchdog, runner, persistência do
 * resultado). Este orquestra o que se faz com o resultado — e é o único do
 * módulo que precisa enxergar o outro lado do produto (Vulnerability,
 * Project, ProjectMember). Juntar os dois faria o service de execução
 * carregar seis repositories dos quais ele não usa metade.
 *
 * OWNERSHIP
 * Mesma regra do resto do módulo: PENTESTER só age sobre scans que ele mesmo
 * pediu; ADMIN age sobre todos. A promoção soma uma segunda checagem, do
 * outro lado da fronteira: só dá pra promover pra um Project em que o ator
 * seja membro (a MESMA regra do `create` de Vulnerability — promover não pode
 * ser uma porta lateral pra escrever num projeto alheio).
 *
 * QUEM CONSOME
 * `dast-triage.factory.ts` -> `dast-scan.routes.ts`.
 */

import type { DastRisk, DastTriageStatus, Vulnerability } from "@prisma/client";
import type { DastScanRepository } from "../repositories/dast-scan.repository";
import type { DastFindingRepository, DastFindingWithPromotion } from "../repositories/dast-finding.repository";
import type { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import { calculateCvss } from "../utils/cvss.util";
import { buildPromotionDraft, type PromotionDraft } from "../utils/dast-promotion.util";
import { DastFindingEntity } from "../models/dast-finding.model";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

const TRIAGE_STATUSES: DastTriageStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "ACCEPTED_RISK"];

export interface TriageDTO {
  triageStatus: DastTriageStatus;
  note?: string | null;
}

export interface PromoteDTO {
  projectId: string;
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  impact?: string;
  recommendation?: string;
}

/** Uma linha do diff entre dois scans. */
export interface ScanComparisonEntry {
  fingerprint: string;
  title: string;
  risk: DastRisk;
  url: string;
  param: string | null;
}

export interface ScanComparison {
  baseScan: { id: string; targetUrl: string; finishedAt: string | null; total: number };
  headScan: { id: string; targetUrl: string; finishedAt: string | null; total: number };
  /** Estava no base e sumiu no head — o que a remediação resolveu. */
  resolved: ScanComparisonEntry[];
  /** Não estava no base e apareceu no head — regressão ou área nova. */
  introduced: ScanComparisonEntry[];
  /** Presente nos dois — o que continua aberto. */
  persisted: ScanComparisonEntry[];
}

export class DastTriageService {
  constructor(
    private readonly scanRepository: DastScanRepository,
    private readonly findingRepository: DastFindingRepository,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  // ==========================================================================
  // 1. Triagem
  // ==========================================================================

  async triage(actor: Actor, findingId: string, dto: TriageDTO): Promise<DastFindingEntity> {
    if (!dto.triageStatus) throw new Error("MISSING_TRIAGE_STATUS");
    if (!TRIAGE_STATUSES.includes(dto.triageStatus)) throw new Error("INVALID_TRIAGE_STATUS");

    const note = typeof dto.note === "string" ? dto.note.trim() : "";
    if (note.length > 2000) throw new Error("INVALID_TRIAGE_NOTE");

    const finding = await this.getOwnedFinding(actor, findingId);

    const updated = await this.findingRepository.updateTriage(finding.id, {
      triageStatus: dto.triageStatus,
      triageNote: note.length > 0 ? note : null,
      triagedById: actor.userId,
      triagedAt: new Date(),
    });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: null, // DastFinding não pertence a uma Company (ADR-029 — o silo fica fora da cadeia multi-tenant)
      entityType: "DastFinding",
      entityId: finding.id,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: finding.triageStatus, to: dto.triageStatus }),
    });

    return new DastFindingEntity(updated);
  }

  // ==========================================================================
  // 2. Promoção para Vulnerability
  // ==========================================================================

  /**
   * Rascunho pré-preenchido do formulário. É só leitura — não cria nada.
   * O vetor CVSS que vem aqui é uma SUGESTÃO a revisar; ver o cabeçalho de
   * `dast-promotion.util.ts` pro porquê de ele nunca ser aceito direto.
   */
  async getPromotionDraft(actor: Actor, findingId: string): Promise<PromotionDraft & { alreadyPromotedTo: string | null }> {
    const finding = await this.getOwnedFinding(actor, findingId);
    const scan = await this.scanRepository.findById(finding.scanId);
    const draft = buildPromotionDraft(finding, scan?.targetUrl ?? finding.url);
    return { ...draft, alreadyPromotedTo: finding.promotedVulnerability?.id ?? null };
  }

  async promote(actor: Actor, findingId: string, dto: PromoteDTO): Promise<Vulnerability> {
    const finding = await this.getOwnedFinding(actor, findingId);

    // Dedup: o índice UNIQUE em Vulnerability.sourceDastFindingId já garante
    // isso no banco. Esta checagem existe pra devolver um erro que o usuário
    // entende, em vez de um erro de constraint do MySQL.
    if (finding.promotedVulnerability) throw new Error("FINDING_ALREADY_PROMOTED");

    if (!dto.projectId) throw new Error("MISSING_PROJECT_ID");
    if (!dto.title?.trim()) throw new Error("MISSING_TITLE");
    if (!dto.description?.trim()) throw new Error("MISSING_DESCRIPTION");
    if (!dto.owaspCategory?.trim()) throw new Error("MISSING_OWASP_CATEGORY");
    if (!dto.cvssVector?.trim()) throw new Error("MISSING_CVSS_VECTOR");

    const project = await this.projectRepository.findById(dto.projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    // Mesma regra do create de Vulnerability: promover não pode virar uma
    // porta lateral pra escrever num projeto de que o ator não participa.
    if (actor.role !== "ADMIN") {
      const membership = await this.projectMemberRepository.findOne(project.id, actor.userId);
      if (!membership) throw new Error("FORBIDDEN");
    }

    // RN10 intacta: o score sai do vetor que o PENTESTER confirmou na tela,
    // exatamente como numa vulnerability digitada à mão. `calculateCvss`
    // lança em vetor malformado — o controller traduz pra 400.
    const { score, severity } = calculateCvss(dto.cvssVector.trim());

    let created: Vulnerability;
    try {
      created = await this.vulnerabilityRepository.create({
        projectId: project.id,
        applicationId: project.applicationId, // RN09 — herdado do Project
        companyId: project.companyId, // RN09 — herdado do Project
        createdBy: actor.userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        owaspCategory: dto.owaspCategory.trim(),
        cvssVector: dto.cvssVector.trim(),
        cvssScore: score,
        severityCalculated: severity,
        severityFinal: severity,
        impact: dto.impact?.trim() || undefined,
        recommendation: dto.recommendation?.trim() || undefined,
        sourceType: "DAST_IMPORT",
        sourceDastFindingId: finding.id,
      });
    } catch (error) {
      // Fecha a janela entre a checagem lá em cima e este insert: dois cliques
      // simultâneos (ou duas abas) passariam os dois pela checagem, e o
      // segundo só bateria no UNIQUE do banco. Sem este catch, o usuário
      // veria 500 — quando o certo é o mesmo 409 do caminho não-concorrente.
      if ((error as { code?: string }).code === "P2002") throw new Error("FINDING_ALREADY_PROMOTED");
      throw error;
    }

    // Promover é uma afirmação sobre o achado: se ele virou vulnerability do
    // projeto, ele é real. Marcar CONFIRMED aqui evita o estado sem sentido
    // de "promovido mas ainda por triar" — a menos que o pentester já tenha
    // dito outra coisa de propósito (falso-positivo promovido pra registro,
    // risco aceito), caso em que a decisão dele vale mais que a inferência.
    if (finding.triageStatus === "NEW") {
      await this.findingRepository.updateTriage(finding.id, {
        triageStatus: "CONFIRMED",
        triageNote: finding.triageNote,
        triagedById: actor.userId,
        triagedAt: new Date(),
      });
    }

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: created.companyId,
      entityType: "Vulnerability",
      entityId: created.id,
      action: "CREATE",
      diffJson: JSON.stringify({
        title: created.title,
        severity: created.severityFinal,
        sourceType: "DAST_IMPORT",
        sourceDastFindingId: finding.id,
        scanId: finding.scanId,
      }),
    });

    return created;
  }

  // ==========================================================================
  // 3. Comparação entre dois scans
  // ==========================================================================

  /**
   * Diff por `fingerprint` — que é justamente `sha256(pluginId | normalizedUrl
   * | param)` e NÃO inclui a evidência (ela muda entre execuções da mesma
   * vulnerabilidade). É por isso que o mesmo problema encontrado em dois
   * scans diferentes casa aqui em vez de aparecer como "sumiu um, surgiu
   * outro".
   */
  async compare(actor: Actor, baseScanId: string, headScanId: string): Promise<ScanComparison> {
    if (baseScanId === headScanId) throw new Error("CANNOT_COMPARE_SCAN_WITH_ITSELF");

    const base = await this.getOwnedScan(actor, baseScanId);
    const head = await this.getOwnedScan(actor, headScanId);

    // Comparar alvos diferentes produziria um diff onde 100% "sumiu" e 100%
    // "apareceu" — tecnicamente correto e completamente inútil. Melhor
    // recusar com um código que a UI explica.
    if (base.targetUrl !== head.targetUrl) throw new Error("SCANS_TARGET_MISMATCH");
    if (base.status !== "COMPLETED" || head.status !== "COMPLETED") throw new Error("SCAN_NOT_COMPLETED");

    const [baseFindings, headFindings] = await Promise.all([
      this.findingRepository.findFingerprintsByScanId(base.id),
      this.findingRepository.findFingerprintsByScanId(head.id),
    ]);

    const baseByFingerprint = new Map(baseFindings.map((f) => [f.fingerprint, f]));
    const headByFingerprint = new Map(headFindings.map((f) => [f.fingerprint, f]));

    const toEntry = (f: (typeof baseFindings)[number]): ScanComparisonEntry => ({
      fingerprint: f.fingerprint,
      title: f.title,
      risk: f.risk,
      url: f.url,
      param: f.param,
    });

    const resolved = baseFindings.filter((f) => !headByFingerprint.has(f.fingerprint)).map(toEntry);
    const introduced = headFindings.filter((f) => !baseByFingerprint.has(f.fingerprint)).map(toEntry);
    // Lê do HEAD, não do base: o que interessa de um achado que persiste é
    // como ele está AGORA (título/risco podem ter mudado entre versões do ZAP).
    const persisted = headFindings.filter((f) => baseByFingerprint.has(f.fingerprint)).map(toEntry);

    return {
      baseScan: { id: base.id, targetUrl: base.targetUrl, finishedAt: base.finishedAt?.toISOString() ?? null, total: baseFindings.length },
      headScan: { id: head.id, targetUrl: head.targetUrl, finishedAt: head.finishedAt?.toISOString() ?? null, total: headFindings.length },
      resolved,
      introduced,
      persisted,
    };
  }

  /** Scans COMPLETED do mesmo alvo — alimenta o seletor "comparar com...". */
  async listComparableScans(actor: Actor, scanId: string): Promise<Array<{ id: string; finishedAt: string | null; total: number }>> {
    const scan = await this.getOwnedScan(actor, scanId);
    const todos = actor.role === "ADMIN" ? await this.scanRepository.findAll() : await this.scanRepository.findByRequester(actor.userId);

    return todos
      .filter((s) => s.id !== scan.id && s.targetUrl === scan.targetUrl && s.status === "COMPLETED")
      .map((s) => ({
        id: s.id,
        finishedAt: s.finishedAt?.toISOString() ?? null,
        total: s.alertsHigh + s.alertsMedium + s.alertsLow + s.alertsInfo,
      }));
  }

  // ==========================================================================
  // Privados
  // ==========================================================================

  private async getOwnedScan(actor: Actor, scanId: string) {
    const scan = await this.scanRepository.findById(scanId);
    if (!scan) throw new Error("SCAN_NOT_FOUND");
    if (actor.role !== "ADMIN" && scan.requestedById !== actor.userId) throw new Error("FORBIDDEN");
    return scan;
  }

  /** Ownership do finding é herdado do SCAN — DastFinding não tem dono próprio. */
  private async getOwnedFinding(actor: Actor, findingId: string): Promise<DastFindingWithPromotion> {
    const finding = await this.findingRepository.findById(findingId);
    if (!finding) throw new Error("FINDING_NOT_FOUND");
    await this.getOwnedScan(actor, finding.scanId);
    return finding;
  }
}
