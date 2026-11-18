/**
 * dast-schedule.service.ts
 *
 * Autorização de DAST por aplicação e scans DAST agendados (ADR-056 §6/§7).
 *
 * QUEM PODE
 *  - ler (autorização e agendamentos): ADMIN; PENTESTER membro de algum
 *    projeto da aplicação; CLIENT da própria empresa (somente leitura).
 *    Qualquer outro → 404 (não revela que a aplicação existe).
 *  - escrever: ADMIN; PENTESTER membro de um projeto da aplicação. CLIENT da
 *    empresa → 403 (ele vê, mas não muda).
 *  - PENTESTER precisa informar o projeto (de que é membro) ao agendar; ADMIN
 *    pode omitir. O companyId vem SEMPRE da Application (SEC2).
 *
 * EXECUÇÃO (worker bullmq)
 *  Tudo é reconferido no momento do disparo, não só no cadastro: agendamento
 *  habilitado, aplicação ativa e da mesma empresa, autorização vigente para o
 *  mesmo host, criador ainda ADMIN/PENTESTER e (PENTESTER) ainda membro, e
 *  nenhum scan ativo no alvo. Falhou: não roda, grava `lastOutcome`, notifica
 *  o criador e registra AuditLog. Passou: cria o scan pelo caminho de sempre.
 *
 *  ⚠️ Com QUEUE_DRIVER=memory NÃO há execução agendada (não há relógio): o
 *  CRUD funciona, a reconciliação devolve null e isso é logado.
 */

import type { Application, ScanSchedule } from "@prisma/client";
import type { ApplicationRepository } from "../repositories/application.repository";
import type { ScanScheduleRepository } from "../repositories/scan-schedule.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { NotificationRepository } from "../repositories/notification.repository";
import type { JobQueue } from "./queue/job-queue";
import type { DastScanService } from "./dast-scan.service";
import type { DastScan } from "../models/dast-scan.model";
import type { UserRole } from "../models/user.model";
import {
  FUSO_PADRAO,
  MODOS,
  gerarPadraoCron,
  motivoSemAutorizacao,
  normalizarHost,
  validarCampos,
  type CamposAgendamento,
  type Modo,
} from "../utils/dast-schedule.util";

interface Actor {
  userId: string;
  role: UserRole;
}

/** Teto da autorização: um ano. Autorização sem fim seria uma permissão esquecida. */
const MAX_AUTORIZACAO_MS = 366 * 24 * 3600_000;

export interface AutorizacaoDastDTO {
  applicationId: string;
  authorizedAt: string | null;
  authorizedById: string | null;
  until: string | null;
  host: string | null;
  /** Host atual da URL da aplicação (o que a autorização precisa casar). */
  currentHost: string | null;
  /** null = vigente; senão o motivo (AUTHORIZATION_MISSING/EXPIRED, HOST_MISMATCH, APPLICATION_WITHOUT_URL). */
  problem: string | null;
  canEdit: boolean;
}

export interface AgendamentoDTO {
  id: string;
  applicationId: string;
  companyId: string;
  projectId: string | null;
  mode: Modo;
  frequency: string;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  timezone: string;
  enabled: boolean;
  createdById: string;
  lastRunAt: string | null;
  lastScanId: string | null;
  lastOutcome: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CriarAgendamentoInput extends Partial<CamposAgendamento> {
  mode?: unknown;
  projectId?: unknown;
  enabled?: unknown;
}

const toDTO = (s: ScanSchedule): AgendamentoDTO => ({
  id: s.id,
  applicationId: s.applicationId,
  companyId: s.companyId,
  projectId: s.projectId,
  mode: s.mode,
  frequency: s.frequency,
  hour: s.hour,
  minute: s.minute,
  dayOfWeek: s.dayOfWeek,
  timezone: s.timezone,
  enabled: s.enabled,
  createdById: s.createdById,
  lastRunAt: s.lastRunAt?.toISOString() ?? null,
  lastScanId: s.lastScanId,
  lastOutcome: s.lastOutcome,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export class DastScheduleService {
  private avisouMemoria = false;

  constructor(
    private readonly applications: Pick<ApplicationRepository, "findById" | "setDastAuthorization">,
    private readonly schedules: ScanScheduleRepository,
    private readonly projects: Pick<ProjectRepository, "findById">,
    private readonly members: Pick<ProjectMemberRepository, "findOne" | "existsForUserInApplication">,
    private readonly users: Pick<UserRepository, "findById">,
    private readonly auditLog: Pick<AuditLogRepository, "create">,
    private readonly notifications: Pick<NotificationRepository, "criarVarias">,
    private readonly fila: Pick<JobQueue, "aplicarAgendamentosDast">,
    private readonly scans: Pick<DastScanService, "criarAgendado">,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  // ==========================================================================
  // Autorização do alvo
  // ==========================================================================

  async autorizacao(actor: Actor, applicationId: string): Promise<AutorizacaoDastDTO> {
    const app = await this.appParaLeitura(actor, applicationId);
    return this.autorizacaoDTO(app, await this.podeEscrever(actor, app));
  }

  async autorizar(actor: Actor, applicationId: string, body: { until?: unknown }): Promise<AutorizacaoDastDTO> {
    const app = await this.appParaEscrita(actor, applicationId);
    if (!app.isActive) throw new Error("APPLICATION_NOT_FOUND");
    const host = normalizarHost(app.url);
    if (!host) throw new Error("APPLICATION_WITHOUT_URL");
    const until = typeof body.until === "string" ? new Date(body.until) : null;
    const agora = this.agora();
    if (!until || Number.isNaN(until.getTime()) || until.getTime() <= agora.getTime() || until.getTime() - agora.getTime() > MAX_AUTORIZACAO_MS) {
      throw new Error("INVALID_UNTIL");
    }
    const antes = this.resumoAutorizacao(app);
    const atualizada = await this.applications.setDastAuthorization(app.id, {
      dastAuthorizedAt: agora,
      dastAuthorizedById: actor.userId,
      dastAuthorizedUntil: until,
      dastAuthorizedHost: host,
    });
    await this.auditar(actor.userId, app.companyId, "Application", app.id, "DAST_AUTHORIZATION_GRANTED", { antes, depois: this.resumoAutorizacao(atualizada) });
    return this.autorizacaoDTO(atualizada, true);
  }

  async revogar(actor: Actor, applicationId: string): Promise<AutorizacaoDastDTO> {
    const app = await this.appParaEscrita(actor, applicationId);
    const antes = this.resumoAutorizacao(app);
    const atualizada = await this.applications.setDastAuthorization(app.id, {
      dastAuthorizedAt: null,
      dastAuthorizedById: null,
      dastAuthorizedUntil: null,
      dastAuthorizedHost: null,
    });
    await this.auditar(actor.userId, app.companyId, "Application", app.id, "DAST_AUTHORIZATION_REVOKED", { antes });
    return this.autorizacaoDTO(atualizada, true);
  }

  // ==========================================================================
  // CRUD de agendamentos
  // ==========================================================================

  async listar(actor: Actor, applicationId: string): Promise<AgendamentoDTO[]> {
    const app = await this.appParaLeitura(actor, applicationId);
    return (await this.schedules.findByApplication(app.id)).map(toDTO);
  }

  async criar(actor: Actor, applicationId: string, body: CriarAgendamentoInput): Promise<AgendamentoDTO> {
    const app = await this.appParaEscrita(actor, applicationId);
    this.exigirAlvoAutorizado(app);

    if (!MODOS.includes(body.mode as Modo)) throw new Error("INVALID_MODE");
    const campos = this.camposDe(body, null);
    const enabled = body.enabled === undefined ? true : body.enabled;
    if (typeof enabled !== "boolean") throw new Error("INVALID_ENABLED");
    const projectId = await this.resolverProjeto(actor, app, body.projectId);

    const criado = await this.schedules.create({
      companyId: app.companyId,
      applicationId: app.id,
      projectId,
      mode: body.mode as Modo,
      ...campos,
      enabled,
      createdById: actor.userId,
    });
    await this.auditar(actor.userId, app.companyId, "ScanSchedule", criado.id, "CREATE", { depois: toDTO(criado) });
    await this.reconciliar();
    return toDTO(criado);
  }

  async atualizar(actor: Actor, applicationId: string, scheduleId: string, body: CriarAgendamentoInput): Promise<AgendamentoDTO> {
    const app = await this.appParaEscrita(actor, applicationId);
    const atual = await this.agendamentoDaApp(app, scheduleId);
    // Modo e projeto são fixados na criação (ADR-056 §6).
    if (body.mode !== undefined && body.mode !== atual.mode) throw new Error("MODE_IS_IMMUTABLE");
    if (body.projectId !== undefined && body.projectId !== atual.projectId) throw new Error("PROJECT_IS_IMMUTABLE");
    this.exigirAlvoAutorizado(app);

    const campos = this.camposDe(body, atual);
    const enabled = body.enabled === undefined ? atual.enabled : body.enabled;
    if (typeof enabled !== "boolean") throw new Error("INVALID_ENABLED");

    const atualizado = await this.schedules.update(atual.id, { ...campos, enabled });
    await this.auditar(actor.userId, app.companyId, "ScanSchedule", atual.id, "UPDATE", { antes: toDTO(atual), depois: toDTO(atualizado) });
    await this.reconciliar();
    return toDTO(atualizado);
  }

  async remover(actor: Actor, applicationId: string, scheduleId: string): Promise<void> {
    const app = await this.appParaEscrita(actor, applicationId);
    const atual = await this.agendamentoDaApp(app, scheduleId);
    await this.schedules.delete(atual.id);
    await this.auditar(actor.userId, app.companyId, "ScanSchedule", atual.id, "DELETE", { antes: toDTO(atual) });
    await this.reconciliar();
  }

  /**
   * Espelha no Redis todos os agendamentos habilitados (boot do worker e após
   * cada mudança). Idempotente. Com memory devolve null: não há execução.
   */
  async reconciliar(): Promise<{ upserts: number; removidos: number } | null> {
    const habilitados = await this.schedules.findEnabled();
    const r = await this.fila.aplicarAgendamentosDast(
      habilitados.map((s) => ({ scheduleId: s.id, pattern: gerarPadraoCron(s), timezone: s.timezone })),
    );
    if (r === null && habilitados.length > 0 && !this.avisouMemoria) {
      this.avisouMemoria = true;
      console.warn(`🗓️  ${habilitados.length} agendamento(s) DAST cadastrado(s), mas QUEUE_DRIVER=memory não executa agendamentos (ADR-056).`);
    }
    return r;
  }

  // ==========================================================================
  // Execução (worker)
  // ==========================================================================

  /** Processor do job `{ scheduleId }`. Devolve o desfecho gravado em lastOutcome. */
  async executar(scheduleId: string): Promise<string> {
    const s = await this.schedules.findById(scheduleId);
    if (!s) return "NOT_FOUND"; // apagado entre o disparo e aqui; o reconciliador limpa o scheduler

    const motivo = await this.motivoParaNaoRodar(s);
    if (motivo) {
      await this.registrarDesfecho(s, motivo, null);
      await this.notificar(s.createdById, s.applicationId, "Scan DAST agendado não executado", `O scan agendado não rodou: ${DESCRICAO[motivo] ?? motivo}.`);
      return motivo;
    }

    const app = (await this.applications.findById(s.applicationId))!;
    try {
      const scan = await this.scans.criarAgendado({
        scheduleId: s.id,
        requestedById: s.createdById,
        targetUrl: app.url!,
        mode: s.mode,
        companyId: s.companyId,
        applicationId: s.applicationId,
        projectId: s.projectId,
      });
      await this.registrarDesfecho(s, "STARTED", scan.id);
      return "STARTED";
    } catch (err) {
      const codigo = (err as Error).message === "TARGET_BUSY" || (err as Error).message === "QUEUE_UNAVAILABLE" ? (err as Error).message : "ERROR";
      await this.registrarDesfecho(s, codigo, null);
      await this.notificar(s.createdById, s.applicationId, "Scan DAST agendado não executado", `O scan agendado não rodou: ${DESCRICAO[codigo] ?? (err as Error).message}.`);
      return codigo;
    }
  }

  /** Gancho do DastScanService: scan AGENDADO terminou em FAILED (nunca vira simulado). */
  async notificarFalhaDoScan(scan: DastScan): Promise<void> {
    if (!scan.scheduleId) return;
    const s = await this.schedules.findById(scan.scheduleId);
    if (s) await this.schedules.registrarExecucao(s.id, { lastRunAt: s.lastRunAt ?? this.agora(), lastOutcome: "SCAN_FAILED", lastScanId: scan.id });
    await this.notificar(
      scan.requestedById,
      scan.applicationId,
      "Scan DAST agendado falhou",
      `O scan agendado contra ${scan.targetUrl} falhou: ${(scan.errorMessage ?? "motivo não informado").slice(0, 300)}`,
    );
  }

  // ==========================================================================
  // Privados
  // ==========================================================================

  private async motivoParaNaoRodar(s: ScanSchedule): Promise<string | null> {
    if (!s.enabled) return "DISABLED";
    const app = await this.applications.findById(s.applicationId);
    if (!app || !app.isActive) return "APPLICATION_INACTIVE";
    if (app.companyId !== s.companyId) return "COMPANY_MISMATCH";
    const semAutorizacao = motivoSemAutorizacao(app, this.agora());
    if (semAutorizacao) return semAutorizacao;
    // O schema não tem "usuário desativado": inativo = sumiu ou deixou de ser ADMIN/PENTESTER.
    const criador = await this.users.findById(s.createdById);
    if (!criador || (criador.role !== "ADMIN" && criador.role !== "PENTESTER")) return "CREATOR_INACTIVE";
    if (criador.role === "PENTESTER" && (!s.projectId || !(await this.members.findOne(s.projectId, criador.id)))) return "NOT_MEMBER";
    return null;
  }

  private async registrarDesfecho(s: ScanSchedule, desfecho: string, scanId: string | null): Promise<void> {
    await this.schedules.registrarExecucao(s.id, { lastRunAt: this.agora(), lastOutcome: desfecho, ...(scanId ? { lastScanId: scanId } : {}) });
    await this.auditar(s.createdById, s.companyId, "ScanSchedule", s.id, "EXECUTION", { outcome: desfecho, scanId });
  }

  private async notificar(userId: string, applicationId: string | null, title: string, message: string): Promise<void> {
    await this.notifications.criarVarias([
      { userId, category: "DAST_SCHEDULE", title, message, link: applicationId ? `/applications/${applicationId}/dashboard` : null },
    ]);
  }

  private camposDe(body: CriarAgendamentoInput, atual: ScanSchedule | null): CamposAgendamento {
    const frequency = (body.frequency ?? atual?.frequency) as CamposAgendamento["frequency"];
    const campos = {
      frequency,
      hour: body.hour ?? atual?.hour,
      minute: body.minute ?? atual?.minute,
      // DAILY nunca guarda dia; WEEKLY exige.
      dayOfWeek: frequency === "DAILY" ? null : (body.dayOfWeek ?? atual?.dayOfWeek ?? null),
      timezone: body.timezone ?? atual?.timezone ?? FUSO_PADRAO,
    } as CamposAgendamento;
    const erro = validarCampos(campos);
    if (erro) throw new Error(erro);
    return campos;
  }

  private exigirAlvoAutorizado(app: Application): void {
    if (!app.isActive) throw new Error("APPLICATION_NOT_FOUND");
    const motivo = motivoSemAutorizacao(app, this.agora());
    if (motivo) throw new Error(motivo);
  }

  private async resolverProjeto(actor: Actor, app: Application, projectId: unknown): Promise<string | null> {
    if (projectId === undefined || projectId === null || projectId === "") {
      if (actor.role === "PENTESTER") throw new Error("MISSING_PROJECT_ID");
      return null;
    }
    if (typeof projectId !== "string") throw new Error("INVALID_PROJECT_ID");
    const project = await this.projects.findById(projectId);
    if (!project || project.applicationId !== app.id) throw new Error("PROJECT_NOT_FOUND");
    if (actor.role === "PENTESTER" && !(await this.members.findOne(project.id, actor.userId))) throw new Error("FORBIDDEN");
    return project.id;
  }

  private async agendamentoDaApp(app: Application, scheduleId: string): Promise<ScanSchedule> {
    const s = await this.schedules.findById(scheduleId);
    if (!s || s.applicationId !== app.id) throw new Error("SCHEDULE_NOT_FOUND");
    return s;
  }

  /** Leitura: quem não pode ver recebe 404 (não revela a aplicação). */
  private async appParaLeitura(actor: Actor, applicationId: string): Promise<Application> {
    const app = await this.applications.findById(applicationId);
    if (!app) throw new Error("APPLICATION_NOT_FOUND");
    if (actor.role === "ADMIN") return app;
    if (actor.role === "PENTESTER" && (await this.members.existsForUserInApplication(actor.userId, app.id))) return app;
    if (actor.role === "CLIENT") {
      const user = await this.users.findById(actor.userId);
      if (user?.companyId && user.companyId === app.companyId) return app;
    }
    throw new Error("APPLICATION_NOT_FOUND");
  }

  /** Escrita: CLIENT da empresa vê mas não muda (403); quem não vê, 404. */
  private async appParaEscrita(actor: Actor, applicationId: string): Promise<Application> {
    const app = await this.appParaLeitura(actor, applicationId);
    if (actor.role === "CLIENT") throw new Error("FORBIDDEN");
    return app;
  }

  private async podeEscrever(actor: Actor, app: Application): Promise<boolean> {
    if (actor.role === "ADMIN") return true;
    return actor.role === "PENTESTER" && (await this.members.existsForUserInApplication(actor.userId, app.id));
  }

  private autorizacaoDTO(app: Application, canEdit: boolean): AutorizacaoDastDTO {
    return {
      applicationId: app.id,
      authorizedAt: app.dastAuthorizedAt?.toISOString() ?? null,
      authorizedById: app.dastAuthorizedById,
      until: app.dastAuthorizedUntil?.toISOString() ?? null,
      host: app.dastAuthorizedHost,
      currentHost: normalizarHost(app.url),
      problem: motivoSemAutorizacao(app, this.agora()),
      canEdit,
    };
  }

  private resumoAutorizacao(app: Application) {
    return {
      at: app.dastAuthorizedAt?.toISOString() ?? null,
      by: app.dastAuthorizedById,
      until: app.dastAuthorizedUntil?.toISOString() ?? null,
      host: app.dastAuthorizedHost,
    };
  }

  private async auditar(actorId: string, companyId: string, entityType: string, entityId: string, action: string, diff: unknown): Promise<void> {
    await this.auditLog.create({ actorId, companyId, entityType, entityId, action, diffJson: JSON.stringify(diff) });
  }
}

/** Texto do motivo para a notificação (PT-BR). */
const DESCRICAO: Record<string, string> = {
  DISABLED: "o agendamento está desligado",
  APPLICATION_INACTIVE: "a aplicação está inativa",
  COMPANY_MISMATCH: "a aplicação mudou de empresa",
  APPLICATION_WITHOUT_URL: "a aplicação não tem URL",
  AUTHORIZATION_MISSING: "não há autorização de DAST registrada",
  AUTHORIZATION_EXPIRED: "a autorização de DAST venceu",
  HOST_MISMATCH: "o host da aplicação não é o host autorizado",
  CREATOR_INACTIVE: "quem criou o agendamento não pode mais executar scans",
  NOT_MEMBER: "quem criou o agendamento não é mais membro do projeto",
  TARGET_BUSY: "já havia um scan em andamento contra o mesmo alvo",
  QUEUE_UNAVAILABLE: "a fila de execução estava indisponível",
};
