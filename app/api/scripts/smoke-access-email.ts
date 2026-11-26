/**
 * Smoke reversível do contrato de verificação de e-mail da Issue 51.
 * Produz evidências redigidas contra um schema descartável e MailHog local.
 * Consumidor: execução manual pelo harness da tarefa; não faz parte da API.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

type ScenarioRow = { scenario: string; expected: string; obtained: string; pass: boolean };
type MailHogMessage = {
  ID?: string;
  Created?: string;
  From?: unknown;
  To?: unknown;
  Content?: { Headers?: Record<string, string[]>; Body?: string };
  MIME?: { Parts?: MailHogPart[] };
};
type MailHogPart = {
  Headers?: Record<string, string[]>;
  Body?: string;
  MIME?: { Parts?: MailHogPart[] };
};

const results: ScenarioRow[] = [];
const MASKED_ERROR = "falha de asserção ou integração (detalhe omitido)";
const outputPath = resolve(__dirname, "../../../output/issue51-mailhog-smoke.json");

class SmokeAssertionError extends Error {
  constructor(readonly code: string) { super(code); }
}

function requireSafeEnvironment(): { databaseUrl: URL; mailhogUrl: URL } {
  if (process.env.NODE_ENV !== "test") throw new Error("NODE_ENV precisa ser test");
  const rawDatabaseUrl = process.env.DATABASE_URL ?? "";
  let databaseUrl: URL;
  try { databaseUrl = new URL(rawDatabaseUrl); } catch { throw new Error("DATABASE_URL inválida"); }
  if (
    databaseUrl.protocol !== "mysql:" || databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "33354" || databaseUrl.pathname !== "/issue51_smoke" ||
    databaseUrl.search || databaseUrl.hash
  ) throw new Error("DATABASE_URL fora do alvo descartável autorizado");

  if (process.env.SMTP_HOST !== "127.0.0.1" || process.env.SMTP_PORT !== "1025") {
    throw new Error("SMTP precisa apontar ao MailHog local autorizado");
  }
  if ((process.env.SMTP_USER ?? "") !== "" || (process.env.SMTP_PASS ?? "") !== "") {
    throw new Error("Este smoke não aceita credenciais SMTP");
  }
  if (process.env.SMTP_FROM !== "no-reply@vulnera.test") {
    throw new Error("SMTP_FROM precisa usar o remetente fictício do smoke");
  }
  if (process.env.PUBLIC_WEB_URL !== "http://127.0.0.1:3000") {
    throw new Error("PUBLIC_WEB_URL precisa ser loopback");
  }

  let mailhogUrl: URL;
  try { mailhogUrl = new URL(process.env.MAILHOG_API_URL ?? ""); } catch { throw new Error("MAILHOG_API_URL inválida"); }
  if (
    mailhogUrl.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(mailhogUrl.hostname) ||
    mailhogUrl.port !== "8025" || mailhogUrl.username || mailhogUrl.password ||
    mailhogUrl.pathname !== "/" || mailhogUrl.search || mailhogUrl.hash
  ) throw new Error("MAILHOG_API_URL fora do alvo local autorizado");
  return { databaseUrl, mailhogUrl };
}

function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new SmokeAssertionError(code);
}

async function scenario<T>(name: string, expected: string, operation: () => Promise<{ value: T; obtained: string }>): Promise<T | undefined> {
  try {
    const result = await operation();
    results.push({ scenario: name, expected, obtained: result.obtained, pass: true });
    return result.value;
  } catch (error) {
    const obtained = error instanceof SmokeAssertionError ? error.code : MASKED_ERROR;
    results.push({ scenario: name, expected, obtained, pass: false });
    return undefined;
  }
}

function quotedPrintable(value: string): string {
  const normalized = value.replace(/=\r?\n/gu, "");
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] === "=" && /^[\da-f]{2}$/iu.test(normalized.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(...Buffer.from(normalized[index], "utf8"));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function decodeBody(value: string, encoding: string): string {
  const normalized = encoding.trim().toLowerCase();
  if (normalized === "quoted-printable") return quotedPrintable(value);
  if (normalized === "base64") return Buffer.from(value.replace(/\s/gu, ""), "base64").toString("utf8");
  return value;
}

function header(headers: Record<string, string[]> | undefined, name: string): string {
  const found = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(found) ? found.join(", ") : "";
}

function decodeEncodedWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/giu, (_match, _charset: string, encoding: string, data: string) => {
    if (encoding.toLowerCase() === "b") return Buffer.from(data, "base64").toString("utf8");
    return quotedPrintable(data.replace(/_/gu, " "));
  });
}

function bodies(message: MailHogMessage): { text: string; html: string } {
  const found: string[] = [];
  const visit = (part: MailHogPart) => {
    const type = header(part.Headers, "Content-Type").toLowerCase();
    const encoding = header(part.Headers, "Content-Transfer-Encoding");
    if (part.Body && type.startsWith("text/")) found.push(`${type}\n${decodeBody(part.Body, encoding)}`);
    for (const nested of part.MIME?.Parts ?? []) visit(nested);
  };
  for (const part of message.MIME?.Parts ?? []) visit(part);
  if (found.length === 0 && message.Content?.Body) {
    const type = header(message.Content.Headers, "Content-Type").toLowerCase();
    const encoding = header(message.Content.Headers, "Content-Transfer-Encoding");
    found.push(`${type}\n${decodeBody(message.Content.Body, encoding)}`);
  }
  return {
    text: found.find((part) => part.startsWith("text/plain"))?.replace(/^.*?\n/u, "") ?? "",
    html: found.find((part) => part.startsWith("text/html"))?.replace(/^.*?\n/u, "") ?? "",
  };
}

function tokenFromBodies(message: MailHogMessage): string {
  const content = bodies(message);
  const match = `${content.text}\n${content.html}`.match(/#token=([A-Za-z0-9_-]{43})/u);
  ensure(match, "mailhog_token_missing");
  return match[1];
}

async function searchMail(mailhogUrl: URL, address: string): Promise<MailHogMessage[]> {
  const url = new URL("api/v2/search", mailhogUrl);
  url.searchParams.set("kind", "to");
  url.searchParams.set("query", address);
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  ensure(response.ok, "mailhog_search_failed");
  const payload = await response.json() as { items?: MailHogMessage[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

async function waitForMail(mailhogUrl: URL, address: string, minimum: number): Promise<MailHogMessage[]> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const messages = await searchMail(mailhogUrl, address);
    if (messages.length >= minimum) return messages;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error("mailhog_message_timeout");
}

function tokenFromText(text: string): string {
  const match = text.match(/#token=([A-Za-z0-9_-]{43})/u);
  ensure(match, "smtp_link_token_missing");
  return match[1];
}

async function main(): Promise<void> {
  const { mailhogUrl } = requireSafeEnvironment();
  // Importação tardia: a guarda do alvo ocorre antes de criar PrismaClient.
  const [{ prisma }, { readEmailConfig }, { makeEmailVerificationService }, { SmtpEmailAdapter }, { AccessRequestRepository }, { hashAccessToken }] = await Promise.all([
    import("../src/database/prisma.database"),
    import("../src/config/email.config"),
    import("../src/factories/email-verification.factory"),
    import("../src/adapters/smtp-email.adapter"),
    import("../src/repositories/access-request.repository"),
    import("../src/utils/access-token.util"),
  ]);

  const config = readEmailConfig();
  ensure(config.smtp.host === "127.0.0.1" && config.smtp.port === 1025, "email_config_target_mismatch");
  const requests = new AccessRequestRepository(prisma);
  let now = new Date("2026-10-23T12:00:00.000Z");
  const clock = () => new Date(now);
  const service = () => makeEmailVerificationService({ clock });
  const createRequest = async (label: string, createdAt = now) => {
    const email = `${label}-${randomUUID()}@empresa.test`;
    const row = await requests.createIfEmailAvailable({ name: "Pessoa do smoke", email, companyName: "Empresa fictícia" }, createdAt);
    ensure(row, "request_creation_failed");
    return { row, email };
  };
  const counts = async () => {
    const [users, companies, subscriptions, refreshTokens, invitations] = await Promise.all([
      prisma.user.count(), prisma.company.count(), prisma.subscription.count(),
      prisma.refreshToken.count(), prisma.accessInvitation.count(),
    ]);
    return { users, companies, subscriptions, refreshTokens, invitations };
  };
  const baseline = await counts();

  let observedCommitBeforeSmtp = false;
  const originalSend = SmtpEmailAdapter.prototype.send;
  SmtpEmailAdapter.prototype.send = async function (message) {
    const rawToken = tokenFromText(message.text);
    const parent = await requests.findActiveByEmail(message.to);
    const slot = parent ? await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: parent.id } }) : null;
    const events = parent ? await requests.findEvents(parent.id) : [];
    observedCommitBeforeSmtp = Boolean(parent && slot && slot.tokenHash === hashAccessToken(rawToken)
      && events.some((event) => event.eventType === "VERIFICATION_ISSUED"));
    ensure(observedCommitBeforeSmtp, "commit_not_visible_before_smtp");
    return originalSend.call(this, message);
  };
  const first = await createRequest("issue");
  const issued = await scenario("emissão, commit pré-SMTP, hash e mensagem MailHog", "SENT; commit visível no adapter antes do SMTP; hash/TTL/evento persistidos; MIME correto", async () => {
    const outcome = await service().issueVerification(first.row.id);
    const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: first.row.id } });
    const events = await requests.findEvents(first.row.id);
    const mails = await waitForMail(mailhogUrl, first.email, 1);
    const mail = mails[0];
    const content = bodies(mail);
    const token = tokenFromBodies(mail);
    const headers = mail.Content?.Headers;
    const subject = decodeEncodedWords(header(headers, "Subject"));
    const from = header(headers, "From");
    const to = header(headers, "To");
    ensure(outcome === "SENT" && observedCommitBeforeSmtp, "issuance_or_commit_order");
    ensure(slot?.tokenHash === hashAccessToken(token) && slot.expiresAt.getTime() - now.getTime() === 3_600_000, "stored_hash_or_ttl");
    ensure(events.some((event) => event.eventType === "VERIFICATION_ISSUED"), "issue_event_missing");
    ensure(from.includes("no-reply@vulnera.test") && to.includes(first.email), "sender_or_recipient_mismatch");
    ensure(subject.includes("Confirme seu e-mail") && subject.includes("Vulnera"), "subject_mismatch");
    ensure(content.text.includes("Confirme o e-mail") && content.html.includes("Confirmar meu e-mail"), "mime_bodies_missing");
    ensure(content.text.includes("http://127.0.0.1:3000/verify-email#token=") && content.html.includes("http://127.0.0.1:3000/verify-email#token="), "fragment_link_missing");
    ensure(!JSON.stringify(slot).includes(token), "raw_token_persisted");
    SmtpEmailAdapter.prototype.send = originalSend;
    return { value: token, obtained: "SENT; hash+TTL+evento e commit pré-SMTP confirmados; remetente, destino, assunto, text/html e fragmento validados" };
  });
  SmtpEmailAdapter.prototype.send = originalSend;

  if (issued) {
    await scenario("token inválido e confirmação com replay", "inválido=false; confirmação válida=true; replay=false; PENDING_REVIEW e emailVerifiedAt", async () => {
      const invalid = await service().confirmEmail("token-invalido");
      const confirmed = await service().confirmEmail(issued);
      const replay = await service().confirmEmail(issued);
      const parent = await requests.findById(first.row.id);
      const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: first.row.id } });
      const events = await requests.findEvents(first.row.id);
      ensure(!invalid && confirmed && !replay, "confirm_result_mismatch");
      ensure(parent?.status === "PENDING_REVIEW" && parent.emailVerifiedAt?.getTime() === now.getTime(), "confirmed_state_mismatch");
      ensure(slot?.usedAt?.getTime() === now.getTime() && events.filter((event) => event.eventType === "STATUS_TRANSITION").length === 2, "confirmation_not_atomic_or_replayable");
      return { value: undefined, obtained: "inválido=false; válido=true; replay=false; estado, horário, consumo e trilha confirmados" };
    });
  }

  const expiredToken = await createRequest("expired-token");
  const expiredIssue = await service().issueVerification(expiredToken.row.id);
  const expiredMail = expiredIssue === "SENT" ? await waitForMail(mailhogUrl, expiredToken.email, 1) : [];
  const expiredRaw = expiredMail[0] ? tokenFromBodies(expiredMail[0]) : undefined;
  const expiredSlot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: expiredToken.row.id } });
  if (expiredRaw && expiredSlot) {
    await scenario("token expirado", "confirmEmail=false sem consumo; pedido continua aguardando verificação", async () => {
      now = new Date(expiredSlot.expiresAt.getTime() + 1);
      const confirmed = await service().confirmEmail(expiredRaw);
      const parent = await requests.findById(expiredToken.row.id);
      const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: expiredToken.row.id } });
      ensure(!confirmed && parent?.status === "PENDING_EMAIL_VERIFICATION" && slot?.usedAt === null, "expired_token_behavior");
      return { value: undefined, obtained: "false; token não consumido e pedido preservado" };
    });
  } else {
    results.push({ scenario: "token expirado", expected: "confirmEmail=false sem consumo; pedido continua aguardando verificação", obtained: MASKED_ERROR, pass: false });
  }
  now = new Date("2026-10-23T12:00:00.000Z");

  const rotated = await createRequest("rotation");
  const rotateFirst = await service().issueVerification(rotated.row.id);
  const rotateMail1 = rotateFirst === "SENT" ? await waitForMail(mailhogUrl, rotated.email, 1) : [];
  const oldToken = rotateMail1[0] ? tokenFromBodies(rotateMail1[0]) : undefined;
  const rotateSecond = await service().resendVerification(rotated.row.id);
  const rotateMail2 = rotateSecond === "SENT" ? await waitForMail(mailhogUrl, rotated.email, 2) : [];
  const newToken = rotateMail2.length >= 2 ? tokenFromBodies([...rotateMail2].sort((a, b) => Date.parse(a.Created ?? "") - Date.parse(b.Created ?? ""))[1]) : undefined;
  await scenario("reenvio e rotação", "SENT; token anterior recusado; token atual aceito", async () => {
    ensure(rotateFirst === "SENT" && rotateSecond === "SENT" && oldToken && newToken && oldToken !== newToken, "rotation_delivery_mismatch");
    const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: rotated.row.id } });
    const events = await requests.findEvents(rotated.row.id);
    ensure(slot?.tokenHash === hashAccessToken(newToken), "rotation_hash_mismatch");
    ensure(events.some((event) => event.eventType === "VERIFICATION_REISSUED"), "resend_event_missing");
    ensure(!(await service().confirmEmail(oldToken)), "old_token_still_valid");
    ensure(await service().confirmEmail(newToken), "new_token_rejected");
    return { value: undefined, obtained: "dois envios; hash aponta ao reenvio; token antigo recusado e atual consumido" };
  });

  const concurrent = await createRequest("concurrent-confirm");
  const concurrentIssue = await service().issueVerification(concurrent.row.id);
  const concurrentMails = concurrentIssue === "SENT" ? await waitForMail(mailhogUrl, concurrent.email, 1) : [];
  const concurrentToken = concurrentMails[0] ? tokenFromBodies(concurrentMails[0]) : undefined;
  await scenario("confirmações concorrentes", "uma confirmação verdadeira e outra falsa; PENDING_REVIEW", async () => {
    ensure(concurrentToken && concurrentIssue === "SENT", "concurrent_setup_failed");
    const outcomes = await Promise.all([service().confirmEmail(concurrentToken), service().confirmEmail(concurrentToken)]);
    const parent = await requests.findById(concurrent.row.id);
    ensure(outcomes.filter(Boolean).length === 1 && parent?.status === "PENDING_REVIEW", "concurrent_confirmation_not_serialized");
    return { value: undefined, obtained: "uma confirmação aceita e uma recusada; estado final PENDING_REVIEW" };
  });

  const confirmResend = await createRequest("concurrent-resend");
  const crIssue = await service().issueVerification(confirmResend.row.id);
  const crMails1 = crIssue === "SENT" ? await waitForMail(mailhogUrl, confirmResend.email, 1) : [];
  const crOld = crMails1[0] ? tokenFromBodies(crMails1[0]) : undefined;
  await scenario("confirmação concorrente com reenvio", "uma única ordem serial válida; pedido termina em PENDING_REVIEW", async () => {
    ensure(crOld && crIssue === "SENT", "confirm_resend_setup_failed");
    const outcomes = await Promise.all([service().confirmEmail(crOld), service().resendVerification(confirmResend.row.id)]);
    const parent = await requests.findById(confirmResend.row.id);
    if (outcomes[0] === true) {
      ensure(parent?.status === "PENDING_REVIEW", "confirm_resend_confirm_state");
      ensure(outcomes[1] === "NOT_ELIGIBLE", "resend_won_after_confirm");
      return { value: undefined, obtained: "confirmação serializada primeiro; reenvio inelegível" };
    }
    ensure(outcomes[0] === false && outcomes[1] === "SENT", "unexpected_race_outcome");
    ensure(parent?.status === "PENDING_EMAIL_VERIFICATION", "confirm_resend_resend_state");
    const allMessages = await waitForMail(mailhogUrl, confirmResend.email, 2);
    const emailedTokens = allMessages.map(tokenFromBodies);
    const current = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: confirmResend.row.id } });
    const currentTokens = emailedTokens.filter((token) => current?.tokenHash === hashAccessToken(token));
    ensure(currentTokens.length === 1, "resend_race_hash_mismatch");
    ensure(!(await service().confirmEmail(crOld)) && await service().confirmEmail(currentTokens[0]), "resend_race_token_validity");
    return { value: undefined, obtained: "reenvio serializado primeiro; token anterior recusado, atual aceito" };
  });

  const concurrentResends = await createRequest("concurrent-resends");
  const rrIssue = await service().issueVerification(concurrentResends.row.id);
  const rrInitial = rrIssue === "SENT" ? await waitForMail(mailhogUrl, concurrentResends.email, 1) : [];
  await scenario("reenvios concorrentes", "dois reenvios serializados; apenas hash atual utilizável", async () => {
    ensure(rrIssue === "SENT" && rrInitial.length === 1, "concurrent_resend_setup_failed");
    const outcomes = await Promise.all([
      service().resendVerification(concurrentResends.row.id),
      service().resendVerification(concurrentResends.row.id),
    ]);
    ensure(outcomes.every((outcome) => outcome === "SENT"), "concurrent_resend_result");
    const mails = await waitForMail(mailhogUrl, concurrentResends.email, 3);
    const tokens = mails.map(tokenFromBodies);
    const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: concurrentResends.row.id } });
    const currentTokens = tokens.filter((token) => slot?.tokenHash === hashAccessToken(token));
    ensure(currentTokens.length === 1, "concurrent_resend_current_hash");
    const oldTokens = tokens.filter((token) => token !== currentTokens[0]);
    for (const token of oldTokens) ensure(!(await service().confirmEmail(token)), "concurrent_resend_old_token_valid");
    ensure(await service().confirmEmail(currentTokens[0]), "concurrent_resend_current_token_invalid");
    const events = await requests.findEvents(concurrentResends.row.id);
    ensure(events.filter((event) => event.eventType === "VERIFICATION_REISSUED").length === 2, "concurrent_resend_event_count");
    return { value: undefined, obtained: "dois reenvios aceitos; somente o hash persistido confirmou; dois eventos de rotação" };
  });

  const failedDelivery = await createRequest("smtp-failure");
  const normalPort = process.env.SMTP_PORT;
  process.env.SMTP_PORT = "1";
  process.env.SMTP_CONNECTION_TIMEOUT_MS = "500";
  process.env.SMTP_GREETING_TIMEOUT_MS = "500";
  process.env.SMTP_SOCKET_TIMEOUT_MS = "500";
  const failedOutcome = await service().issueVerification(failedDelivery.row.id);
  const failedSlot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: failedDelivery.row.id } });
  const failedEvents = await requests.findEvents(failedDelivery.row.id);
  process.env.SMTP_PORT = normalPort;
  process.env.SMTP_CONNECTION_TIMEOUT_MS = "1000";
  process.env.SMTP_GREETING_TIMEOUT_MS = "1000";
  process.env.SMTP_SOCKET_TIMEOUT_MS = "1000";
  const recoveredOutcome = await service().resendVerification(failedDelivery.row.id);
  const recoveredMails = recoveredOutcome === "SENT" ? await waitForMail(mailhogUrl, failedDelivery.email, 1) : [];
  await scenario("falha SMTP real e recuperação", "porta loopback fechada => DELIVERY_FAILED+revogação+evento; MailHog reenvia e confirma", async () => {
    ensure(failedOutcome === "DELIVERY_FAILED" && failedSlot?.revokedAt !== null, "smtp_failure_not_invalidated");
    ensure(failedEvents.some((event) => event.eventType === "VERIFICATION_DELIVERY_FAILED"), "delivery_failure_event_missing");
    ensure(recoveredOutcome === "SENT" && recoveredMails.length === 1, "smtp_recovery_failed");
    const recoveredToken = tokenFromBodies(recoveredMails[0]);
    ensure(await service().confirmEmail(recoveredToken), "recovered_token_unusable");
    return { value: undefined, obtained: "falha capturada e hash revogado; evento gravado; reenvio MailHog confirmado" };
  });

  const elapsedExpired = await createRequest("expired-request", new Date(now.getTime() - 8 * 86_400_000));
  await scenario("pedido já expirado", "issueVerification=NOT_ELIGIBLE; estado EXPIRED; sem token ou e-mail", async () => {
    const before = (await searchMail(mailhogUrl, elapsedExpired.email)).length;
    const outcome = await service().issueVerification(elapsedExpired.row.id);
    const parent = await requests.findById(elapsedExpired.row.id);
    const slot = await prisma.emailVerificationToken.findUnique({ where: { accessRequestId: elapsedExpired.row.id } });
    const after = (await searchMail(mailhogUrl, elapsedExpired.email)).length;
    ensure(outcome === "NOT_ELIGIBLE" && parent?.status === "EXPIRED" && !slot && before === after, "expired_request_behavior");
    return { value: undefined, obtained: "inelegível; EXPIRED; nenhum token ou e-mail" };
  });

  const verified = await createRequest("already-verified");
  const verifiedOutcome = await service().issueVerification(verified.row.id);
  const verifiedMails = verifiedOutcome === "SENT" ? await waitForMail(mailhogUrl, verified.email, 1) : [];
  const verifiedToken = verifiedMails[0] ? tokenFromBodies(verifiedMails[0]) : undefined;
  if (verifiedToken) await service().confirmEmail(verifiedToken);
  await scenario("pedido já verificado", "reenvio=NOT_ELIGIBLE e contagem de mensagem não aumenta", async () => {
    ensure(verifiedToken && (await requests.findById(verified.row.id))?.status === "PENDING_REVIEW", "verified_setup_failed");
    const before = (await searchMail(mailhogUrl, verified.email)).length;
    const outcome = await service().resendVerification(verified.row.id);
    const after = (await searchMail(mailhogUrl, verified.email)).length;
    ensure(outcome === "NOT_ELIGIBLE" && before === after, "already_verified_resend_allowed");
    return { value: undefined, obtained: "reenvio inelegível; nenhum e-mail adicional" };
  });

  const finalCounts = await counts();
  await scenario("isolamento sem criação de identidade ou assinatura", "contagens User, Company, Subscription, RefreshToken e AccessInvitation inalteradas", async () => {
    ensure(JSON.stringify(finalCounts) === JSON.stringify(baseline), "forbidden_records_changed");
    return { value: undefined, obtained: "contagens das cinco tabelas idênticas ao início" };
  });

  await prisma.$disconnect();
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    artifact: "issue51-mailhog-smoke",
    createdAt: new Date().toISOString(),
    target: { environment: "test", databaseHost: "127.0.0.1", databasePort: 33354, schema: "issue51_smoke", smtp: "127.0.0.1:1025", mailhogApi: "loopback:8025" },
    retainedFixtures: true,
    baselineCounts: baseline,
    finalCounts,
    scenarios: results,
    summary: { passed: results.filter((row) => row.pass).length, failed: results.filter((row) => !row.pass).length },
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  if (results.some((row) => !row.pass)) process.exitCode = 1;
  console.log(`Issue 51 MailHog smoke: ${results.filter((row) => row.pass).length}/${results.length} cenários aprovados; artefato redigido em output/issue51-mailhog-smoke.json`);
}

main().catch(async () => {
  await mkdir(resolve(outputPath, ".."), { recursive: true }).catch(() => undefined);
  await writeFile(outputPath, `${JSON.stringify({
    artifact: "issue51-mailhog-smoke",
    createdAt: new Date().toISOString(),
    target: { environment: "test", databaseHost: "127.0.0.1", databasePort: 33354, schema: "issue51_smoke", smtp: "loopback only", mailhogApi: "loopback only" },
    scenarios: [...results, { scenario: "preflight ou execução", expected: "alvo autorizado e harness concluído", obtained: MASKED_ERROR, pass: false }],
    summary: { passed: results.filter((row) => row.pass).length, failed: results.filter((row) => !row.pass).length + 1 },
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }).catch(() => undefined);
  console.error("Issue 51 MailHog smoke falhou; detalhes omitidos para preservar segredos e tokens.");
  process.exitCode = 1;
});
