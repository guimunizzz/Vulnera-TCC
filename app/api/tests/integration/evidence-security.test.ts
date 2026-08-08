/**
 * evidence-security.test.ts
 *
 * Superfície de ataque do upload/download de evidência. Upload é o ponto
 * mais atacável de um produto de segurança, então cada item aqui ou prova
 * uma defesa que existe, ou documenta um comportamento aceito de propósito.
 *
 * Complementa evidence.test.ts (que cobre o fluxo funcional). Separado
 * porque este arquivo é material de defesa do TCC: cada `it` corresponde a
 * uma pergunta que uma banca de segurança faria.
 *
 * Coberto aqui:
 *   SEC-EV-01  path traversal na URL de download
 *   SEC-EV-02  IDOR cross-tenant (autorização antes do disco)
 *   SEC-EV-03  magic number — variantes de JPEG, PDF, e binário disfarçado de texto
 *   SEC-EV-04  limite de 10MB aplicado pelo multer no stream
 *   SEC-EV-05  Content-Disposition com nome de arquivo hostil
 *   SEC-EV-06  extensão em disco vem do tipo DETECTADO, não do nome enviado
 *   SEC-EV-07  polyglot (limitação conhecida, documentada)
 */

import request from "supertest";
import * as fs from "fs";
import * as path from "path";
import { app } from "../../src/app";
import { cleanDatabase } from "../setup";
import { prisma } from "../../src/database/prisma.database";
import { seedUser } from "../fixtures/users.fixture";
import { seedPlan } from "../fixtures/plans.fixture";
import { seedCompany } from "../fixtures/companies.fixture";
import { seedApplication } from "../fixtures/applications.fixture";
import { seedProject } from "../fixtures/projects.fixture";
import { seedVulnerability } from "../fixtures/vulnerabilities.fixture";
import { loginAs } from "../fixtures/auth.fixture";

const PASSWORD = "senha12345";
const UPLOADS_TEST_ROOT = path.resolve(process.cwd(), "uploads-test");

// PNG mínimo válido (assinatura de 8 bytes + IHDR truncado)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
// JPEG/JFIF — FF D8 FF E0 seguido do identificador "JFIF"
const JPEG_JFIF = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
// JPEG/Exif — FF D8 FF E1 (foto de celular típica)
const JPEG_EXIF = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x16, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1");

/** Cria company + application + project + vulnerability + ADMIN logado. */
async function cenarioBase(sufixo = "") {
  const plan = await seedPlan({ name: `BASIC${sufixo}` });
  const company = await seedCompany({ name: `Acme${sufixo}`, planId: plan.id });
  const application = await seedApplication({ name: `App${sufixo}`, companyId: company.id });
  const project = await seedProject({ name: `Projeto${sufixo}`, applicationId: application.id, companyId: company.id });
  const admin = await seedUser({
    name: "Admin",
    email: `admin${sufixo}@vulnera.local`,
    password: PASSWORD,
    role: "ADMIN",
  });
  const adminToken = await loginAs(app, admin.email, PASSWORD);
  const vulnerability = await seedVulnerability({
    projectId: project.id,
    applicationId: application.id,
    companyId: company.id,
    createdBy: admin.id,
  });
  return { plan, company, application, project, admin, adminToken, vulnerability };
}

async function subirEvidencia(vulnId: string, token: string, buffer: Buffer, nome: string) {
  return request(app)
    .post(`/api/vulnerabilities/${vulnId}/evidences`)
    .set("Authorization", `Bearer ${token}`)
    .field("proof", "prova")
    .attach("file", buffer, nome);
}

describe("Evidence — superfície de ataque", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(() => {
    fs.rmSync(UPLOADS_TEST_ROOT, { recursive: true, force: true });
  });

  // ==========================================================================
  // SEC-EV-01 — Path traversal
  // ==========================================================================
  describe("SEC-EV-01: o caminho do arquivo deriva do REGISTRO NO BANCO, nunca da URL", () => {
    it("evidenceId com ../ na URL não escapa do diretório de uploads", async () => {
      const { vulnerability, adminToken } = await cenarioBase();

      // O evidenceId é usado só como chave de busca. Qualquer travessia vira
      // simplesmente um id que não existe.
      for (const idHostil of [
        "..%2f..%2f..%2fetc%2fpasswd",
        "....//....//package.json",
        "%2e%2e%2f%2e%2e%2fpackage.json",
      ]) {
        const res = await request(app)
          .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${idHostil}`)
          .set("Authorization", `Bearer ${adminToken}`);

        // 404 — nunca 200 com conteúdo de outro arquivo. Pode vir do service
        // (EVIDENCE_NOT_FOUND, id inexistente) ou do próprio router, quando o
        // %2f decodifica pra "/" e nenhuma rota casa. Os dois são seguros.
        expect(res.status).toBe(404);
        if (res.body?.error) expect(res.body.error).toBe("EVIDENCE_NOT_FOUND");
        expect(res.text).not.toContain("@vulnera/api"); // conteúdo do package.json
        expect(res.text).not.toContain("[fonts]"); // conteúdo do win.ini
      }
    });

    it("caminho absoluto no lugar do evidenceId não serve arquivo do servidor", async () => {
      const { vulnerability, adminToken } = await cenarioBase();

      const res = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${encodeURIComponent("C:/Windows/win.ini")}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it("registro adulterado no banco com filePath de travessia é recusado (defesa em profundidade)", async () => {
      const { vulnerability, admin, adminToken } = await cenarioBase();

      // Simula corrupção/adulteração vinda de outra via que não o upload:
      // grava um filePath que aponta pra fora de uploads-test/.
      const adulterada = await prisma.evidence.create({
        data: {
          vulnerabilityId: vulnerability.id,
          fileName: "malicioso.txt",
          originalName: "malicioso.txt",
          filePath: path.join("..", "..", "package.json"),
          mimeType: "text/plain",
          sizeBytes: 10,
          proof: "adulterado",
          uploadedBy: admin.id,
        },
      });

      const res = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${adulterada.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      // resolveDentroDeUploads() barra antes de qualquer leitura de disco
      expect(res.status).toBe(404);
      expect(res.text).not.toContain("@vulnera/api");
    });

    it("o arquivo em disco fica sempre sob uploads/{companyId}/{vulnId}/, com nome UUID", async () => {
      const { vulnerability, company, adminToken } = await cenarioBase();

      const res = await subirEvidencia(vulnerability.id, adminToken, PNG, "print.png");
      expect(res.status).toBe(201);

      const esperado = path.join(UPLOADS_TEST_ROOT, company.id, vulnerability.id, res.body.fileName);
      expect(fs.existsSync(esperado)).toBe(true);
      expect(res.body.fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
    });
  });

  // ==========================================================================
  // SEC-EV-02 — IDOR cross-tenant
  // ==========================================================================
  describe("SEC-EV-02: IDOR — evidência de outra company", () => {
    it("CLIENT da company B não baixa nem lista evidência da company A", async () => {
      const a = await cenarioBase("A");
      const b = await cenarioBase("B");

      const criada = await subirEvidencia(a.vulnerability.id, a.adminToken, PNG, "print.png");
      expect(criada.status).toBe(201);

      const clientB = await seedUser({
        name: "Client B",
        email: "clientB@vulnera.local",
        password: PASSWORD,
        role: "CLIENT",
        companyId: b.company.id,
        companyRole: "OWNER",
      });
      const tokenB = await loginAs(app, clientB.email, PASSWORD);

      const download = await request(app)
        .get(`/api/vulnerabilities/${a.vulnerability.id}/evidences/${criada.body.id}`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(download.status).toBe(403);
      expect(download.body.error).toBe("FORBIDDEN");

      const lista = await request(app)
        .get(`/api/vulnerabilities/${a.vulnerability.id}/evidences`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(lista.status).toBe(403);

      const upload = await subirEvidencia(a.vulnerability.id, tokenB, PNG, "invasao.png");
      expect(upload.status).toBe(403);
    });

    it("a autorização acontece ANTES de tocar o disco — arquivo apagado do disco ainda dá 403, não 500", async () => {
      const a = await cenarioBase("A");
      const b = await cenarioBase("B");

      const criada = await subirEvidencia(a.vulnerability.id, a.adminToken, PNG, "print.png");
      const registro = await prisma.evidence.findUnique({ where: { id: criada.body.id } });
      // remove o arquivo, mantendo o registro: se a checagem de acesso viesse
      // DEPOIS do disco, o erro de I/O apareceria antes do 403 e vazaria a
      // informação de que o registro existe.
      fs.rmSync(path.join(UPLOADS_TEST_ROOT, registro!.filePath), { force: true });

      const clientB = await seedUser({
        name: "Client B",
        email: "clientB@vulnera.local",
        password: PASSWORD,
        role: "CLIENT",
        companyId: b.company.id,
        companyRole: "OWNER",
      });
      const tokenB = await loginAs(app, clientB.email, PASSWORD);

      const res = await request(app)
        .get(`/api/vulnerabilities/${a.vulnerability.id}/evidences/${criada.body.id}`)
        .set("Authorization", `Bearer ${tokenB}`);
      expect(res.status).toBe(403);
    });

    it("filePath nunca aparece na resposta da API (nem no list, nem no upload)", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const criada = await subirEvidencia(vulnerability.id, adminToken, PNG, "print.png");
      expect(criada.body).not.toHaveProperty("filePath");

      const lista = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(lista.body[0]).not.toHaveProperty("filePath");
    });
  });

  // ==========================================================================
  // SEC-EV-03 — Magic number
  // ==========================================================================
  describe("SEC-EV-03: detecção por assinatura de bytes", () => {
    it.each([
      ["JPEG/JFIF (FF D8 FF E0)", JPEG_JFIF, "image/jpeg", ".jpg"],
      ["JPEG/Exif (FF D8 FF E1) — foto de celular", JPEG_EXIF, "image/jpeg", ".jpg"],
      ["PDF (%PDF)", PDF, "application/pdf", ".pdf"],
      ["PNG (89 50 4E 47)", PNG, "image/png", ".png"],
    ])("aceita %s", async (_nome, buffer, mimeEsperado, extensaoEsperada) => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await subirEvidencia(vulnerability.id, adminToken, buffer as Buffer, "evidencia.bin");
      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe(mimeEsperado);
      expect(res.body.fileName.endsWith(extensaoEsperada as string)).toBe(true);
    });

    it("binário só com bytes de controle NÃO passa mais como text/plain", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      // 00 01 02 são code points UTF-8 perfeitamente válidos — o TextDecoder
      // sozinho aceitava. É preciso barrar bytes de controle explicitamente.
      const binarioUtf8Valido = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

      const res = await subirEvidencia(vulnerability.id, adminToken, binarioUtf8Valido, "log.txt");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_FILE_TYPE");
    });

    it("texto legítimo com acento, tab e quebra de linha continua aceito", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const texto = Buffer.from("Requisição:\tGET /api/users?id=1' OR '1'='1\r\nResposta: 200 OK\n", "utf-8");

      const res = await subirEvidencia(vulnerability.id, adminToken, texto, "request.txt");
      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe("text/plain");
    });

    it("PDF com lixo ANTES do %PDF é recusado (limitação documentada: assinatura só no offset 0)", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const pdfDeslocado = Buffer.concat([Buffer.from([0xde, 0xad, 0xbe, 0xef]), PDF]);

      const res = await subirEvidencia(vulnerability.id, adminToken, pdfDeslocado, "relatorio.pdf");
      // Falso-negativo ACEITO de propósito: aceitar assinatura em offset
      // arbitrário é justamente o que facilita polyglot.
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("INVALID_FILE_TYPE");
    });

    it("arquivo vazio é recusado", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await subirEvidencia(vulnerability.id, adminToken, Buffer.alloc(0), "vazio.png");
      expect(res.status).toBe(400);
    });

    it("PNG truncado (só os 4 bytes da assinatura) é aceito — a validação é de tipo, não de integridade", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await subirEvidencia(vulnerability.id, adminToken, Buffer.from([0x89, 0x50, 0x4e, 0x47]), "t.png");
      expect(res.status).toBe(201);
    });
  });

  // ==========================================================================
  // SEC-EV-04 — Limite de tamanho
  // ==========================================================================
  describe("SEC-EV-04: limite de 10MB", () => {
    it(
      "arquivo de 25MB é cortado pelo multer no stream — responde 400 sem bufferizar tudo",
      async () => {
        const { vulnerability, adminToken } = await cenarioBase();
        const gigante = Buffer.concat([
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          Buffer.alloc(25 * 1024 * 1024),
        ]);

        const antes = process.memoryUsage().heapUsed;
        const res = await subirEvidencia(vulnerability.id, adminToken, gigante, "enorme.png");
        const cresceu = process.memoryUsage().heapUsed - antes;

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("FILE_TOO_LARGE");
        // O heap não pode ter crescido na ordem do arquivo enviado — prova de
        // que o corte é no stream, não depois de montar o Buffer inteiro.
        expect(cresceu).toBeLessThan(25 * 1024 * 1024);
      },
      30000,
    );

    it("arquivo logo abaixo do limite é aceito", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const quaseNoLimite = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(9 * 1024 * 1024),
      ]);

      const res = await subirEvidencia(vulnerability.id, adminToken, quaseNoLimite, "grande.png");
      expect(res.status).toBe(201);
    }, 30000);
  });

  // ==========================================================================
  // SEC-EV-05 — Content-Disposition
  // ==========================================================================
  describe("SEC-EV-05: nome original no download", () => {
    it("nome com CRLF não injeta header — o valor volta escapado/percent-encoded", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const criada = await subirEvidencia(vulnerability.id, adminToken, PNG, "print.png");

      // o nome hostil é gravado direto no banco pra driblar o multer, que já
      // normaliza parte disso no parsing do multipart
      await prisma.evidence.update({
        where: { id: criada.body.id },
        data: { originalName: "evil.png\r\nX-Injetado: sim" },
      });

      const res = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${criada.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["x-injetado"]).toBeUndefined();
      expect(res.headers["content-disposition"]).not.toContain("\r\n");
    });

    it("nome com travessia de diretório vira só o basename no Content-Disposition", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const criada = await subirEvidencia(vulnerability.id, adminToken, PNG, "print.png");

      await prisma.evidence.update({
        where: { id: criada.body.id },
        data: { originalName: "..\\..\\..\\Windows\\System32\\evil.exe" },
      });

      const res = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${criada.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain("evil.exe");
      expect(res.headers["content-disposition"]).not.toContain("System32\\evil.exe");
      expect(res.headers["content-disposition"]).not.toContain("..");
    });

    it("nome enviado no upload já chega sanitizado ao banco (sem diretório, sem controle)", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await subirEvidencia(vulnerability.id, adminToken, PNG, "../../etc/passwd.png");

      expect(res.status).toBe(201);
      expect(res.body.originalName).toBe("passwd.png");
    });

    it("nome maior que a coluna (191 chars) é truncado, não vira 500", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const nomeEnorme = "a".repeat(300) + ".png";

      const res = await subirEvidencia(vulnerability.id, adminToken, PNG, nomeEnorme);
      expect(res.status).toBe(201);
      expect(res.body.originalName.length).toBeLessThanOrEqual(191);
    });

    it("download vem com attachment + nosniff (não renderiza inline no navegador)", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const criada = await subirEvidencia(vulnerability.id, adminToken, PNG, "print.png");

      const res = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${criada.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.headers["content-disposition"]).toMatch(/^attachment/);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });
  });

  // ==========================================================================
  // SEC-EV-06 — Extensão em disco
  // ==========================================================================
  describe("SEC-EV-06: extensão em disco vem do tipo DETECTADO", () => {
    it("PNG enviado com nome .exe é gravado como .png", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await subirEvidencia(vulnerability.id, adminToken, PNG, "payload.exe");

      expect(res.status).toBe(201);
      expect(res.body.fileName).toMatch(/\.png$/);
      expect(res.body.mimeType).toBe("image/png");
    });

    it("PDF enviado com nome .png é gravado como .pdf (nome do cliente é ignorado)", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await subirEvidencia(vulnerability.id, adminToken, PDF, "disfarce.png");

      expect(res.status).toBe(201);
      expect(res.body.fileName).toMatch(/\.pdf$/);
      expect(res.body.mimeType).toBe("application/pdf");
    });

    it("nem o nome nem o Content-Type declarado influenciam — só os bytes", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const res = await request(app)
        .post(`/api/vulnerabilities/${vulnerability.id}/evidences`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", PDF, { filename: "foto.png", contentType: "image/png" });

      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe("application/pdf");
    });
  });

  // ==========================================================================
  // SEC-EV-07 — Polyglot (limitação conhecida)
  // ==========================================================================
  describe("SEC-EV-07: polyglot — limitação conhecida, documentada", () => {
    it("PNG válido no header com payload arbitrário depois É ACEITO — e as mitigações funcionam", async () => {
      const { vulnerability, adminToken } = await cenarioBase();
      const polyglot = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from("<script>alert(1)</script>MZ\x00\x00PAYLOAD_EXECUTAVEL", "latin1"),
      ]);

      const res = await subirEvidencia(vulnerability.id, adminToken, polyglot, "polyglot.png");

      // ACEITO: a assinatura prova como o arquivo se apresenta, não que o
      // resto seja inofensivo. Bloquear exigiria parse completo do formato.
      expect(res.status).toBe(201);

      // As mitigações que tornam isso aceitável no escopo do MVP:
      expect(res.body.fileName).toMatch(/^[0-9a-f-]{36}\.png$/); // 1. nome UUID, nunca executável pelo nome
      expect(res.body.mimeType).toBe("image/png"); // 2. servido como imagem

      const download = await request(app)
        .get(`/api/vulnerabilities/${vulnerability.id}/evidences/${res.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(download.headers["content-disposition"]).toMatch(/^attachment/); // 3. nunca inline
      expect(download.headers["x-content-type-options"]).toBe("nosniff"); // 4. sem MIME sniffing
    });
  });
});
