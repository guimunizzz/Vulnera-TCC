/**
 * remediation-playbook.service.ts
 *
 * O catálogo de remediação (CP-5 — docs/DECISIONS.md D5).
 *
 * ==========================================================================
 * AS TRÊS INVARIANTES
 * ==========================================================================
 *
 * 1. SYSTEM É IMUTÁVEL PARA TODO MUNDO. `isSystem = true` não é editável nem
 *    apagável por ADMIN. Só o script de sync escreve nessas linhas. É o que
 *    garante que "OWASP diz X" continue significando o que a OWASP diz.
 *
 * 2. `isSystem` NUNCA VEM DO CORPO. Todo playbook criado por uma rota nasce
 *    `isSystem: false` com o `companyId` do ator. Aceitar a flag seria dar a
 *    um tenant o poder de publicar um "playbook oficial" falso, visível para
 *    todas as empresas.
 *
 * 3. CLONE É CÓPIA DE VALORES, NÃO HERANÇA. "Duplicar e adaptar" copia o
 *    conteúdo inteiro; `clonedFromId` guarda só a procedência. Uma atualização
 *    futura do System NÃO reescreve o que a empresa adaptou — que é o
 *    esperado, porque ela adaptou de propósito. Mesmo raciocínio do
 *    `sourceDastFindingId` no ADR-032.
 *
 * RBAC (D5)
 *   ler     todos os autenticados — System (global) + custom da própria empresa
 *   criar   ADMIN · PENTESTER      (CLIENT é read-only: playbook é conhecimento
 *   editar  ADMIN · PENTESTER       técnico de remediação, território de quem
 *   apagar  ADMIN · PENTESTER       presta o serviço — e é a superfície de XSS)
 *
 * SANITIZAÇÃO NA ESCRITA: todo campo de Markdown passa por
 * `sanitizeMarkdown` antes de tocar o banco. A renderização sanitiza de novo
 * (marked + DOMPurify); são camadas diferentes, e as duas são necessárias.
 */

import type { RemediationPlaybookRepository, ListPlaybooksFilter } from "../repositories/remediation-playbook.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import {
  PLAYBOOK_FIELD_LIMITS,
  PlaybookEntity,
  type CreatePlaybookDTO,
  type RemediationPlaybook,
  type UpdatePlaybookDTO,
} from "../models/remediation-playbook.model";
import { isSafeExternalUrl, sanitizeMarkdown } from "../utils/markdown-sanitize.util";
import { OWASP_CATEGORIES } from "../models/vulnerability.model";
import type { OwaspReference } from "../utils/owasp-parser.util";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/** O recorte de leitura do ator — resolvido do banco, nunca do token. */
interface EscopoDoAtor {
  companyId: string | null;
  todasAsEmpresas: boolean;
}

export class RemediationPlaybookService {
  constructor(
    private readonly repository: RemediationPlaybookRepository,
    private readonly userRepository: UserRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /* ======================================================================
     Leitura
     ====================================================================== */

  async list(actor: Actor, filtro: { owaspCategory?: string; search?: string; apenasSystem?: boolean; apenasCustom?: boolean }) {
    const escopo = await this.resolverEscopo(actor);
    if (filtro.owaspCategory && !OWASP_CATEGORIES.includes(filtro.owaspCategory as never)) {
      throw new Error("INVALID_OWASP_CATEGORY");
    }
    const f: ListPlaybooksFilter = { ...escopo, ...filtro };
    const registros = await this.repository.list(f);
    return registros.map((p) => new PlaybookEntity(p).toListItem());
  }

  async getById(actor: Actor, id: string) {
    const playbook = await this.repository.findById(id);
    if (!playbook) throw new Error("PLAYBOOK_NOT_FOUND");
    await this.assertCanRead(actor, playbook);
    return new PlaybookEntity(playbook).toResponse();
  }

  /**
   * O bloco "Como corrigir" de um finding: playbooks da categoria OWASP dele.
   * Custom do tenant PRIMEIRO, System depois — a adaptação da casa vale mais
   * que a referência genérica para quem vai corrigir (D5).
   */
  async findForOwaspCategory(actor: Actor, owaspCategory: string, companyIdDoFinding: string) {
    const escopo = await this.resolverEscopo(actor);
    // ADMIN lê o custom da empresa DO FINDING, não de uma empresa qualquer.
    const companyId = escopo.todasAsEmpresas ? companyIdDoFinding : escopo.companyId;
    const registros = await this.repository.findByOwaspCategory(owaspCategory, companyId);
    return registros.map((p) => new PlaybookEntity(p).toListItem());
  }

  /* ======================================================================
     Escrita
     ====================================================================== */

  async create(actor: Actor, dto: CreatePlaybookDTO) {
    const escopo = await this.assertCanWrite(actor);
    const dados = this.normalizarDTO(dto, true);

    const created = await this.repository.create({
      ...dados,
      title: dados.title!,
      // 🎯 `isSystem` e `source` são DECIDIDOS aqui, nunca recebidos.
      source: "CUSTOM",
      isSystem: false,
      companyId: escopo.companyId,
      createdBy: actor.userId,
    });

    await this.audit(actor, created, "CREATE", { title: created.title, owaspCategory: created.owaspCategory });
    return new PlaybookEntity(created).toResponse();
  }

  async update(actor: Actor, id: string, dto: UpdatePlaybookDTO) {
    const playbook = await this.repository.findById(id);
    if (!playbook) throw new Error("PLAYBOOK_NOT_FOUND");
    if (playbook.isSystem) throw new Error("CANNOT_EDIT_SYSTEM_PLAYBOOK");
    await this.assertCanWrite(actor, playbook);

    const dados = this.normalizarDTO(dto, false);
    const updated = await this.repository.update(id, dados);

    await this.audit(actor, updated, "UPDATE", { title: updated.title });
    return new PlaybookEntity(updated).toResponse();
  }

  async delete(actor: Actor, id: string): Promise<void> {
    const playbook = await this.repository.findById(id);
    if (!playbook) throw new Error("PLAYBOOK_NOT_FOUND");
    if (playbook.isSystem) throw new Error("CANNOT_EDIT_SYSTEM_PLAYBOOK");
    await this.assertCanWrite(actor, playbook);

    await this.repository.delete(id);
    await this.audit(actor, playbook, "DELETE", { title: playbook.title });
  }

  /**
   * "Duplicar e adaptar": cópia PROFUNDA do conteúdo para um playbook do
   * tenant. A procedência (`sourceUrl`/`sourceVersion`) é preservada — um
   * clone de conteúdo OWASP é obra derivada, e a CC BY-SA pede atribuição.
   * `source` vira CUSTOM e `sourceKey` é zerado: só o sync usa essa chave, e
   * duas linhas com a mesma `[source, sourceKey]` violariam o unique.
   */
  async clone(actor: Actor, id: string, novoTitulo?: string) {
    const origem = await this.repository.findById(id);
    if (!origem) throw new Error("PLAYBOOK_NOT_FOUND");
    await this.assertCanRead(actor, origem);
    const escopo = await this.assertCanWrite(actor);

    const criado = await this.repository.create({
      title: (novoTitulo?.trim() || `${origem.title} (adaptado)`).slice(0, PLAYBOOK_FIELD_LIMITS.title),
      summary: origem.summary,
      owaspCategory: origem.owaspCategory,
      cweIds: origem.cweIds,
      rootCause: origem.rootCause,
      remediation: origem.remediation,
      validationSteps: origem.validationSteps,
      secureExample: origem.secureExample,
      compensatingControls: origem.compensatingControls,
      references: origem.references,
      source: "CUSTOM",
      sourceUrl: origem.sourceUrl, // procedência preservada (CC BY-SA)
      sourceVersion: origem.sourceVersion,
      sourceKey: null, // só o sync usa; o unique [source, sourceKey] exige null aqui
      isSystem: false,
      companyId: escopo.companyId,
      clonedFromId: origem.id,
      createdBy: actor.userId,
    });

    await this.audit(actor, criado, "PLAYBOOK_CLONED", {
      fromId: origem.id,
      fromSource: origem.source,
      fromIsSystem: origem.isSystem,
      newId: criado.id,
    });
    return new PlaybookEntity(criado).toResponse();
  }

  /* ======================================================================
     Validação e normalização
     ====================================================================== */

  /**
   * Valida tamanhos, sanitiza o Markdown e serializa os arrays.
   * `exigirTitulo` distingue create (título obrigatório) de update (parcial).
   */
  private normalizarDTO(dto: CreatePlaybookDTO | UpdatePlaybookDTO, exigirTitulo: boolean) {
    if (exigirTitulo || dto.title !== undefined) {
      const t = (dto.title ?? "").trim();
      if (!t || t.length > PLAYBOOK_FIELD_LIMITS.title) throw new Error("INVALID_TITLE");
    }
    if (dto.owaspCategory != null && !OWASP_CATEGORIES.includes(dto.owaspCategory as never)) {
      throw new Error("INVALID_OWASP_CATEGORY");
    }

    const out: Record<string, unknown> = {};
    if (dto.title !== undefined) out.title = dto.title!.trim();
    if (dto.owaspCategory !== undefined) out.owaspCategory = dto.owaspCategory;

    for (const campo of ["summary", "rootCause", "remediation", "validationSteps", "secureExample", "compensatingControls"] as const) {
      const bruto = dto[campo];
      if (bruto === undefined) continue;
      if (bruto === null) {
        out[campo] = null;
        continue;
      }
      const teto = campo === "summary" ? PLAYBOOK_FIELD_LIMITS.summary : PLAYBOOK_FIELD_LIMITS.text;
      if (typeof bruto !== "string" || bruto.length > teto) throw new Error("INVALID_PLAYBOOK_CONTENT");
      // 🎯 sanitiza ANTES do banco — o que não entra não vaza depois
      out[campo] = sanitizeMarkdown(bruto).value || null;
    }

    if (dto.cweIds !== undefined) {
      if (dto.cweIds === null) out.cweIds = null;
      else {
        if (!Array.isArray(dto.cweIds) || dto.cweIds.length > PLAYBOOK_FIELD_LIMITS.maxCwes) throw new Error("INVALID_CWE_IDS");
        const limpos = dto.cweIds.map((c) => String(c).replace(/^CWE-/i, "").trim()).filter((c) => /^\d{1,5}$/.test(c));
        out.cweIds = JSON.stringify(limpos);
      }
    }

    if (dto.references !== undefined) {
      if (dto.references === null) out.references = null;
      else {
        if (!Array.isArray(dto.references) || dto.references.length > PLAYBOOK_FIELD_LIMITS.maxReferences) {
          throw new Error("INVALID_REFERENCES");
        }
        // Só https e com título — uma referência que não se pode clicar com
        // segurança não deveria estar no catálogo.
        const limpas: OwaspReference[] = [];
        for (const r of dto.references) {
          if (!r || typeof r.url !== "string" || !isSafeExternalUrl(r.url)) throw new Error("INVALID_REFERENCES");
          limpas.push({ title: String(r.title ?? r.url).slice(0, 200), url: r.url });
        }
        out.references = JSON.stringify(limpas);
      }
    }

    return out as { title?: string } & Record<string, unknown>;
  }

  /* ======================================================================
     Controle de acesso
     ====================================================================== */

  private async resolverEscopo(actor: Actor): Promise<EscopoDoAtor> {
    if (actor.role === "ADMIN") return { companyId: null, todasAsEmpresas: true };
    const user = await this.userRepository.findById(actor.userId);
    return { companyId: user?.companyId ?? null, todasAsEmpresas: false };
  }

  /** System é global; custom só da própria empresa. */
  private async assertCanRead(actor: Actor, playbook: RemediationPlaybook): Promise<void> {
    if (playbook.isSystem) return;
    if (actor.role === "ADMIN") return;
    const user = await this.userRepository.findById(actor.userId);
    if (user?.companyId && user.companyId === playbook.companyId) return;
    throw new Error("FORBIDDEN");
  }

  /**
   * ADMIN e PENTESTER escrevem; CLIENT é read-only (D5). Quando há um
   * playbook alvo, o custom precisa ser da empresa do ator.
   *
   * ⚠️ PENTESTER sem `companyId` cria playbook GLOBAL de tenant nenhum
   * (`companyId: null` com `isSystem: false`) — que ninguém além de ADMIN
   * enxergaria. Recusar é mais honesto que criar algo invisível.
   */
  private async assertCanWrite(actor: Actor, playbook?: RemediationPlaybook): Promise<EscopoDoAtor> {
    if (actor.role === "CLIENT") throw new Error("FORBIDDEN");
    const escopo = await this.resolverEscopo(actor);

    if (playbook) {
      if (actor.role !== "ADMIN" && playbook.companyId !== escopo.companyId) throw new Error("FORBIDDEN");
      return escopo;
    }
    if (actor.role !== "ADMIN" && !escopo.companyId) throw new Error("USER_HAS_NO_COMPANY");
    return escopo;
  }

  private async audit(actor: Actor, p: RemediationPlaybook, action: string, diff: Record<string, unknown>): Promise<void> {
    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: p.companyId,
      entityType: "RemediationPlaybook",
      entityId: p.id,
      action,
      diffJson: JSON.stringify(diff),
    });
  }
}
