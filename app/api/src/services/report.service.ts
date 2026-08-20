/**
 * report.service.ts
 *
 * Duas responsabilidades bem separadas:
 *
 * 1. getReportData — monta o JSON consolidado que o frontend usa pra desenhar
 *    o PDF com pdf-lib (client-side, ADR-003 — "PDF gerado no cliente"). Não
 *    é uma entidade do banco: é uma projeção computada na hora da chamada a
 *    partir de Project/Application/Company/Vulnerability/Evidence/
 *    VulnerabilityComment. O PDF em si NUNCA passa pelo servidor.
 *
 * 2. generate/listByProject — CRUD do metadado Report (histórico de "quem
 *    gerou o quê, quando"). Toda geração grava AuditLog REPORT_GENERATED.
 *
 * RN18 — relatório só pode ser gerado com Project em IN_REVIEW ou COMPLETED
 * ("Relatórios exigem Project em IN_REVIEW ou superior"). Validado nos dois
 * pontos (getReportData E generate): report-data é o primeiro passo do
 * próprio fluxo de geração (busca dados → desenha PDF → registra metadado) —
 * hoje não existe nenhum outro consumidor do endpoint, então bloquear cedo
 * evita adiantar dados de uma análise ainda não consolidada.
 *
 * Visibilidade (quem VÊ): mesma regra de Vulnerability/Project — ADMIN vê
 * tudo, CLIENT só a própria company (RN16), PENTESTER só projeto onde é
 * membro (RN17).
 *
 * Quem GERA: ADMIN, PENTESTER-membro OU CLIENT da company — diferente da
 * escrita de Vulnerability (lá o CLIENT é sempre read-only). Aqui o CLIENT
 * entra porque, sendo o PDF gerado no browser, "gerar" e "baixar" são o
 * mesmo clique — e a Matriz de Permissões lista "baixar relatório" como ação
 * do Client Owner/Member. Por isso generate() reusa o mesmo assertCanAccess
 * de leitura, não um assertCanWrite separado.
 */

import type { ProjectRepository } from "../repositories/project.repository";
import type { ApplicationRepository } from "../repositories/application.repository";
import type { CompanyRepository } from "../repositories/company.repository";
import type { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import type { EvidenceRepository } from "../repositories/evidence.repository";
import type { VulnerabilityCommentRepository } from "../repositories/vulnerability-comment.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { ReportRepository } from "../repositories/report.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { MaturityRepository } from "../repositories/maturity.repository";
import { ProjectEntity } from "../models/project.model";
import { CompanyEntity } from "../models/company.model";
import { ApplicationEntity } from "../models/application.model";
import { VulnerabilityEntity } from "../models/vulnerability.model";
import { EvidenceEntity } from "../models/evidence.model";
import {
  ReportEntity,
  type ReportDataDTO,
  type ReportStatsDTO,
  type ReportVulnerabilityDTO,
  type ReportType,
  type ReportMaturityDTO,
} from "../models/report.model";
import type { Project } from "@prisma/client";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "FIXED", "CLOSED"] as const;
const OWASP_CATEGORIES = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"];

export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly applicationRepository: ApplicationRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly evidenceRepository: EvidenceRepository,
    private readonly commentRepository: VulnerabilityCommentRepository,
    private readonly userRepository: UserRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly maturityRepository: MaturityRepository,
  ) {}

  async getReportData(actor: Actor, projectId: string): Promise<ReportDataDTO> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    await this.assertCanAccess(actor, project);
    this.assertProjectReady(project);

    const [application, company, vulnerabilities] = await Promise.all([
      this.applicationRepository.findById(project.applicationId),
      this.companyRepository.findById(project.companyId),
      this.vulnerabilityRepository.findByProject(projectId),
    ]);
    if (!application) throw new Error("APPLICATION_NOT_FOUND");
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const [evidencesByVuln, commentsByVuln] = await Promise.all([
      Promise.all(vulnerabilities.map((v) => this.evidenceRepository.findByVulnerability(v.id))),
      Promise.all(vulnerabilities.map((v) => this.commentRepository.findAllByVulnerability(v.id))),
    ]);

    // Nomes de autor/responsável resolvidos em UMA query batch (UserRepository.findByIds)
    // em vez de um findById por finding/comentário — evita N+1 grosseiro no relatório técnico.
    const userIds = new Set<string>();
    vulnerabilities.forEach((v) => {
      userIds.add(v.createdBy);
      if (v.assignedTo) userIds.add(v.assignedTo);
    });
    commentsByVuln.flat().forEach((c) => userIds.add(c.authorId));

    const users = await this.userRepository.findByIds(Array.from(userIds));
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const nameOf = (id: string): string => nameById.get(id) ?? "Usuário removido";

    const reportVulnerabilities: ReportVulnerabilityDTO[] = vulnerabilities.map((v, idx) => ({
      ...new VulnerabilityEntity(v).toResponse(),
      createdByName: nameOf(v.createdBy),
      evidences: evidencesByVuln[idx].map((e) => new EvidenceEntity(e).toResponse()),
      comments: commentsByVuln[idx].map((c) => ({
        id: c.id,
        authorId: c.authorId,
        authorName: nameOf(c.authorId),
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      })),
    }));

    const stats = this.computeStats(reportVulnerabilities);
    const topRisks = [...reportVulnerabilities]
      .sort((a, b) => (b.cvssScore ?? 0) - (a.cvssScore ?? 0))
      .slice(0, 5);

    const maturity = await this.buildMaturitySection(project.companyId);

    return {
      project: new ProjectEntity(project).toResponse(),
      company: new CompanyEntity(company).toResponse(),
      application: new ApplicationEntity(application).toResponse(),
      vulnerabilities: reportVulnerabilities,
      stats,
      topRisks,
      maturity,
    };
  }

  /**
   * Fase 8 — seção de maturidade do relatório executivo. null quando a
   * company ainda não tem nenhuma avaliação (empresa nova, admin não
   * preencheu ainda) — o PDF mostra um aviso condicional nesse caso.
   * overallScore/level vêm PRONTOS do assessment (já calculados e persistidos
   * por MaturityService.submitScores) — aqui só agrupamos os scores por
   * domínio pra tirar a média simples de cada um (não existe no banco).
   */
  private async buildMaturitySection(companyId: string): Promise<ReportMaturityDTO | null> {
    const assessment = await this.maturityRepository.findLatestByCompanyWithDomains(companyId);
    if (!assessment || assessment.scores.length === 0) return null;

    const scoresByDomain = new Map<string, { domainName: string; scores: number[] }>();
    for (const s of assessment.scores) {
      const domain = s.control.domain;
      const entry = scoresByDomain.get(domain.id) ?? { domainName: domain.name, scores: [] };
      entry.scores.push(s.score);
      scoresByDomain.set(domain.id, entry);
    }

    const domains = Array.from(scoresByDomain.entries()).map(([domainId, { domainName, scores }]) => ({
      domainId,
      domainName,
      average: Math.round((scores.reduce((sum, v) => sum + v, 0) / scores.length) * 100) / 100,
    }));

    return {
      overallScore: assessment.overallScore,
      level: assessment.level,
      evaluatedAt: assessment.createdAt.toISOString(),
      domains,
    };
  }

  async generate(actor: Actor, projectId: string, type: ReportType): Promise<ReportEntity> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    await this.assertCanAccess(actor, project);
    this.assertProjectReady(project);

    const titlePrefix = type === "EXECUTIVE" ? "Relatório Executivo" : "Relatório Técnico";
    const created = await this.repository.create({
      projectId,
      type,
      title: `${titlePrefix} — ${project.name}`,
      generatedBy: actor.userId,
    });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: project.companyId,
      entityType: "Report",
      entityId: created.id,
      action: "REPORT_GENERATED",
      diffJson: JSON.stringify({ type, projectId }),
    });

    return new ReportEntity(created);
  }

  async listByProject(actor: Actor, projectId: string): Promise<ReportEntity[]> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    await this.assertCanAccess(actor, project);

    const reports = await this.repository.findByProject(projectId);
    return reports.map((r) => new ReportEntity(r));
  }

  private computeStats(vulns: ReportVulnerabilityDTO[]): ReportStatsDTO {
    const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as ReportStatsDTO["bySeverity"];
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as ReportStatsDTO["byStatus"];
    const byOwasp = Object.fromEntries(OWASP_CATEGORIES.map((o) => [o, 0]));

    for (const v of vulns) {
      const severityKey = v.severityFinal as keyof ReportStatsDTO["bySeverity"];
      const statusKey = v.status as keyof ReportStatsDTO["byStatus"];
      bySeverity[severityKey] = (bySeverity[severityKey] ?? 0) + 1;
      byStatus[statusKey] = (byStatus[statusKey] ?? 0) + 1;
      byOwasp[v.owaspCategory] = (byOwasp[v.owaspCategory] ?? 0) + 1;
    }

    return { total: vulns.length, bySeverity, byStatus, byOwasp };
  }

  /** RN18 — "Relatórios exigem Project em IN_REVIEW ou superior". */
  private assertProjectReady(project: Project): void {
    if (project.status !== "IN_REVIEW" && project.status !== "COMPLETED") {
      throw new Error("PROJECT_NOT_READY_FOR_REPORT");
    }
  }

  /** RN16 (CLIENT) + RN17 (PENTESTER via ProjectMember) — mesma regra do Project/Vulnerability. */
  private async assertCanAccess(actor: Actor, project: Project): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === project.companyId) return;
      throw new Error("FORBIDDEN");
    }
    const membership = await this.projectMemberRepository.findOne(project.id, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
  }
}
