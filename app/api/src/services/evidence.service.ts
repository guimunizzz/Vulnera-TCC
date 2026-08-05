/**
 * evidence.service.ts
 *
 * Upload de evidência validado por MIME whitelist + MAGIC NUMBER lido dos
 * primeiros bytes do arquivo — o Content-Type que o cliente declara NUNCA é
 * usado pra decidir aceitar/rejeitar (é trivial de falsificar: renomear
 * evil.exe pra evil.png e mandar Content-Type: image/png). A whitelist e a
 * detecção são a MESMA função (detectFileType): só os 4 tipos reconhecidos
 * pela assinatura de bytes são aceitos.
 *
 * Arquivo aprovado é regravado com nome UUID + extensão e salvo em
 * uploads/{companyId}/{vulnId}/ — nunca com o nome original (evita path
 * traversal e colisão).
 *
 * ⚠️ Limitação conhecida (fora do escopo do MVP, ver docs/BACKLOG.md):
 * não há varredura antivírus/malware no conteúdo do arquivo — a validação
 * é de tipo e tamanho, não de conteúdo malicioso embutido num PNG/PDF
 * válido (ex: polyglot files, exploits em parser de imagem).
 *
 * Quem escreve (upload): ADMIN ou PENTESTER membro do Project — mesma regra
 * de escrita do Vulnerability. CLIENT só lê (list/download).
 */

import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import type { EvidenceRepository } from "../repositories/evidence.repository";
import type { VulnerabilityRepository } from "../repositories/vulnerability.repository";
import type { ProjectMemberRepository } from "../repositories/project-member.repository";
import type { UserRepository } from "../repositories/user.repository";
import { EvidenceEntity } from "../models/evidence.model";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";
import type { Vulnerability } from "@prisma/client";
import type { UserRole } from "../models/user.model";

interface Actor {
  userId: string;
  role: UserRole;
}

interface UploadedFile {
  buffer: Buffer;
  originalname: string;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — defesa em profundidade (multer já corta antes)
// Configurável via UPLOADS_DIR (.env.test aponta pra "uploads-test" — nunca
// grava evidência de teste dentro de uploads/, que é o volume real de dev).
const UPLOADS_ROOT = path.resolve(process.cwd(), EnvVar.getOptional(EnvKeys.UPLOADS_DIR, "uploads"));

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

/**
 * Detecta o tipo real do arquivo pelos primeiros bytes (magic number).
 * PNG: 89 50 4E 47 · JPEG: FF D8 FF · PDF: 25 50 44 46 ("%PDF").
 * Texto puro não tem assinatura binária própria — só é aceito se o conteúdo
 * inteiro decodificar como UTF-8 válido (heurística padrão pra distinguir
 * texto de binário quando não há magic number).
 */
function detectFileType(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return "text/plain";
  } catch {
    return null;
  }
}

export class EvidenceService {
  constructor(
    private readonly repository: EvidenceRepository,
    private readonly vulnerabilityRepository: VulnerabilityRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async list(actor: Actor, vulnerabilityId: string): Promise<EvidenceEntity[]> {
    const vulnerability = await this.vulnerabilityRepository.findById(vulnerabilityId);
    if (!vulnerability) throw new Error("VULNERABILITY_NOT_FOUND");
    await this.assertCanView(actor, vulnerability);
    return (await this.repository.findByVulnerability(vulnerabilityId)).map((e) => new EvidenceEntity(e));
  }

  async upload(
    actor: Actor,
    vulnerabilityId: string,
    file: UploadedFile,
    proof: string,
  ): Promise<EvidenceEntity> {
    const vulnerability = await this.vulnerabilityRepository.findById(vulnerabilityId);
    if (!vulnerability) throw new Error("VULNERABILITY_NOT_FOUND");
    await this.assertCanWrite(actor, vulnerability);

    if (!file.buffer || file.buffer.length === 0) throw new Error("INVALID_FILE_TYPE");
    if (file.buffer.length > MAX_SIZE_BYTES) throw new Error("FILE_TOO_LARGE");

    const detectedType = detectFileType(file.buffer);
    if (!detectedType) throw new Error("INVALID_FILE_TYPE");

    const fileName = `${randomUUID()}${EXTENSION_BY_TYPE[detectedType]}`;
    const relativeDir = path.join(vulnerability.companyId, vulnerability.id);
    const relativePath = path.join(relativeDir, fileName);
    const absoluteDir = path.join(UPLOADS_ROOT, relativeDir);

    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(path.join(absoluteDir, fileName), file.buffer);

    const created = await this.repository.create({
      vulnerabilityId,
      fileName,
      originalName: file.originalname,
      filePath: relativePath,
      mimeType: detectedType,
      sizeBytes: file.buffer.length,
      proof,
      uploadedBy: actor.userId,
    });

    return new EvidenceEntity(created);
  }

  /** Resolve o caminho absoluto pro controller servir — sempre checando acesso à company antes. */
  async getFileForDownload(
    actor: Actor,
    evidenceId: string,
  ): Promise<{ absolutePath: string; fileName: string; mimeType: string }> {
    const evidence = await this.repository.findById(evidenceId);
    if (!evidence) throw new Error("EVIDENCE_NOT_FOUND");

    const vulnerability = await this.vulnerabilityRepository.findById(evidence.vulnerabilityId);
    if (!vulnerability) throw new Error("VULNERABILITY_NOT_FOUND");
    await this.assertCanView(actor, vulnerability);

    return {
      absolutePath: path.join(UPLOADS_ROOT, evidence.filePath),
      fileName: evidence.originalName,
      mimeType: evidence.mimeType,
    };
  }

  private async assertCanView(actor: Actor, vulnerability: Vulnerability): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") {
      const user = await this.userRepository.findById(actor.userId);
      if (user?.companyId && user.companyId === vulnerability.companyId) return;
      throw new Error("FORBIDDEN");
    }
    const membership = await this.projectMemberRepository.findOne(vulnerability.projectId, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
  }

  /** CLIENT nunca faz upload (read-only). PENTESTER precisa ser membro do Project. */
  private async assertCanWrite(actor: Actor, vulnerability: Vulnerability): Promise<void> {
    if (actor.role === "ADMIN") return;
    if (actor.role === "CLIENT") throw new Error("FORBIDDEN");
    const membership = await this.projectMemberRepository.findOne(vulnerability.projectId, actor.userId);
    if (!membership) throw new Error("FORBIDDEN");
  }
}
