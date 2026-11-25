// Envia mensagens transacionais por SMTP com Nodemailer e TLS verificado.
// Existe para manter detalhes do transporte fora das regras de negócio.
// Consumido pela factory do EmailSender; recebe a configuração SMTP já validada.
import nodemailer from "nodemailer";
import { domainToASCII } from "node:url";
import type { SmtpConfig } from "../config/email.config";
import {
  isSingleEmailAddress,
  type EmailMessage,
  type EmailSender,
} from "../models/email.model";

const DELIVERY_FAILURE_CODE = "EMAIL_DELIVERY_FAILED";
const MESSAGE_FIELDS = new Set(["to", "subject", "text", "html"]);

function splitEmailAddress(
  value: string,
): { localPart: string; domain: string } | null {
  const separator = value.lastIndexOf("@");
  if (
    separator <= 0 ||
    separator !== value.indexOf("@") ||
    separator === value.length - 1
  ) {
    return null;
  }

  return {
    localPart: value.slice(0, separator),
    domain: value.slice(separator + 1),
  };
}

function normalizedForComparison(value: string): string | null {
  const address = splitEmailAddress(value);
  if (!address) return null;

  const asciiDomain = domainToASCII(address.domain);
  if (!asciiDomain) return null;

  // O local-part permanece literal; somente o domínio recebe normalização IDNA.
  return `${address.localPart}@${asciiDomain.toLowerCase()}`;
}

function deliveryFailure(): Error {
  return new Error(DELIVERY_FAILURE_CODE);
}

function readMessage(value: unknown): EmailMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw deliveryFailure();
  }

  const keys = Object.keys(value);
  if (
    keys.length !== MESSAGE_FIELDS.size ||
    keys.some((key) => !MESSAGE_FIELDS.has(key)) ||
    [...MESSAGE_FIELDS].some((key) => !Object.hasOwn(value, key))
  ) {
    throw deliveryFailure();
  }

  const message = value as Record<string, unknown>;
  if (
    typeof message.to !== "string" ||
    !isSingleEmailAddress(message.to)
  ) {
    throw deliveryFailure();
  }

  if (
    typeof message.subject !== "string" ||
    /[\r\n]/u.test(message.subject) ||
    typeof message.text !== "string" ||
    typeof message.html !== "string"
  ) {
    throw deliveryFailure();
  }

  return {
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
}

function acceptedOnlyRecipient(accepted: unknown, recipient: string): boolean {
  if (!Array.isArray(accepted) || accepted.length !== 1) return false;

  const acceptedRecipient: unknown = accepted[0];
  const acceptedAddress =
    typeof acceptedRecipient === "string"
      ? acceptedRecipient
      : typeof acceptedRecipient === "object" && acceptedRecipient !== null
        ? (acceptedRecipient as { address?: unknown }).address
        : undefined;
  const normalizedAccepted =
    typeof acceptedAddress === "string"
      ? normalizedForComparison(acceptedAddress)
      : null;
  const normalizedRecipient = normalizedForComparison(recipient);

  return (
    normalizedAccepted !== null &&
    normalizedRecipient !== null &&
    normalizedAccepted === normalizedRecipient
  );
}

export class SmtpEmailAdapter implements EmailSender {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    if (!isSingleEmailAddress(config.from)) throw deliveryFailure();

    this.from = config.from;
    try {
      // Sem pool, o Nodemailer abre uma conexão SMTP independente por mensagem.
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        requireTLS: config.requireTLS,
        ...(config.auth
          ? { auth: { user: config.auth.user, pass: config.auth.pass } }
          : {}),
        connectionTimeout: config.connectionTimeoutMs,
        greetingTimeout: config.greetingTimeoutMs,
        socketTimeout: config.socketTimeoutMs,
        pool: false,
        logger: false,
        debug: false,
        transactionLog: false,
        disableFileAccess: true,
        disableUrlAccess: true,
        tls: {
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
        },
      });
    } catch {
      throw deliveryFailure();
    }
  }

  // A resolução confirma aceitação SMTP; o adaptador não acompanha a entrega na caixa.
  async send(message: EmailMessage): Promise<void> {
    try {
      const safeMessage = readMessage(message);
      const info = await this.transporter.sendMail({
        from: this.from,
        to: safeMessage.to,
        subject: safeMessage.subject,
        text: safeMessage.text,
        html: safeMessage.html,
      });

      if (
        !acceptedOnlyRecipient(info.accepted, safeMessage.to) ||
        !Array.isArray(info.rejected) ||
        info.rejected.length > 0
      ) {
        throw deliveryFailure();
      }
    } catch {
      throw deliveryFailure();
    }
  }
}
