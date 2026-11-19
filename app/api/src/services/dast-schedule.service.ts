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
import type { EscopoAgendamentos, ScanScheduleRepository } from "../repositories/scan-schedule.repository";
import type { ProjectRepository } from "../repositories/project.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { UserRepository } from "../repositories/user.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { NotificationRepository } from "../repositories/notification.repository";
import type { JobQueue } from "./queue/job-queue";
import type { DastScanService } from "./dast-scan.service";
import type { DastScan } from "../models/dast-scan.model";
import type { UserRole } from "../models/user.model";
import { validateTargetUrl } from "./zap-runner.service";
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
  /** null nos agendamentos só por URL. */
  applicationId: string | null;
  companyId: string | null;
  /** Preenchido só nos agendamentos por URL. */
  targetUrl: string | null;
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

/** Uma linha da página /agendamentos: o agendamento e o que a pessoa precisa para entendê-lo. */
export interface AgendamentoVisivelDTO extends AgendamentoDTO {
  /** APPLICATION: alvo é a URL da aplicação, com autorização conferida a cada execução. URL: alvo solto. */
  kind: "APPLICATION" | "URL";
  /** URL que vai ser escaneada (da aplicação ou a do agendamento). */
  url: string | null;
  application: { id: string; name: string; url: string | null; companyName: string; active: boolean } | null;
  projectName: string | null;
  /** null nos agendamentos por URL: lá a autorização é só a confirmação de quem criou. */
  authorization: { until: string | null; host: string | null; problem: string | null } | null;
  /** Próximo disparo segundo o scheduler (bullmq); null sem motor de agendamento ou desligado. */
  nextRunAt: string | null;
  canEdit: boolean;
}

export interface PainelAgendamentosDTO {
  /** false com QUEUE_DRIVER=memory: o cadastro funciona, mas nada dispara sozinho. */
  runsSchedules: boolean;
  /** ADMIN e PENTESTER criam; CLIENT só lê. */
  canCreate: boolean;
  schedules: AgendamentoVisivelDTO[];
}

/** Aplicação em que a pessoa pode agendar, com a autorização atual e os projetos que ela pode usar. */
export interface AlvoDastDTO {
  applicationId: string;
  name: string;
  url: string | null;
  companyName: string;
  authorization: AutorizacaoDastDTO;
  projects: { id: string; name: string }[];
  /** PENTESTER precisa escolher um projeto de que é membro; ADMIN pode deixar em branco. */
  projectRequired: boolean;
}

export interface CriarAgendamentoInput extends Partial<CamposAgendamento> {
  mode?: unknown;
  /** Só no agendamento por URL. */
  targetUrl?: unknown;
  /** Só no agendamento por URL: a pessoa confirma que tem autorização para testar a URL. */
  confirmedAuthorization?: unknown;
  projectId?: unknown;
  enabled?: unknown;
}

const toDTO = (s: ScanSchedule): AgendamentoDTO => ({
  id: s.id,
  applicationId: s.applicationId,
  companyId: s.companyId,
  targetUrl: s.targetUrl,
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
    private readonly applications: Pick<ApplicationRepository, "findById" | "setDastAuthorization" | "findAlvosDast">,
    private readonly schedules: ScanScheduleRepository,
    private readonly projects: Pick<ProjectRepository, "findById">,
    private readonly members: Pick<ProjectMemberRepository, "findOne" | "existsForUserInApplication">,
    private readonly users: Pick<UserRepository, "findById">,
    private readonly auditLog: Pick<AuditLogRepository, "create">,
    private readonly notifications: Pick<NotificationRepository, "criarVarias">,
    private readonly fila: Pick<JobQueue, "driver" | "aplicarAgendamentosDast" | "proximasExecucoesDast">,
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

  // ==========================================================================
  // Agendamento só por URL (decisão de 2026-11-19)
  // ==========================================================================

  /**
   * Sem aplicação, empresa nem projeto: ADMIN e PENTESTER, e qualquer um deles
   * vê e edita. Não há autorização com prazo: a pessoa confirma que tem
   * autorização para testar a URL, e a confirmação fica no AuditLog. Na
   * execução não há nova checagem de autorização (decisão do Rafael).
   */
  async criarPorUrl(actor: Actor, body: CriarAgendamentoInput): Promise<AgendamentoDTO> {
    if (actor.role !== "ADMIN" && actor.role !== "PENTESTER") throw new Error("FORBIDDEN");
    if (typeof body.targetUrl !== "string" || !body.targetUrl.trim()) throw new Error("MISSING_TARGET_URL");
    const targetUrl = validateTargetUrl(body.targetUrl.trim()).href;
    if (body.confirmedAuthorization !== true) throw new Error("AUTHORIZATION_CONFIRMATION_REQUIRED");
    if (!MODOS.includes(body.mode as Modo)) throw new Error("INVALID_MODE");
    const campos = this.camposDe(body, null);
    const enabled = body.enabled === undefined ? true : body.enabled;
    if (typeof enabled !== "boolean") throw new Error("INVALID_ENABLED");

    const criado = await this.schedules.create({
      companyId: null,
      applicationId: null,
      targetUrl,
      projectId: null,
      mode: body.mode as Modo,
      ...campos,
      enabled,
      createdById: actor.userId,
    });
    await this.auditar(actor.userId, null, "ScanSchedule", criado.id, "CREATE", { depois: toDTO(criado), confirmedAuthorization: true });
    await this.reconciliar();
    return toDTO(criado);
  }

  /** Edição pela página /agendamentos: decide pelas regras do tipo do agendamento. */
  async atualizarPorId(actor: Actor, scheduleId: string, body: CriarAgendamentoInput): Promise<AgendamentoDTO> {
    const s = await this.agendamentoParaEscrita(actor, scheduleId);
    if (s.applicationId) return this.atualizar(actor, s.applicationId, s.id, body);
    if (body.mode !== undefined && body.mode !== s.mode) throw new Error("MODE_IS_IMMUTABLE");
    if (body.targetUrl !== undefined && body.targetUrl !== s.targetUrl) throw new Error("TARGET_IS_IMMUTABLE");
    const campos = this.camposDe(body, s);
    const enabled = body.enabled === undefined ? s.enabled : body.enabled;
    if (typeof enabled !== "boolean") throw new Error("INVALID_ENABLED");
    const atualizado = await this.schedules.update(s.id, { ...campos, enabled });
    await this.auditar(actor.userId, null, "ScanSchedule", s.id, "UPDATE", { antes: toDTO(s), depois: toDTO(atualizado) });
    await this.reconciliar();
    return toDTO(atualizado);
  }

  async removerPorId(actor: Actor, scheduleId: string): Promise<void> {
    const s = await this.agendamentoParaEscrita(actor, scheduleId);
    if (s.applicationId) return this.remover(actor, s.applicationId, s.id);
    await this.schedules.delete(s.id);
    await this.auditar(actor.userId, null, "ScanSchedule", s.id, "DELETE", { antes: toDTO(s) });
    await this.reconciliar();
  }

  /** Por URL: ADMIN/PENTESTER; por aplicação: as regras da aplicação (aplicadas em atualizar/remover). */
  private async agendamentoParaEscrita(actor: Actor, scheduleId: string): Promise<ScanSchedule> {
    const s = await this.schedules.findById(scheduleId);
    if (!s) throw new Error("SCHEDULE_NOT_FOUND");
    if (!s.applicationId && actor.role !== "ADMIN" && actor.role !== "PENTESTER") throw new Error("SCHEDULE_NOT_FOUND");
    return s;
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
  // Página /agendamentos (leitura)
  // ==========================================================================

  /**
   * Todos os agendamentos que a pessoa enxerga, com o mesmo recorte da leitura
   * por aplicação: ADMIN tudo; PENTESTER as aplicações de projetos de que é
   * membro; CLIENT a própria empresa (somente leitura).
   */
  async listarVisiveis(actor: Actor): Promise<PainelAgendamentosDTO> {
    let escopo: EscopoAgendamentos;
    if (actor.role === "ADMIN") escopo = { tudo: true };
    else if (actor.role === "PENTESTER") escopo = { membroId: actor.userId };
    else {
      const user = await this.users.findById(actor.userId);
      if (!user?.companyId) return { runsSchedules: this.fila.driver === "bullmq", canCreate: false, schedules: [] };
      escopo = { companyId: user.companyId };
    }

    const linhas = await this.schedules.findVisiveis(escopo);
    // O próximo disparo é informativo: Redis fora do ar não pode derrubar a página.
    const proximas = await this.fila.proximasExecucoesDast().catch(() => null);
    const agora = this.agora();
    const podeEditar = actor.role === "ADMIN" || actor.role === "PENTESTER";
    return {
      runsSchedules: this.fila.driver === "bullmq",
      canCreate: podeEditar,
      schedules: linhas.map((s) => {
        const app = s.application;
        return {
          ...toDTO(s),
          kind: app ? ("APPLICATION" as const) : ("URL" as const),
          url: app ? app.url : s.targetUrl,
          application: app ? { id: app.id, name: app.name, url: app.url, companyName: app.company.name, active: app.isActive } : null,
          projectName: s.project?.name ?? null,
          authorization: app
            ? { until: app.dastAuthorizedUntil?.toISOString() ?? null, host: app.dastAuthorizedHost, problem: motivoSemAutorizacao(app, agora) }
            : null,
          nextRunAt: s.enabled ? (proximas?.get(s.id) ?? null) : null,
          canEdit: podeEditar,
        };
      }),
    };
  }

  /** Aplicações em que a pessoa pode agendar (o seletor do formulário). CLIENT não agenda. */
  async alvos(actor: Actor): Promise<AlvoDastDTO[]> {
    if (actor.role !== "ADMIN" && actor.role !== "PENTESTER") throw new Error("FORBIDDEN");
    const apps = await this.applications.findAlvosDast(actor.role === "PENTESTER" ? actor.userId : undefined);
    return apps.map((app) => ({
      applicationId: app.id,
      name: app.name,
      url: app.url,
      companyName: app.company.name,
      authorization: this.autorizacaoDTO(app, true),
      projects: app.projects,
      projectRequired: actor.role === "PENTESTER",
    }));
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

    // Por URL: o alvo é o próprio agendamento; por aplicação, a URL atual dela.
    const app = s.applicationId ? (await this.applications.findById(s.applicationId))! : null;
    try {
      const scan = await this.scans.criarAgendado({
        scheduleId: s.id,
        requestedById: s.createdById,
        targetUrl: app ? app.url! : s.targetUrl!,
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
    if (!s.applicationId) {
      // Por URL: sem autorização com prazo nem empresa (decisão de 2026-11-19);
      // ainda assim, quem agendou precisa continuar sendo ADMIN/PENTESTER.
      if (!s.targetUrl) return "ERROR";
      const criador = await this.users.findById(s.createdById);
      if (!criador || (criador.role !== "ADMIN" && criador.role !== "PENTESTER")) return "CREATOR_INACTIVE";
      return null;
    }
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
      // A página dos agendamentos mostra o motivo e permite corrigir; serve aos dois tipos.
      { userId, category: "DAST_SCHEDULE", title, message, link: "/agendamentos" },
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

  private async auditar(actorId: string, companyId: string | null, entityType: string, entityId: string, action: string, diff: unknown): Promise<void> {
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
