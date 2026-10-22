/**
 * Exercita a configuração e o transporte SMTP em loopback, sem serviço externo.
 * Valida o contrato de segurança da infraestrutura usada pelo envio de verificação.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/database/prisma.database";
import { readEmailConfig, type SmtpConfig } from "../../src/config/email.config";
import { makeEmailVerificationService } from "../../src/factories/email-verification.factory";
import { isSingleEmailAddress, type EmailMessage } from "../../src/models/email.model";
import { SmtpEmailAdapter } from "../../src/adapters/smtp-email.adapter";
import { buildEmailVerificationMessage } from "../../src/utils/email-verification-message.util";
import { generateAccessToken, hashAccessToken } from "../../src/utils/access-token.util";
import { AccessRequestRepository } from "../../src/repositories/access-request.repository";
import { cleanDatabase } from "../setup";
import nodemailer from "nodemailer";
import { FakeEmailSender } from "../fixtures/fake-email-sender";
import { SmtpTestServer, type SmtpTestServerOptions } from "../fixtures/smtp-test-server";

const FROM = "no-reply@vulnera.test";
const RECIPIENT = "requester@empresa.test";
const SMTP_USER = "test-smtp-user";
const SMTP_PASSWORD = "local-only-smtp-password";
const MESSAGE: EmailMessage = {
  to: RECIPIENT,
  subject: "Verifique seu e-mail",
  text: "Confirme o acesso pelo link https://app.example.test/verify-email#token=test",
  html: "<p>Confirme seu e-mail.</p>",
};
const accessRequests = new AccessRequestRepository(prisma);
const ENV_KEYS = [
  "NODE_ENV",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_REQUIRE_TLS",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_CONNECTION_TIMEOUT_MS",
  "SMTP_GREETING_TIMEOUT_MS",
  "SMTP_SOCKET_TIMEOUT_MS",
  "PUBLIC_WEB_URL",
] as const;

const DEFAULT_ENV: Record<string, string> = {
  NODE_ENV: "test",
  SMTP_HOST: "127.0.0.1",
  SMTP_FROM: FROM,
  PUBLIC_WEB_URL: "http://127.0.0.1:3000",
};

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/gu, "")
    .replace(/=([a-f\d]{2})/giu, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

let servers: SmtpTestServer[] = [];

beforeEach(() => {
  servers = [];
});

afterEach(async () => {
  await Promise.all(servers.map((server) => server.close()));
  jest.restoreAllMocks();
});

function withEmailEnvironment<T>(overrides: Record<string, string | undefined>, operation: () => T): T {
  const prior = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) prior.set(key, process.env[key]);

  for (const key of ENV_KEYS) {
    const value = Object.hasOwn(overrides, key) ? overrides[key] : DEFAULT_ENV[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return operation();
  } finally {
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function startServer(options: SmtpTestServerOptions = {}): Promise<SmtpTestServer> {
  const server = await new SmtpTestServer(options).listen();
  servers.push(server);
  return server;
}

function smtpConfig(port: number, patch: Partial<SmtpConfig> = {}): SmtpConfig {
  return {
    host: "127.0.0.1",
    port,
    secure: false,
    requireTLS: false,
    from: FROM,
    connectionTimeoutMs: 1_000,
    greetingTimeoutMs: 1_000,
    socketTimeoutMs: 1_000,
    ...patch,
  };
}

describe("readEmailConfig", () => {
  it("lê origem SMTP e aplica timeouts padrão sem inventar credenciais", () => {
    const config = withEmailEnvironment({}, () => readEmailConfig());

    expect(config).toEqual({
      smtp: {
        host: "127.0.0.1",
        port: 1025,
        secure: false,
        requireTLS: false,
        from: FROM,
        connectionTimeoutMs: 10_000,
        greetingTimeoutMs: 10_000,
        socketTimeoutMs: 20_000,
      },
      publicWebUrl: "http://127.0.0.1:3000",
    });
  });

  it("aplica credenciais e opções SMTP explicitamente configuradas", () => {
    const config = withEmailEnvironment({
      SMTP_PORT: "2525",
      SMTP_SECURE: "false",
      SMTP_REQUIRE_TLS: "true",
      SMTP_USER,
      SMTP_PASS: SMTP_PASSWORD,
      SMTP_CONNECTION_TIMEOUT_MS: "1200",
      SMTP_GREETING_TIMEOUT_MS: "1300",
      SMTP_SOCKET_TIMEOUT_MS: "1400",
      PUBLIC_WEB_URL: "https://app.vulnera.example",
    }, () => readEmailConfig());

    expect(config).toEqual({
      smtp: {
        host: "127.0.0.1",
        port: 2525,
        secure: false,
        requireTLS: true,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
        from: FROM,
        connectionTimeoutMs: 1200,
        greetingTimeoutMs: 1300,
        socketTimeoutMs: 1400,
      },
      publicWebUrl: "https://app.vulnera.example",
    });
  });

  it.each([
    ["SMTP_HOST", undefined],
    ["SMTP_FROM", undefined],
    ["PUBLIC_WEB_URL", undefined],
    ["SMTP_PORT", "0"],
    ["SMTP_PORT", "65536"],
    ["SMTP_PORT", "25.5"],
    ["SMTP_SECURE", "yes"],
    ["SMTP_REQUIRE_TLS", "1"],
    ["SMTP_CONNECTION_TIMEOUT_MS", "0"],
    ["SMTP_GREETING_TIMEOUT_MS", "300001"],
    ["SMTP_SOCKET_TIMEOUT_MS", "1.5"],
    ["SMTP_USER", SMTP_USER],
    ["SMTP_PASS", SMTP_PASSWORD],
    ["SMTP_HOST", "smtp://user:secret@example.test"],
    ["SMTP_FROM", "Vulnera <no-reply@vulnera.test>"],
    ["SMTP_PASS", "bad\r\nBcc: victim@example.test"],
    ["SMTP_USER", "user name"],
  ] as const)("rejeita configuração inválida em %s=%s", (key, value) => {
    expect(() => withEmailEnvironment({ [key]: value }, () => readEmailConfig())).toThrow();
  });

  it("exige TLS SMTP e origem HTTPS em produção", () => {
    expect(() => withEmailEnvironment({
      NODE_ENV: "production",
      SMTP_SECURE: "false",
      SMTP_REQUIRE_TLS: "false",
      PUBLIC_WEB_URL: "https://app.vulnera.example",
    }, () => readEmailConfig())).toThrow();

    expect(() => withEmailEnvironment({
      NODE_ENV: "production",
      SMTP_SECURE: "true",
      SMTP_REQUIRE_TLS: "false",
      PUBLIC_WEB_URL: "http://app.vulnera.example",
    }, () => readEmailConfig())).toThrow();

    expect(withEmailEnvironment({
      NODE_ENV: "production",
      SMTP_SECURE: "false",
      SMTP_REQUIRE_TLS: "true",
      PUBLIC_WEB_URL: "https://app.vulnera.example",
    }, () => readEmailConfig()).publicWebUrl).toBe("https://app.vulnera.example");
  });

  it.each([
    "http://192.0.2.10",
    "http://mail.localhost",
    "https://app.vulnera.example/path",
    "https://user:pass@app.vulnera.example",
    "https://app.vulnera.example/?token=x",
    "https://app.vulnera.example/#token=x",
  ])("aceita somente origem pública sem rota, query ou credenciais: %s", (publicWebUrl) => {
    expect(() => withEmailEnvironment({ PUBLIC_WEB_URL: publicWebUrl }, () => readEmailConfig())).toThrow();
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("permite HTTP apenas nos endereços loopback definidos: %s", (publicWebUrl) => {
    expect(withEmailEnvironment({ PUBLIC_WEB_URL: publicWebUrl }, () => readEmailConfig()).publicWebUrl).toBe(publicWebUrl);
  });

  it("não inclui segredo SMTP na mensagem de configuração inválida", () => {
    let thrown: unknown;
    try {
      withEmailEnvironment({ SMTP_PASS: SMTP_PASSWORD, SMTP_SECURE: "invalid" }, () => readEmailConfig());
    } catch (error) {
      thrown = error;
    }
    expect(String(thrown)).not.toContain(SMTP_PASSWORD);
  });

  it("permite factory com sender e origem injetados sem ler configuração SMTP", () => {
    expect(() => withEmailEnvironment({
      SMTP_HOST: undefined,
      SMTP_FROM: undefined,
      PUBLIC_WEB_URL: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
    }, () => makeEmailVerificationService({
      sender: new FakeEmailSender(),
      publicWebUrl: "https://app.vulnera.example",
    }))).not.toThrow();
  });
});

describe("endereços e template de verificação", () => {
  it.each([
    "pessoa@exámple.test",
    "pessoa+é@empresa.test",
    "pessoa+e\u0301@empresa.test",
  ])("aceita endereço internacional individual %s", (address) => {
    expect(isSingleEmailAddress(address)).toBe(true);
  });

  it.each([
    "pessoa@empresa.test,outro@empresa.test",
    "pessoa@empresa.test\r\nBcc: vitima@empresa.test",
    "pessoa @empresa.test",
    "pessoa@empresa.test;outro@empresa.test",
    "pessoa@\u0301empresa.test",
  ])("recusa lista, injeção e formato Unicode inválido %j", (address) => {
    expect(isSingleEmailAddress(address)).toBe(false);
  });

  it("escapa o nome no HTML e mantém o token apenas no fragmento do link", () => {
    const token = generateAccessToken().token;
    const message = buildEmailVerificationMessage({
      to: RECIPIENT,
      name: "<img src=x onerror='alert(1)'>& \"Pessoa\"",
      token,
      expiresAt: new Date("2026-04-12T13:00:00.000Z"),
    }, "https://app.vulnera.example");
    const escaped = "&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp; &quot;Pessoa&quot;";
    const link = message.text.match(/https:\/\/[^\s]+\/verify-email#[^\s]+/u)?.[0];

    expect(message.html).toContain(escaped);
    expect(message.html).not.toContain("<img src=x");
    expect(link).toBe(`https://app.vulnera.example/verify-email#token=${token}`);
    expect(new URL(link!).search).toBe("");
    expect(new URL(link!).hash).toBe(`#token=${token}`);
    expect(() => buildEmailVerificationMessage({
      to: RECIPIENT,
      name: "Pessoa",
      token,
      expiresAt: new Date("2026-04-12T13:00:00.000Z"),
    }, "http://localhost:3000")).not.toThrow();
  });

  it.each([
    "javascript:alert(1)",
    "http://mail.localhost",
    "https://app.vulnera.example/path",
    "https://user:pass@app.vulnera.example",
  ])("recusa origem insegura ou fora da política: %s", (publicWebUrl) => {
    expect(() => buildEmailVerificationMessage({
      to: RECIPIENT,
      name: "Pessoa",
      token: generateAccessToken().token,
      expiresAt: new Date("2026-04-12T13:00:00.000Z"),
    }, publicWebUrl)).toThrow("INVALID_PUBLIC_WEB_URL");
  });

  it("FakeEmailSender copia mensagem/hook e normaliza erro do callback assíncrono", async () => {
    const hookMessages: EmailMessage[] = [];
    const sender = new FakeEmailSender({
      beforeSend: async (message) => {
        await Promise.resolve();
        hookMessages.push(message);
        message.subject = "alterado pelo hook";
      },
    });
    const input = { ...MESSAGE };

    await sender.send(input);
    input.text = "alterado pelo chamador";
    hookMessages[0].html = "alterado fora";
    const exposed = sender.messages;
    exposed[0].subject = "alterado pela leitura";

    expect(sender.messages).toEqual([MESSAGE]);
    expect(hookMessages[0].subject).toBe("alterado pelo hook");

    const failing = new FakeEmailSender({ beforeSend: async () => { throw new Error(SMTP_PASSWORD); } });
    let failure: unknown;
    try {
      await failing.send(MESSAGE);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({ message: "EMAIL_DELIVERY_FAILED" });
    expect(String(failure)).not.toContain(SMTP_PASSWORD);
  });
});

describe("SmtpEmailAdapter em SMTP loopback", () => {
  it("desativa logs e acessos a arquivo/URL no transporte", async () => {
    const server = await startServer();
    const createTransport = jest.spyOn(nodemailer, "createTransport");
    new SmtpEmailAdapter(smtpConfig(server.port));
    const options = createTransport.mock.calls[0][0] as Record<string, unknown>;

    expect(options).toMatchObject({
      logger: false,
      debug: false,
      transactionLog: false,
      disableFileAccess: true,
      disableUrlAccess: true,
      pool: false,
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
    expect(server.connectionCount).toBe(0);
  });

  it("envia mensagem por SMTP real e recebe confirmação do servidor local", async () => {
    const server = await startServer();
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port));

    await adapter.send(MESSAGE);

    expect(server.connectionCount).toBe(1);
    expect(server.commands.map((command) => command.slice(0, 4).toUpperCase())).toEqual(expect.arrayContaining([
      "EHLO", "MAIL", "RCPT", "DATA",
    ]));
    expect(server.messages).toHaveLength(1);
    expect(server.messages[0]).toContain(`To: ${RECIPIENT}`);
    expect(server.messages[0]).toContain("Subject: Verifique seu e-mail");
    expect(server.messages[0]).toContain(MESSAGE.text);
  });

  it("entrega domínios IDN canonicalizados para punycode e aceita parte local Unicode NFC/decomposta", async () => {
    const server = await startServer({ advertiseSmtpUtf8: true });
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port));
    const composed = "pessoa+é@empresa.test";
    const decomposed = "pessoa+e\u0301@empresa.test";
    const idnRecipient = "pessoa@exámple.test";
    const decomposedIdnRecipient = "pessoa@exa\u0301mple.test";

    await adapter.send({ ...MESSAGE, to: composed });
    await adapter.send({ ...MESSAGE, to: decomposed });
    await adapter.send({ ...MESSAGE, to: idnRecipient });
    await adapter.send({ ...MESSAGE, to: decomposedIdnRecipient });

    const canonicalDomain = new URL("http://exámple.test").hostname;
    expect(server.messages).toHaveLength(4);
    expect(server.recipientCommands).toContain(`TO:<${composed}>`);
    expect(server.recipientCommands).toContain(`TO:<${decomposed}>`);
    expect(server.recipientCommands).toContain(`TO:<pessoa@${canonicalDomain}>`);
    expect(server.recipientCommands.filter((command) => command === `TO:<pessoa@${canonicalDomain}>`)).toHaveLength(2);
  });

  it("usa a factory padrão até SMTP e confirma emissão no MySQL real", async () => {
    await cleanDatabase();
    const server = await startServer();
    const email = `factory-${randomUUID()}@empresa.test`;
    const now = new Date();

    try {
      const request = await accessRequests.createIfEmailAvailable({
        name: "Pessoa da solicitação",
        email,
        companyName: "Empresa de teste",
      }, now);
      expect(request).not.toBeNull();

      const service = withEmailEnvironment({
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(server.port),
        SMTP_SECURE: "false",
        SMTP_REQUIRE_TLS: "false",
        SMTP_FROM: FROM,
        PUBLIC_WEB_URL: "https://app.vulnera.example",
      }, () => makeEmailVerificationService({ clock: () => new Date(now) }));

      expect(await service.issueVerification(request!.id)).toBe("SENT");
      expect(server.recipientCommands).toEqual([`TO:<${email}>`]);
      expect(server.messages).toHaveLength(1);
      expect(server.messages[0]).toContain(`To: ${email}`);
      const decodedMessage = decodeQuotedPrintable(server.messages[0]);
      const token = decodedMessage.match(/\/verify-email#token=([A-Za-z0-9_-]{43})/u)?.[1];
      if (!token) throw new Error("Verification link was not present in the local SMTP message");

      const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: request!.id } });
      expect(slot?.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(slot?.tokenHash).toBe(hashAccessToken(token));
      expect(slot?.expiresAt.getTime()).toBeLessThanOrEqual(request!.expiresAt.getTime());
      expect((await accessRequests.findEvents(request!.id)).map((event) => event.eventType)).toContain("VERIFICATION_ISSUED");
      expect(await service.confirmEmail(token)).toBe(true);
      expect(await accessRequests.findById(request!.id)).toMatchObject({ status: "PENDING_REVIEW" });
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.refreshToken.count()).toBe(0);
    } finally {
      await cleanDatabase();
    }
  });

  it("não envia DATA quando o servidor recusa o destinatário", async () => {
    const server = await startServer({ rejectRecipients: true });
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port));

    await expect(adapter.send(MESSAGE)).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    expect(server.commands.some((command) => command.toUpperCase() === "DATA")).toBe(false);
    expect(server.messages).toHaveLength(0);
  });

  it("converte rejeição após DATA em falha genérica de entrega", async () => {
    const server = await startServer({ rejectData: true });
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port));

    await expect(adapter.send(MESSAGE)).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    expect(server.messages).toHaveLength(1);
  });

  it("autentica em SMTP local e não aceita credenciais inválidas", async () => {
    const server = await startServer({ username: SMTP_USER, password: SMTP_PASSWORD });
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port, {
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }));

    await adapter.send(MESSAGE);
    expect(server.authenticatedCount).toBe(1);
    expect(server.messages).toHaveLength(1);
  });

  it("oculta falha de autenticação e não registra a credencial", async () => {
    const server = await startServer({ username: SMTP_USER, password: "another-local-password", rejectAuthentication: true });
    const logs = [
      jest.spyOn(console, "log"),
      jest.spyOn(console, "info"),
      jest.spyOn(console, "warn"),
      jest.spyOn(console, "error"),
    ];
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port, {
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    }));

    let thrown: unknown;
    try {
      await adapter.send(MESSAGE);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toMatchObject({ message: "EMAIL_DELIVERY_FAILED" });
    expect(server.authenticationAttempts).toBeGreaterThan(0);
    const diagnostics = JSON.stringify(logs.map((log) => log.mock.calls));
    expect(diagnostics).not.toContain(SMTP_PASSWORD);
    expect(diagnostics).not.toContain("another-local-password");
  });

  it("não envia sem STARTTLS quando requireTLS está ativo", async () => {
    const server = await startServer();
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port, { requireTLS: true }));

    await expect(adapter.send(MESSAGE)).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    expect(server.commands.some((command) => command.toUpperCase().startsWith("EHLO"))).toBe(true);
    expect(server.commands.some((command) => command.toUpperCase().startsWith("MAIL"))).toBe(false);
    expect(server.messages).toHaveLength(0);
  });

  it("limita espera por greeting e por atividade do socket", async () => {
    const silentServer = await startServer({ silentGreeting: true });
    const greetingLimited = new SmtpEmailAdapter(smtpConfig(silentServer.port, {
      greetingTimeoutMs: 120,
      socketTimeoutMs: 500,
    }));
    await expect(greetingLimited.send(MESSAGE)).rejects.toThrow("EMAIL_DELIVERY_FAILED");

    const stalledServer = await startServer({ stallAfterData: true });
    const socketLimited = new SmtpEmailAdapter(smtpConfig(stalledServer.port, {
      greetingTimeoutMs: 500,
      socketTimeoutMs: 150,
    }));
    await expect(socketLimited.send(MESSAGE)).rejects.toThrow("EMAIL_DELIVERY_FAILED");
  });

  it.each([
    ["destinatário com lista", { ...MESSAGE, to: `${RECIPIENT},victim@example.test` }],
    ["destinatário com injeção", { ...MESSAGE, to: `${RECIPIENT}\r\nBcc: victim@example.test` }],
    ["assunto com quebra de cabeçalho", { ...MESSAGE, subject: "Confirme\r\nBcc: victim@example.test" }],
  ] as const)("rejeita %s antes de abrir conexão", async (_label, message) => {
    const server = await startServer();
    const adapter = new SmtpEmailAdapter(smtpConfig(server.port));

    await expect(adapter.send(message)).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    expect(server.connectionCount).toBe(0);
  });
});
