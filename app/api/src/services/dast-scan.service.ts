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
 */

import type { DastScan } from "@prisma/client";
import type { DastScanRepository } from "../repositories/dast-scan.repository";
import type { DastFindingRepository } from "../repositories/dast-finding.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";
import type { UserRepository } from "../repositories/user.repository";
import { DastScanEntity, type CreateDastScanDTO, type DastScanResponseDTO } from "../models/dast-scan.model";
import { DastFindingEntity, RISK_ORDER, type DastFindingResponseDTO } from "../models/dast-finding.model";
import { validateTargetUrl, containerNameFor, runScan, killContainer, readReportFile } from "./zap-runner.service";
import { extractFindingsFromReport, type RiskCounters } from "./dast-findings.service";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
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

    // Fire-and-forget — o `.catch` aqui é cinto-e-suspensório: runInBackground
    // já se blinda por dentro, isso só existe pra nunca virar
    // unhandledRejection caso algo escape mesmo assim.
    this.runInBackground(scan.id).catch((err: unknown) => {
      console.error("DastScanService.runInBackground (erro não tratado)", err);
    });

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

    await killContainer(scan.id);
    const updated = await this.repository.update(scan.id, { status: "CANCELLED", finishedAt: new Date() });

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

  private async runInBackground(scanId: string): Promise<void> {
    const scan = await this.repository.findById(scanId);
    if (!scan) return; // registro sumiu entre o create e aqui — não há o que fazer

    await this.repository.update(scanId, { status: "RUNNING", startedAt: new Date() });

    try {
      const outcome = await runScan({ scanId, targetUrl: scan.targetUrl });

      if (outcome.status === "FAILED" || !outcome.jsonReportPath) {
        await this.markFinished(scan, "FAILED", outcome.durationMs, outcome.errorMessage ?? "Falha desconhecida na execução do scan");
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
      await this.markFinished(scan, "COMPLETED", outcome.durationMs, null, outcome.htmlReportPath, outcome.jsonReportPath);
    } catch (err) {
      // Erro inesperado fora do contrato normal do runner (ex: falha de I/O
      // no host) — nunca deixa o scan pendurado em RUNNING pra sempre.
      // "DOCKER_UNAVAILABLE" só aparece aqui de verdade se o fallback
      // simulado também falhar (ambiente sem disco gravável, por exemplo) —
      // em operação normal, Docker indisponível cai no simulado antes de
      // chegar nesse catch (ver zap-runner.service.ts).
      await this.markFinished(scan, "FAILED", undefined, (err as Error).message || "DOCKER_UNAVAILABLE");
    }
  }

  private async markFinished(
    scan: DastScan,
    status: "COMPLETED" | "FAILED",
    durationMs: number | undefined,
    errorMessage: string | null | undefined,
    htmlReportPath?: string,
    jsonReportPath?: string,
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
