// app/api/src/factories/threat-intel.factory.ts
//
// FACTORY METHOD da Threat Intel (ADR-053): monta Repository -> Service ->
// Controller num único ponto, como o resto do produto.
//
// A sincronização é UMA instância por processo: a tela ("Sincronizar agora"),
// o backfill ao confirmar uma tecnologia e o agendador do server.ts precisam
// enxergar a mesma flag de "já está rodando". As sugestões do inventário
// (SBOM e fingerprint) também saem daqui, para os factories do SAST/SCA e do DAST.

import { prisma } from "../database/prisma.database";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";
import { ThreatIntelRepository } from "../repositories/threat-intel.repository";
import { TechAssetRepository } from "../repositories/tech-asset.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { UserRepository } from "../repositories/user.repository";
import { ProjectRepository } from "../repositories/project.repository";
import { ProjectMemberRepository } from "../repositories/project-member.repository";
import { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import { AuditLogRepository } from "../repositories/audit-log.repository";
import { ApplicationRepository } from "../repositories/application.repository";
import { FontesPublicas, type FontesDeAvisos } from "../services/threat-intel/fontes";
import { ThreatIntelSyncService } from "../services/threat-intel/threat-intel-sync.service";
import { ThreatIntelService } from "../services/threat-intel/threat-intel.service";
import { TechSuggestionService } from "../services/threat-intel/tech-suggestion.service";
import { ThreatIntelController } from "../controllers/threat-intel.controller";
import { makeSlaPolicyService } from "./sla-policy.factory";
import { makeJobQueue } from "./job-queue.factory";

let fontes: FontesDeAvisos | null = null;
let sync: ThreatIntelSyncService | null = null;

function fontesPublicas(): FontesDeAvisos {
  fontes ??= new FontesPublicas(EnvVar.getOptional(EnvKeys.NVD_API_KEY, "").trim() || null);
  return fontes;
}

export function makeThreatIntelSyncService(): ThreatIntelSyncService {
  sync ??= new ThreatIntelSyncService(fontesPublicas(), new ThreatIntelRepository(prisma), new TechAssetRepository(prisma), new NotificationRepository(prisma));
  return sync;
}

export function makeThreatIntelService(): ThreatIntelService {
  return new ThreatIntelService(
    new ThreatIntelRepository(prisma),
    new TechAssetRepository(prisma),
    new UserRepository(prisma),
    new ProjectRepository(prisma),
    new ProjectMemberRepository(prisma),
    new VulnerabilityRepository(prisma),
    new AuditLogRepository(prisma),
    makeSlaPolicyService(),
    new ApplicationRepository(prisma),
    fontesPublicas(),
    // ADR-056: manual e backfill passam pela fila (memory = mesmo disparo de antes).
    makeJobQueue(),
  );
}

export function makeTechSuggestionService(): TechSuggestionService {
  return new TechSuggestionService(new TechAssetRepository(prisma));
}

export function makeThreatIntelController(): ThreatIntelController {
  return new ThreatIntelController(makeThreatIntelService());
}
