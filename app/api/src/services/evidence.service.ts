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
 * ⚠️ Limitações conhecidas (fora do escopo do MVP, ver docs/BACKLOG.md):
 *
 * 1. Não há varredura antivírus/malware no conteúdo do arquivo — a validação
 *    é de tipo e tamanho, não de conteúdo malicioso.
 * 2. POLYGLOT: um arquivo com header PNG/JPEG/PDF válido seguido de payload
 *    arbitrário É ACEITO. A assinatura de bytes prova como o arquivo se
 *    apresenta, não que o resto dele seja inofensivo. Mitigado por: nome
 *    reescrito com UUID (nunca executável pelo nome), extensão derivada do
 *    tipo DETECTADO, download sempre como `attachment` + `nosniff`, e
 *    nenhum caminho de código que interprete/execute o conteúdo no servidor.
 *    Bloquear de verdade exigiria parse completo do formato — fora de escopo.
 * 3. Só o Base do formato é checado (primeiros bytes no offset 0). Um PDF com
 *    lixo antes do `%PDF` — que a spec do PDF tolera — é recusado. Preferimos
 *    o falso-negativo: aceitar assinatura em offset arbitrário é justamente
 *    o que facilita polyglot.
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

// originalName é VARCHAR(191) no schema — nome maior estourava a coluna e
// virava 500 (erro do Prisma) em vez de 400. Truncamos preservando a cauda,
// que é a parte informativa (extensão).
const MAX_ORIGINAL_NAME = 180;

/**
 * Sanitiza o nome que o cliente enviou. Ele NÃO é usado pra montar caminho
 * nenhum (o arquivo em disco é UUID + extensão detectada), mas volta no
 * Content-Disposition do download e é exibido na tela e no PDF técnico —
 * então tira componente de diretório, bytes de controle (CR/LF cortariam
 * header) e limita o tamanho.
 */
function sanitizeOriginalName(name: string): string {
  const semDiretorio = (name || "").split(/[/\\]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const semControle = semDiretorio.replace(/[\x00-\x1f\x7f]/g, "");
  const limpo = semControle.trim();
  if (!limpo || limpo === "." || limpo === "..") return "evidencia";
  return limpo.length > MAX_ORIGINAL_NAME ? limpo.slice(-MAX_ORIGINAL_NAME) : limpo;
}

/**
 * Texto é o único tipo aceito sem assinatura binária própria, então a
 * heurística precisa ser mais dura que "decodifica como UTF-8": bytes de
 * controle SÃO code points UTF-8 válidos, e um buffer tipo 00 01 02 passava
 * como text/plain. Só TAB, LF e CR são controles legítimos num arquivo de
 * texto — qualquer outro indica binário.
 */
function isPlainText(buffer: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return false;
  }
  for (const byte of buffer) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    if (byte < 0x20 || byte === 0x7f) return false;
  }
  return true;
}

/**
 * Detecta o tipo real do arquivo pelos primeiros bytes (magic number), sempre
 * no offset 0 — ver limitação 3 no cabeçalho.
 *
 * PNG: 89 50 4E 47 ("\x89PNG") · JPEG: FF D8 FF (cobre JFIF FF D8 FF E0,
 * Exif FF D8 FF E1 e demais variantes de APPn) · PDF: 25 50 44 46 ("%PDF").
 * Texto: sem assinatura, decidido por isPlainText().
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
  return isPlainText(buffer) ? "text/plain" : null;
}

/**
 * Garante que um caminho resolvido continua DENTRO de UPLOADS_ROOT.
 * Defesa em profundidade: hoje nenhum componente do caminho vem do cliente
 * (é sempre companyId/vulnId do banco + UUID gerado aqui), mas se um registro
 * for adulterado por outra via, o download não pode virar leitura arbitrária
 * de arquivo do servidor.
 */
function resolveDentroDeUploads(relativePath: string): string {
  const absoluto = path.resolve(UPLOADS_ROOT, relativePath);
  const raizComSeparador = UPLOADS_ROOT.endsWith(path.sep) ? UPLOADS_ROOT : UPLOADS_ROOT + path.sep;
  if (absoluto !== UPLOADS_ROOT && !absoluto.startsWith(raizComSeparador)) {
    throw new Error("EVIDENCE_NOT_FOUND");
  }
  return absoluto;
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

    // Nome em disco NUNCA vem do cliente: UUID + extensão do tipo DETECTADO
    // (não da extensão enviada). Diretório vem do banco (companyId/vulnId),
    // não da URL — os dois são cuid() gerados pelo Prisma.
    const fileName = `${randomUUID()}${EXTENSION_BY_TYPE[detectedType]}`;
    const relativeDir = path.join(vulnerability.companyId, vulnerability.id);
    const relativePath = path.join(relativeDir, fileName);
    // valida contenção antes de escrever, não só na leitura
    const absoluteFile = resolveDentroDeUploads(relativePath);
    const absoluteDir = path.dirname(absoluteFile);

    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(absoluteFile, file.buffer);

    const created = await this.repository.create({
      vulnerabilityId,
      fileName,
      originalName: sanitizeOriginalName(file.originalname),
      filePath: relativePath,
      mimeType: detectedType,
      sizeBytes: file.buffer.length,
      proof,
      uploadedBy: actor.userId,
    });

    return new EvidenceEntity(created);
  }

  /**
   * Resolve o caminho absoluto pro controller servir.
   *
   * A ORDEM importa e é a defesa principal contra IDOR: busca o registro,
   * busca a Vulnerability dona, CHECA ACESSO, e só então resolve o caminho.
   * Nada toca o disco antes da autorização passar.
   *
   * O caminho é montado 100% a partir do REGISTRO NO BANCO (evidence.filePath,
   * gravado no upload como companyId/vulnId/uuid.ext). O único dado da URL é
   * o evidenceId, usado como chave de busca — nenhum componente do caminho
   * vem do cliente, então `../` na URL não tem por onde entrar.
   */
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
      absolutePath: resolveDentroDeUploads(evidence.filePath),
      fileName: sanitizeOriginalName(evidence.originalName),
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
