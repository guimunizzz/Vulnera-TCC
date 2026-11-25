// Fornece um remetente previsível para testes de serviços de e-mail.
// Permite observar mensagens, falhas e a ordem entre commit e envio.
// Consumido pelos testes de integração da API.

import type { EmailMessage, EmailSender } from "../../src/models/email.model";

type FakeEmailSenderOptions = {
  fail?: boolean;
  beforeSend?: (message: EmailMessage) => void | Promise<void>;
};

function copyMessage(message: EmailMessage): EmailMessage {
  return { ...message };
}

export class FakeEmailSender implements EmailSender {
  private readonly sentMessages: EmailMessage[] = [];

  constructor(private readonly options: FakeEmailSenderOptions = {}) {}

  get messages(): EmailMessage[] {
    return this.sentMessages.map(copyMessage);
  }

  async send(message: EmailMessage): Promise<void> {
    const snapshot = copyMessage(message);

    try {
      await this.options.beforeSend?.(copyMessage(snapshot));
    } catch {
      throw new Error("EMAIL_DELIVERY_FAILED");
    }

    if (this.options.fail) throw new Error("EMAIL_DELIVERY_FAILED");

    this.sentMessages.push(snapshot);
  }
}
