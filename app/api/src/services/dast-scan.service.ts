/**
 * dast-scan.service.ts
 *
 * Orquestração de negócio do módulo DAST — o único lugar que conhece TODAS as
 * peças (zap-runner, pipeline de findings, repository) e a única camada
 * intermediária entre o Controller e o Prisma (via os repositories). Não
 * conhece HTTP nem toca `@prisma/client` diretamente (CLAUDE.md P1).
 *
 * Ownership: PENTESTER só enxerga/cancela os PRÓPRIOS scans (requestedById);
 * ADMIN enxerga e cancela todos. Essa regra fina mora aqui (`getOwnedScan`),
 * não no middleware — `requireRole` só garante CLIENT fora do módulo inteiro.
 *
 * Execução assíncrona sem fila: `create()` grava QUEUED e dispara
 * `runInBackground` SEM AWAIT — quem chamou (controller) já recebe o `id` de
 * volta. O progresso vive inteiramente no banco; o frontend faz polling
 * (Fase 6). É o primeiro fluxo "fire-and-forget" do projeto — mesma ideia de
 * best-effort do push.util.ts, mas aqui o resultado final SEMPRE atualiza o
 * registro (nunca falha silenciosamente pro usuário: um erro inesperado vira
 * FAILED, não um scan pendurado em RUNNING pra sempre).
 *
 * Watchdog (`recoverOrphanedScans`): chamado uma vez no boot do server.ts.
 * Sem isso, reiniciar a API no meio de um scan deixaria o registro em
 * RUNNING/QUEUED pra sempre — ninguém nunca mais cancela nem tenta de novo
 * sem intervenção manual no banco.
 *
 * Concorrência (2026-09-09): `create()` não dispara mais o scan direto — ele
 * ENFILEIRA no `DastWatchdog`, que roda no máximo 2 (configurável) ao mesmo
 * tempo e aborta scan travado. O registro fica em QUEUED até o watchdog dar a
 * vaga; só então vira RUNNING. O progresso (0..100 + fase) é persistido a
 * cada tick do runner, com throttle, porque é o banco — e não a memória —
 * que a UI lê no polling.
 */

import type { DastScan } from "@prisma/client";
import type { DastScanRepository } from "../repositories/dast-scan.repository";
import type { DastFindingRepository } from "../repositories/dast-finding.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { UserRepository } from "../repositories/user.repository";
import { DastScanEntity, type CreateDastScanDTO, type DastScanResponseDTO } from "../models/dast-scan.model";
import { DastFindingEntity, RISK_ORDER, type DastFindingResponseDTO } from "../models/dast-finding.model";
import {
  validateTargetUrl,
  containerNameFor,
  runScan,
  killContainer,
  readReportFile,
  getDockerStatus,
  SCAN_PHASE_LABELS,
  type ScanPhase,
} from "./zap-runner.service";
import type { DastWatchdog, WatchdogRunContext, WatchdogSnapshot } from "./dast-watchdog.service";
import { extractFindingsFromReport, type RiskCounters } from "./dast-findings.service";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

/** Payload do GET /api/dast/status — alimenta o banner da tela de DAST. */
export interface DastModuleStatus {
  /** Se false, todo scan novo já sai simulado (o front avisa antes de o usuário clicar). */
  dockerAvailable: boolean;
  dockerCheckedAt: string;
  maxConcurrent: number;
  runningCount: number;
  queuedCount: number;
  running: WatchdogSnapshot["running"];
  queued: WatchdogSnapshot["queued"];
  alerts: WatchdogSnapshot["alerts"];
}

export interface DastReportData {
  scan: DastScanResponseDTO;
  // Resolvido aqui (não no DastScanResponseDTO — esse é usado por list/getById
  // também, e não vale um join extra ali só pra exibir "quem pediu" na capa
  // do PDF, que só o /report/data precisa).
  requestedByName: string | null;
  counters: { high: number; medium: number; low: number; info: number };
  findings: DastFindingResponseDTO[];
  topFindings: DastFindingResponseDTO[];
}

export class DastScanService {
  constructor(
    private readonly repository: DastScanRepository,
    private readonly findingRepository: DastFindingRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly userRepository: UserRepository,
    private readonly watchdog: DastWatchdog,
  ) {}

  async create(actor: Actor, dto: CreateDastScanDTO): Promise<DastScanEntity> {
    if (!dto.targetUrl || typeof dto.targetUrl !== "string") throw new Error("MISSING_TARGET_URL");

    // validateTargetUrl lança INVALID_TARGET_URL (protocolo) ou
    // TARGET_NOT_ALLOWED (SSRF) — ver zap-runner.service.ts.
    const parsed = validateTargetUrl(dto.targetUrl);
    // .href canonicaliza (ex: adiciona "/" no root) — evita que a mesma URL
    // digitada de duas formas ligeiramente diferentes escape o lock abaixo.
    const targetUrl = parsed.href;

    const active = await this.repository.findActiveForTarget(targetUrl);
    if (active) throw new Error("SCAN_ALREADY_RUNNING_FOR_TARGET");

    const created = await this.repository.create({ targetUrl, requestedById: actor.userId });
    const scan = await this.repository.update(created.id, { containerName: containerNameFor(created.id) });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: null,
      entityType: "DastScan",
      entityId: scan.id,
      action: "CREATE",
      diffJson: JSON.stringify({ targetUrl }),
    });

    // Enfileira no watchdog em vez de disparar direto: ele decide QUANDO
    // começar (no máximo N simultâneos) e continua vigiando depois disso.
    const position = this.watchdog.submit({
      scanId: scan.id,
      targetUrl: scan.targetUrl,
      requestedById: scan.requestedById,
      run: (ctx) => this.runInBackground(scan.id, ctx),
    });
    if (position > 0) {
      await this.repository.update(scan.id, { phase: "QUEUED", progress: 0 });
      this.watchdog.raise("warn", scan.id, `Limite de ${this.watchdog.maxConcurrent} scans simultâneos atingido — este entrou na fila (posição ${position}).`);
    }

    return new DastScanEntity(scan);
  }

  async list(actor: Actor): Promise<DastScanEntity[]> {
    const scans = actor.role === "ADMIN" ? await this.repository.findAll() : await this.repository.findByRequester(actor.userId);
    return scans.map((s) => new DastScanEntity(s));
  }

  async getById(actor: Actor, id: string): Promise<DastScanEntity> {
    const scan = await this.getOwnedScan(actor, id);
    return new DastScanEntity(scan);
  }

  async cancel(actor: Actor, id: string): Promise<DastScanEntity> {
    const scan = await this.getOwnedScan(actor, id);
    if (!new DastScanEntity(scan).isActive()) throw new Error("INVALID_STATUS_TRANSITION");

    // Ordem importa: abortar primeiro faz o runner parar no próximo tick e
    // desistir do fallback simulado; o `docker rm -f` derruba o container que
    // já estiver de pé (nenhum, se o scan ainda estava na fila).
    this.watchdog.abort(scan.id, "Scan cancelado pelo usuário.");
    await killContainer(scan.id);
    const updated = await this.repository.update(scan.id, {
      status: "CANCELLED",
      finishedAt: new Date(),
      phase: "CANCELLED",
    });

    await this.auditLogRepository.create({
      actorId: actor.userId,
      companyId: null,
      entityType: "DastScan",
      entityId: scan.id,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: scan.status, to: "CANCELLED" }),
    });

    return new DastScanEntity(updated);
  }

  async listFindings(actor: Actor, id: string): Promise<DastFindingEntity[]> {
    await this.getOwnedScan(actor, id);
    const findings = await this.findingRepository.findByScanId(id);
    const sorted = [...findings].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
    return sorted.map((f) => new DastFindingEntity(f));
  }

  /** Buffer bruto do report.html/report.json — controller decide os headers (CSP sandbox, nosniff). */
  async getReportFile(actor: Actor, id: string, fileName: "report.html" | "report.json"): Promise<Buffer> {
    const scan = await this.getOwnedScan(actor, id);
    if (scan.status !== "COMPLETED") throw new Error("REPORT_NOT_FOUND");
    return readReportFile(scan.id, fileName);
  }

  /** Payload único consolidado — front usa pro PDF client-side (Fase 7) e pra tela de detalhe. */
  async getReportData(actor: Actor, id: string): Promise<DastReportData> {
    const scan = await this.getOwnedScan(actor, id);
    const findings = await this.findingRepository.findByScanId(id);
    const sorted = [...findings].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
    const responses = sorted.map((f) => new DastFindingEntity(f).toResponse());
    const requester = await this.userRepository.findById(scan.requestedById);

    return {
      scan: new DastScanEntity(scan).toResponse(),
      requestedByName: requester?.name ?? null,
      counters: { high: scan.alertsHigh, medium: scan.alertsMedium, low: scan.alertsLow, info: scan.alertsInfo },
      findings: responses,
      topFindings: responses.slice(0, 10),
    };
  }

  /**
   * Estado do módulo pra UI: Docker disponível?, quantos rodando, quantos na
   * fila, alertas recentes. PENTESTER só enxerga os PRÓPRIOS scans nas listas
   * (mesma regra de ownership do resto do módulo), mas vê os CONTADORES
   * agregados — sem eles, "seu scan está na fila" não faria sentido nenhum.
   */
  async getStatus(actor: Actor): Promise<DastModuleStatus> {
    const docker = await getDockerStatus();
    const snapshot = this.watchdog.snapshot();
    const isAdmin = actor.role === "ADMIN";

    return {
      dockerAvailable: docker.available,
      dockerCheckedAt: docker.checkedAt,
      maxConcurrent: snapshot.maxConcurrent,
      runningCount: snapshot.runningCount,
      queuedCount: snapshot.queuedCount,
      running: isAdmin ? snapshot.running : snapshot.running.filter((r) => r.requestedById === actor.userId),
      queued: isAdmin ? snapshot.queued : snapshot.queued.filter((q) => q.requestedById === actor.userId),
      alerts: isAdmin ? snapshot.alerts : snapshot.alerts.filter((a) => a.scanId === null || this.isOwnAlert(a.scanId, snapshot, actor.userId)),
    };
  }

  /** Alerta só aparece pro PENTESTER se for de um scan dele que o watchdog ainda conhece. */
  private isOwnAlert(scanId: string, snapshot: WatchdogSnapshot, userId: string): boolean {
    return (
      snapshot.running.some((r) => r.scanId === scanId && r.requestedById === userId) ||
      snapshot.queued.some((q) => q.scanId === scanId && q.requestedById === userId)
    );
  }

  /**
   * Watchdog de boot — chamado uma vez em server.ts antes do `app.listen`.
   * Todo scan QUEUED/RUNNING no momento do boot só pode existir porque o
   * processo anterior morreu no meio (crash, deploy, reinício manual): não
   * há fila nem processo sobrevivente que ainda esteja "de fato" rodando
   * aquele container. Marca FAILED com uma mensagem que deixa isso explícito.
   */
  async recoverOrphanedScans(): Promise<number> {
    const orphans = await this.repository.findActiveOrQueued();
    for (const scan of orphans) {
      await this.repository.update(scan.id, {
        status: "FAILED",
        errorMessage: "Scan interrompido por reinício do servidor",
        finishedAt: new Date(),
      });
      // Não existe "usuário sistema" no schema (actorId é FK obrigatória) —
      // atribuir ao próprio requestedById mantém a trilha íntegra; o
      // diffJson deixa claro que foi o watchdog, não uma ação do usuário.
      await this.auditLogRepository.create({
        actorId: scan.requestedById,
        companyId: null,
        entityType: "DastScan",
        entityId: scan.id,
        action: "STATUS_CHANGE",
        diffJson: JSON.stringify({ from: scan.status, to: "FAILED", reason: "watchdog_boot" }),
      });
    }
    return orphans.length;
  }

  // ==========================================================================
  // Privados
  // ==========================================================================

  private async getOwnedScan(actor: Actor, id: string): Promise<DastScan> {
    const scan = await this.repository.findById(id);
    if (!scan) throw new Error("SCAN_NOT_FOUND");
    if (actor.role !== "ADMIN" && scan.requestedById !== actor.userId) throw new Error("FORBIDDEN");
    return scan;
  }

  private async runInBackground(scanId: string, ctx: WatchdogRunContext): Promise<void> {
    const scan = await this.repository.findById(scanId);
    if (!scan) return; // registro sumiu entre o create e aqui — não há o que fazer

    await this.repository.update(scanId, {
      status: "RUNNING",
      startedAt: new Date(),
      phase: "STARTING",
      progress: 0,
      simulated: false,
      warningMessage: null,
    });

    try {
      const outcome = await runScan({
        scanId,
        targetUrl: scan.targetUrl,
        signal: ctx.signal,
        onProgress: this.makeProgressSink(scanId, ctx),
      });

      if (outcome.status === "FAILED" || !outcome.jsonReportPath) {
        // Abort do watchdog e cancelamento do usuário chegam aqui como
        // SCAN_CANCELLED. Se o registro já é CANCELLED (usuário), markFinished
        // descarta sozinho; se ainda é RUNNING, foi o watchdog — e aí a razão
        // do abort é a mensagem que o usuário precisa ler.
        const reason =
          outcome.errorMessage === "SCAN_CANCELLED"
            ? String(ctx.signal.reason ?? "Scan interrompido.")
            : (outcome.errorMessage ?? "Falha desconhecida na execução do scan");
        await this.markFinished(scan, "FAILED", outcome.durationMs, reason);
        return;
      }

      // O fallback simulado NÃO interrompe de verdade o timer interno quando
      // cancel() é chamado (só o Docker real morre na hora via
      // killContainer) — sem esta checagem, um scan cancelado enquanto
      // "rodava" simulado ainda tentaria persistir findings de um registro
      // que já não está mais RUNNING (ou nem existe mais).
      const stillRunning = await this.repository.findById(scanId);
      if (!stillRunning || stillRunning.status !== "RUNNING") return;

      let counters: RiskCounters;
      try {
        const candidates = await extractFindingsFromReport(outcome.jsonReportPath, scan.targetUrl);
        counters = await this.repository.persistFindingsAndUpdateCounters(scanId, candidates);
      } catch (parseErr) {
        await this.markFinished(
          scan,
          "FAILED",
          outcome.durationMs,
          `Falha ao processar report.json: ${(parseErr as Error).message}`,
          outcome.htmlReportPath,
          outcome.jsonReportPath,
        );
        return;
      }

      void counters; // já refletido no banco via persistFindingsAndUpdateCounters; aqui só pra deixar o fluxo explícito
      if (outcome.simulated) {
        this.watchdog.raise("warn", scanId, outcome.warningMessage ?? "Scan concluído com resultado simulado.");
      }
      await this.markFinished(scan, "COMPLETED", outcome.durationMs, null, outcome.htmlReportPath, outcome.jsonReportPath, {
        simulated: outcome.simulated,
        warningMessage: outcome.warningMessage ?? null,
      });
    } catch (err) {
      // Erro inesperado fora do contrato normal do runner (ex: falha de I/O
      // no host) — nunca deixa o scan pendurado em RUNNING pra sempre.
      // "DOCKER_UNAVAILABLE" só aparece aqui de verdade se o fallback
      // simulado também falhar (ambiente sem disco gravável, por exemplo) —
      // em operação normal, Docker indisponível cai no simulado antes de
      // chegar nesse catch (ver zap-runner.service.ts).
      this.watchdog.raise("error", scanId, `Erro inesperado na execução: ${(err as Error).message}`);
      await this.markFinished(scan, "FAILED", undefined, (err as Error).message || "DOCKER_UNAVAILABLE");
    }
  }

  /**
   * Devolve o callback de progresso do runner. Duas coisas acontecem a cada
   * tick: pulso no watchdog (barato, memória) e escrita no banco (cara).
   *
   * O throttle existe por causa da segunda: o runner pulsa a cada ~3s por
   * scan, e uma escrita por tick multiplicada por N scans simultâneos é
   * tráfego de banco puro desperdício quando o percentual nem mudou. Grava só
   * quando a FASE muda ou quando o percentual andou pelo menos 1 ponto — e,
   * ainda assim, no máximo uma vez por segundo.
   */
  private makeProgressSink(scanId: string, ctx: WatchdogRunContext): (progress: { percent: number; phase: ScanPhase; message: string }) => void {
    let lastPersistedPercent = -1;
    let lastPersistedPhase: string | null = null;
    let lastWriteAt = 0;

    return (progress) => {
      ctx.heartbeat(progress.phase, progress.percent);

      const phaseChanged = progress.phase !== lastPersistedPhase;
      const percentChanged = progress.percent !== lastPersistedPercent;
      const now = Date.now();
      if (!phaseChanged && (!percentChanged || now - lastWriteAt < 1000)) return;

      lastPersistedPercent = progress.percent;
      lastPersistedPhase = progress.phase;
      lastWriteAt = now;

      // Sem await: o progresso é informativo, e travar o polling do ZAP
      // esperando o MySQL não ajuda ninguém. Falha de escrita vira aviso, não
      // interrompe o scan.
      void this.repository
        .update(scanId, { progress: progress.percent, phase: progress.phase })
        .catch((err: unknown) => {
          console.warn(`[DAST] falha ao gravar progresso do scan ${scanId} (${SCAN_PHASE_LABELS[progress.phase]})`, err);
        });
    };
  }

  private async markFinished(
    scan: DastScan,
    status: "COMPLETED" | "FAILED",
    durationMs: number | undefined,
    errorMessage: string | null | undefined,
    htmlReportPath?: string,
    jsonReportPath?: string,
    extra?: { simulated: boolean; warningMessage: string | null },
  ): Promise<void> {
    // Corrida real (não só de teste): o usuário pode cancelar enquanto o
    // scan roda em background. Se o registro já saiu de RUNNING (virou
    // CANCELLED, ou sumiu) antes do resultado chegar, NÃO sobrescreve — quem
    // cancelou já decidiu o estado final, o resultado tardio é descartado.
    const current = await this.repository.findById(scan.id);
    if (!current || current.status !== "RUNNING") return;

    await this.repository.update(scan.id, {
      status,
      finishedAt: new Date(),
      ...(durationMs !== undefined ? { durationMs } : {}),
      errorMessage: errorMessage ?? null,
      ...(htmlReportPath ? { htmlReportPath } : {}),
      ...(jsonReportPath ? { jsonReportPath } : {}),
      // 100% mesmo em FAILED: a barra para de andar, não volta pra trás.
      progress: 100,
      phase: status === "COMPLETED" ? (extra?.simulated ? "SIMULATED" : "DONE") : "FAILED",
      simulated: extra?.simulated ?? false,
      warningMessage: extra?.warningMessage ?? null,
    });
    await this.auditLogRepository.create({
      actorId: scan.requestedById,
      companyId: null,
      entityType: "DastScan",
      entityId: scan.id,
      action: "STATUS_CHANGE",
      diffJson: JSON.stringify({ from: scan.status, to: status }),
    });
  }
}
