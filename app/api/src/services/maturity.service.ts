/**
 * maturity.service.ts
 *
 * Checklist simplificado (decisão de 2026-08-03): domínio → pergunta →
 * resposta 1-5. SEM scoring ponderado, SEM nível por domínio, SEM
 * comparativo histórico — só a média simples de todos os scores da
 * avaliação, recalculada a cada batch de respostas.
 *
 * RN19 — só ADMIN cria assessment e grava score (`assertCanWrite` implícito
 * no próprio método, não precisou de helper — só duas escritas no
 * service inteiro). CLIENT da company e PENTESTER atribuído a algum
 * projeto da company só leem (`assertCanView`).
 */

import type { MaturityRepository } from "../repositories/maturity.repository";
import type { CompanyRepository } from "../repositories/company.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import {
  MaturityAssessmentEntity,
  MaturityCatalogEntity,
  type MaturityDomainResponseDTO,
  type MaturityLevel,
  type ScoreInputDTO,
} from "../models/maturity.model";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/** Corte simples (não é fórmula ponderada) — 1-3 "ainda não", 4-5 "sim". */
function levelFromAverage(average: number): MaturityLevel {
  if (average >= 4) return "ADVANCED";
  if (average >= 2.5) return "INTERMEDIATE";
  return "BASIC";
}

export class MaturityService {
  constructor(
    private readonly repository: MaturityRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly userRepository: UserRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
  ) {}

  async getCatalog(): Promise<MaturityDomainResponseDTO[]> {
    const domains = await this.repository.findCatalog();
    return MaturityCatalogEntity.toResponse(domains);
  }

  /** RN19 — cria avaliação VAZIA (sem scores ainda) para uma company. */
  async createAssessment(actor: Actor, companyId: string): Promise<MaturityAssessmentEntity> {
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");

    const company = await this.companyRepository.findById(companyId);
    if (!company) throw new Error("COMPANY_NOT_FOUND");

    const created = await this.repository.createAssessment(companyId, actor.userId);
    const withScores = await this.repository.findAssessmentById(created.id);
    return new MaturityAssessmentEntity(withScores!);
  }

  /** RN19 — batch de respostas; recalcula a média geral (simples) a cada chamada. */
  async submitScores(actor: Actor, assessmentId: string, scores: ScoreInputDTO[]): Promise<MaturityAssessmentEntity> {
    if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");

    const assessment = await this.repository.findAssessmentById(assessmentId);
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    for (const item of scores) {
      const control = await this.repository.findControlById(item.controlId);
      if (!control) throw new Error("CONTROL_NOT_FOUND");
      if (!Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
        throw new Error("INVALID_SCORE_VALUE");
      }

      // Corte fixo — não é cálculo, é a leitura óbvia de uma escala 1-5.
      const isCompliant = item.score >= 4;
      await this.repository.upsertScore(assessmentId, item.controlId, item.score, isCompliant, item.notes);
    }

    const updated = await this.repository.findAssessmentById(assessmentId);
    const allScores = updated!.scores;
    const overallScore =
      allScores.length > 0
        ? Math.round((allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length) * 100) / 100
        : 0;
    const level = levelFromAverage(overallScore);

    await this.repository.updateAssessmentAverage(assessmentId, overallScore, level);
    const finalAssessment = await this.repository.findAssessmentById(assessmentId);
    return new MaturityAssessmentEntity(finalAssessment!);
  }

  /** RN16/RN19 (CLIENT) + RN17/RN19-like (PENTESTER atribuído). */
  async getLatestByCompany(actor: Actor, companyId: string): Promise<MaturityAssessmentEntity> {
    await this.assertCanView(actor, companyId);

    const latest = await this.repository.findLatestByCompany(companyId);
    if (!latest) throw new Error("ASSESSMENT_NOT_FOUND");
    return new MaturityAssessmentEntity(latest);
  }

  private async assertCanView(actor: Actor, companyId: string): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === companyId) return;
      throw new Error("FORBIDDEN");
    }
    // PENTESTER — RN19 "atribuídos": membro de ao menos um projeto da company.
    const isMember = await this.projectMemberRepository.existsForUserInCompany(actor.userId, companyId);
    if (!isMember) throw new Error("FORBIDDEN");
  }
}
