/**
 * code-scan.service.ts
 *
 * O QUE FAZ
 * Importação de relatórios SAST/SCA (SARIF e CycloneDX) para um Project e o
 * que o pentester faz com eles depois (ADR-052):
 *
 *  1. IMPORTAR — lê o arquivo, compara com a importação anterior do mesmo
 *     projeto/formato/ferramenta e grava achados novos, persistentes e o
 *     total de resolvidos. Achado que persiste HERDA a triagem anterior.
 *  2. TRIAR — confirmado / falso-positivo / risco aceito, com nota.
 *  3. PROMOVER — vira `Vulnerability` do próprio projeto, com vetor CVSS
 *     revisado por humano (RN10), SLA e VRS — o mesmo caminho do DAST.
 *  4. COMPARAR — o que apareceu, o que persiste e o que sumiu desde a
 *     importação anterior (inclusive quais promovidas podem ter sido corrigidas).
 *
 * OWNERSHIP E TENANCY
 * Diferente do DAST (silo por usuário, ADR-029), a importação nasce DENTRO
 * de um Project: companyId e applicationId são herdados dele, nunca lidos do
 * request (SEC2). Pode importar, ver, triar e promover: ADMIN, ou o PENTESTER
 * membro do projeto — a mesma regra de escrita de Vulnerability. CLIENT não
 * vê achados não triados (o mesmo motivo do silo DAST: ruído de ferramenta
 * não é finding do produto até um humano dizer que é).
 */

import type { DastTriageStatus, Project, Vulnerability } from "@prisma/client";
import type {
  CodeFindingWithRelations,
  CodeScanImportWithUploader,
  CodeScanRepository,
  CreateCodeFindingData,
} from "../repositories/code-scan.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { ApplicationRepository } from "../repositories/application.repository";
import type { SlaPolicyService } from "./sla-policy.service";
import type { UserRole } from "../models/user.model";
import {
  emptySeverityCounts,
  toFindingResponse,
  toImportResponse,
  type CodeFindingResponseDTO,
  type CodeScanImportResponseDTO,
  type PromotedVulnerabilityRef,
} from "../models/code-scan.model";
import {
  CODE_SEVERITY_ORDER,
  buildCodePromotionDraft,
  parseCodeReport,
  type CodePromotionDraft,
  type CodeSeverity,
} from "../utils/code-import.util";
import { owaspCategoryForCwe } from "../utils/dast-promotion.util";
import { calculateCvss } from "../utils/cvss.util";
import { computeSlaCycle } from "../utils/sla.util";
import { calcularVrs } from "../utils/vrs.util";

interface Actor {
  userId: string;
  role: UserRole;
}

const TRIAGE_STATUSES: DastTriageStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "ACCEPTED_RISK"];

export interface ImportFileInput {
  originalName: string;
  buffer: Buffer;
}

export interface CodeTriageDTO {
  triageStatus: DastTriageStatus;
  note?: string | null;
}

export interface CodePromoteDTO {
  title: string;
  description: string;
  owaspCategory: string;
  cvssVector: string;
  impact?: string;
  recommendation?: string;
}

export interface CodeComparisonEntry {
  fingerprint: string;
  title: string;
  severity: CodeSeverity;
  category: string;
  location: string | null;
  promotedVulnerability: PromotedVulnerabilityRef | null;
}

export interface CodeImportComparison {
  headImport: CodeScanImportResponseDTO;
  baseImport: CodeScanImportResponseDTO | null;
  introduced: CodeComparisonEntry[];
  persisted: CodeComparisonEntry[];
  /** Sumiu do relatório novo. Se foi promovido, a Vulnerability é candidata a reteste/FIXED — decisão humana. */
  resolved: CodeComparisonEntry[];
}

export class CodeScanService {
  constructor(
    private readonly repository: CodeScanRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly slaPolicyService: SlaPolicyService,
    private readonly applicationRepository: ApplicationRepository,
  ) {}

  // ==========================================================================
  // 1. Importação
  // ==========================================================================

  async importReport(actor: Actor, projectId: string | undefined, file: ImportFileInput | undefined): Promise<CodeScanImportResponseDTO> {
    if (!projectId) throw new Error("MISSING_PROJECT_ID");
    if (!file || file.buffer.length === 0) throw new Error("MISSING_FILE");

    const project = await this.getAccessibleProject(actor, projectId);
    const report = parseCodeReport(file.buffer.toString("utf8"));

    const baseline = await this.repository.findLatestComparable(project.id, report.format, report.toolName);
    const baseFindings = baseline ? await this.repository.findSummariesByImport(baseline.id) : [];
    const baseByFingerprint = new Map(baseFindings.map((f) => [f.fingerprint, f]));
    const newFingerprints = new Set(report.findings.map((f) => f.fingerprint));

    let persisted = 0;
    const rows: CreateCodeFindingData[] = report.findings.map((f) => {
      const anterior = baseByFingerprint.get(f.fingerprint);
      if (anterior) persisted++;
      // Herda só triagem de fato feita: NEW não é decisão, é ausência dela.
      const herda = anterior && anterior.triageStatus !== "NEW";
      return {
        ...f,
        projectId: project.id,
        companyId: project.companyId, // herdado do Project (SEC2)
        triageStatus: herda ? anterior.triageStatus : "NEW",
        triageNote: herda ? anterior.triageNote : null,
        triagedById: herda ? anterior.triagedById : null,
        triagedAt: herda ? anterior.triagedAt : null,
        triageInherited: Boolean(herda),
      };
    });
    const resolved = baseFindings.filter((f) => !newFingerprints.has(f.fingerprint)).length;

    const created = await this.repository.createImportWithFindings(
      {
        projectId: project.id,
        companyId: project.companyId,
        format: report.format,
        toolName: report.toolName,
        toolVersion: report.toolVersion,
        fileName: (file.originalName || "relatorio.json").slice(0, 255),
        uploadedById: actor.userId,
        previousImportId: baseline?.id ?? null,
        totalFindings: rows.length,
        newFindings: rows.length - persisted,
        persistedFindings: persisted,
        resolvedFindings: resolved,
        componentsCount: report.componentsCount,
        warningMessage: report.warnings.length > 0 ? report.warnings.join("\n") : null,
      },
      rows,
    );

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: project.companyId,
      entityType: "CodeScanImport",
      entityId: created.id,
      action: "CREATE",
      diffJson: JSON.stringify({
        projectId: project.id,
        format: report.format,
        toolName: report.toolName,
        total: rows.length,
        new: rows.length - persisted,
        persisted,
        resolved,
      }),
    });

    return (await this.withSeverityCounts([created]))[0];
  }

  /** Sem projectId: a página global "SAST/SCA" — importações de todos os projetos visíveis ao ator. */
  async listImports(actor: Actor, projectId: string | undefined): Promise<CodeScanImportResponseDTO[]> {
    if (!projectId) {
      if (actor.role !== "ADMIN" && actor.role !== "PENTESTER") throw new Error("FORBIDDEN");
      const visible = await this.repository.listImportsVisibleTo(actor.userId, actor.role === "ADMIN");
      return this.withSeverityCounts(visible);
    }
    const project = await this.getAccessibleProject(actor, projectId);
    const imports = await this.repository.listImportsByProject(project.id);
    return this.withSeverityCounts(imports);
  }

  async getImport(actor: Actor, importId: string): Promise<CodeScanImportResponseDTO> {
    return (await this.withSeverityCounts([await this.getAccessibleImport(actor, importId)]))[0];
  }

  /** Achados da importação, do mais grave ao menos grave. */
  async listFindings(actor: Actor, importId: string): Promise<CodeFindingResponseDTO[]> {
    const imp = await this.getAccessibleImport(actor, importId);
    const findings = await this.repository.listFindingsByImport(imp.id);
    const promotions = await this.promotionsByFingerprint(imp.projectId, findings.map((f) => f.fingerprint));

    return findings
      .map((f) => toFindingResponse(f, promotions.get(f.fingerprint)))
      .sort(
        (a, b) =>
          CODE_SEVERITY_ORDER[a.severity] - CODE_SEVERITY_ORDER[b.severity] ||
          (a.filePath ?? a.packageName ?? "").localeCompare(b.filePath ?? b.packageName ?? "") ||
          (a.startLine ?? 0) - (b.startLine ?? 0),
      );
  }

  /**
   * Tudo que o PDF da importação precisa numa chamada (como o /report/data do
   * DAST): cabeçalho, achados com triagem e o que sumiu desde a anterior. O
   * recorte do que entra no PDF (ex.: falsos-positivos só contados) é decisão
   * de apresentação e fica no gerador do PDF, não aqui.
   */
  async getReportData(actor: Actor, importId: string): Promise<{
    import: CodeScanImportResponseDTO;
    findings: CodeFindingResponseDTO[];
    resolved: CodeComparisonEntry[];
    generatedAt: string;
  }> {
    const findings = await this.listFindings(actor, importId);
    const comparison = await this.compare(actor, importId);
    return { import: comparison.headImport, findings, resolved: comparison.resolved, generatedAt: new Date().toISOString() };
  }

  // ==========================================================================
  // 2. Triagem
  // ==========================================================================

  async triage(actor: Actor, findingId: string, dto: CodeTriageDTO): Promise<CodeFindingResponseDTO> {
    if (!dto.triageStatus) throw new Error("MISSING_TRIAGE_STATUS");
    if (!TRIAGE_STATUSES.includes(dto.triageStatus)) throw new Error("INVALID_TRIAGE_STATUS");
    const note = typeof dto.note === "string" ? dto.note.trim() : "";
    if (note.length > 2000) throw new Error("INVALID_TRIAGE_NOTE");

    const finding = await this.getAccessibleFinding(actor, findingId);
    const updated = await this.repository.updateTriage(finding.id, {
      triageStatus: dto.triageStatus,
      triageNote: note.length > 0 ? note : null,
      triagedById: actor.userId,
      triagedAt: new Date(),
    });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: finding.companyId,
      entityType: "CodeFinding",
      entityId: finding.id,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: finding.triageStatus, to: dto.triageStatus }),
    });

    const promotions = await this.promotionsByFingerprint(updated.projectId, [updated.fingerprint]);
    return toFindingResponse(updated, promotions.get(updated.fingerprint));
  }

  // ==========================================================================
  // 3. Promoção
  // ==========================================================================

  async getPromotionDraft(
    actor: Actor,
    findingId: string,
  ): Promise<CodePromotionDraft & { alreadyPromotedTo: string | null }> {
    const finding = await this.getAccessibleFinding(actor, findingId);
    const imp = await this.repository.findImportById(finding.importId);
    const draft = buildCodePromotionDraft(
      finding as Parameters<typeof buildCodePromotionDraft>[0],
      { toolName: imp?.toolName ?? "ferramenta", fileName: imp?.fileName ?? "relatório" },
      owaspCategoryForCwe,
      (vector) => {
        try {
          calculateCvss(vector);
          return true;
        } catch {
          return false;
        }
      },
    );
    const promotion = await this.existingPromotion(finding);
    return { ...draft, alreadyPromotedTo: promotion?.id ?? null };
  }

  async promote(actor: Actor, findingId: string, dto: CodePromoteDTO): Promise<Vulnerability> {
    const finding = await this.getAccessibleFinding(actor, findingId);

    // Dedup ENTRE importações: o mesmo fingerprint já promovido a partir de
    // uma importação anterior do projeto também conta (o UNIQUE do banco só
    // cobre o mesmo CodeFinding).
    if (await this.existingPromotion(finding)) throw new Error("FINDING_ALREADY_PROMOTED");

    if (!dto.title?.trim()) throw new Error("MISSING_TITLE");
    if (!dto.description?.trim()) throw new Error("MISSING_DESCRIPTION");
    if (!dto.owaspCategory?.trim()) throw new Error("MISSING_OWASP_CATEGORY");
    if (!/^A(0[1-9]|10)$/.test(dto.owaspCategory.trim())) throw new Error("INVALID_OWASP_CATEGORY");
    if (!dto.cvssVector?.trim()) throw new Error("MISSING_CVSS_VECTOR");

    const project = await this.projectRepository.findById(finding.projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");

    // RN10: o score sai do vetor que o humano confirmou na tela.
    const { score, severity } = calculateCvss(dto.cvssVector.trim());

    // SLA começa na PROMOÇÃO — antes da triagem humana não era finding do produto.
    const agora = new Date();
    const politica = await this.slaPolicyService.resolveFor(project.companyId);
    const ciclo = computeSlaCycle(agora, politica.window, severity);

    const application = await this.applicationRepository.findById(project.applicationId);
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

    const sourceType = finding.category === "SCA" ? "SCA_IMPORT" : "SAST_IMPORT";
    let created: Vulnerability;
    try {
      created = await this.vulnerabilityRepository.create({
        projectId: project.id,
        applicationId: project.applicationId, // RN09
        companyId: project.companyId, // RN09
        createdBy: actor.userId,
        title: dto.title.trim().slice(0, 191),
        description: dto.description.trim(),
        owaspCategory: dto.owaspCategory.trim(),
        cvssVector: dto.cvssVector.trim(),
        cvssScore: score,
        severityCalculated: severity,
        severityFinal: severity,
        impact: dto.impact?.trim() || undefined,
        recommendation: dto.recommendation?.trim() || undefined,
        sourceType,
        sourceCodeFindingId: finding.id,
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
      // Dois cliques simultâneos: o segundo bate no UNIQUE — mesmo 409 do caminho normal.
      if ((error as { code?: string }).code === "P2002") throw new Error("FINDING_ALREADY_PROMOTED");
      throw error;
    }

    // Promover afirma que o achado é real; só sobrescreve a triagem se ela não dizia nada.
    if (finding.triageStatus === "NEW") {
      await this.repository.updateTriage(finding.id, {
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
        sourceType,
        sourceCodeFindingId: finding.id,
        importId: finding.importId,
      }),
    });

    return created;
  }

  // ==========================================================================
  // 4. Comparação com a importação anterior
  // ==========================================================================

  async compare(actor: Actor, importId: string): Promise<CodeImportComparison> {
    const head = await this.getAccessibleImport(actor, importId);
    const base = head.previousImportId ? await this.repository.findImportById(head.previousImportId) : null;

    const [headFindings, baseFindings] = await Promise.all([
      this.repository.findSummariesByImport(head.id),
      base ? this.repository.findSummariesByImport(base.id) : Promise.resolve([]),
    ]);
    const promotions = await this.promotionsByFingerprint(head.projectId, [
      ...headFindings.map((f) => f.fingerprint),
      ...baseFindings.map((f) => f.fingerprint),
    ]);

    const toEntry = (f: (typeof headFindings)[number]): CodeComparisonEntry => ({
      fingerprint: f.fingerprint,
      title: f.title,
      severity: f.severity as CodeSeverity,
      category: f.category,
      location: f.filePath
        ? `${f.filePath}${f.startLine ? `:${f.startLine}` : ""}`
        : f.packageName
          ? `${f.packageName}${f.packageVersion ? `@${f.packageVersion}` : ""}`
          : null,
      promotedVulnerability: promotions.get(f.fingerprint) ?? null,
    });

    const headSet = new Set(headFindings.map((f) => f.fingerprint));
    const baseSet = new Set(baseFindings.map((f) => f.fingerprint));
    const bySeverity = (a: CodeComparisonEntry, b: CodeComparisonEntry) => CODE_SEVERITY_ORDER[a.severity] - CODE_SEVERITY_ORDER[b.severity];

    return {
      headImport: (await this.withSeverityCounts([head]))[0],
      baseImport: base ? (await this.withSeverityCounts([base]))[0] : null,
      introduced: headFindings.filter((f) => !baseSet.has(f.fingerprint)).map(toEntry).sort(bySeverity),
      persisted: headFindings.filter((f) => baseSet.has(f.fingerprint)).map(toEntry).sort(bySeverity),
      resolved: baseFindings.filter((f) => !headSet.has(f.fingerprint)).map(toEntry).sort(bySeverity),
    };
  }

  // ==========================================================================
  // Privados
  // ==========================================================================

  /** ADMIN vê todos; PENTESTER só projeto de que é membro; CLIENT nunca (a rota já barra). */
  private async getAccessibleProject(actor: Actor, projectId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    if (actor.role === "ADMIN") return project;
    if (actor.role !== "PENTESTER") throw new Error("FORBIDDEN");
    const membership = await this.projectMemberRepository.findOne(project.id, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
    return project;
  }

  private async getAccessibleImport(actor: Actor, importId: string) {
    const imp = await this.repository.findImportById(importId);
    if (!imp) throw new Error("IMPORT_NOT_FOUND");
    await this.getAccessibleProject(actor, imp.projectId);
    return imp;
  }

  private async getAccessibleFinding(actor: Actor, findingId: string): Promise<CodeFindingWithRelations> {
    const finding = await this.repository.findFindingById(findingId);
    if (!finding) throw new Error("FINDING_NOT_FOUND");
    await this.getAccessibleProject(actor, finding.projectId);
    return finding;
  }

  private async withSeverityCounts(imports: CodeScanImportWithUploader[]): Promise<CodeScanImportResponseDTO[]> {
    const rows = await this.repository.countSeverities(imports.map((i) => i.id));
    const byImport = new Map<string, Record<CodeSeverity, number>>();
    for (const r of rows) {
      const counts = byImport.get(r.importId) ?? emptySeverityCounts();
      if (r.severity in counts) counts[r.severity as CodeSeverity] = r.count;
      byImport.set(r.importId, counts);
    }
    return imports.map((i) => toImportResponse(i, byImport.get(i.id)));
  }

  private async promotionsByFingerprint(projectId: string, fingerprints: string[]): Promise<Map<string, PromotedVulnerabilityRef>> {
    const rows = await this.repository.findPromotionsByFingerprints(projectId, [...new Set(fingerprints)]);
    return new Map(rows.map((r) => [r.fingerprint, r.vulnerability]));
  }

  private async existingPromotion(finding: CodeFindingWithRelations): Promise<PromotedVulnerabilityRef | null> {
    if (finding.promotedVulnerability) return finding.promotedVulnerability;
    const promotions = await this.promotionsByFingerprint(finding.projectId, [finding.fingerprint]);
    return promotions.get(finding.fingerprint) ?? null;
  }
}
