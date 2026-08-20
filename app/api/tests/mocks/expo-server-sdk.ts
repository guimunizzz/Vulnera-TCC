/**
 * tests/mocks/expo-server-sdk.ts
 *
 * Mock manual do pacote `expo-server-sdk`, mapeado globalmente em
 * jest.config.ts (`moduleNameMapper`). Dois motivos pra existir:
 *
 * 1. O build publicado do pacote é ESM puro (`import ... from "node:assert"`
 *    sem transpilar) — o Jest (CommonJS) quebra com "Cannot use import
 *    statement outside a module" ao tentar carregar o módulo real, mesmo
 *    em testes que nunca chamam push nenhum (qualquer teste que importa
 *    `app.ts` já puxa a cadeia até aqui via vulnerability.service.ts).
 * 2. PUSH-02 pede explicitamente "mock do envio; não bater na API da Expo
 *    dentro do CI" — este arquivo É esse mock, aplicado uma vez só pra
 *    toda a suíte em vez de cada teste remontar o seu.
 *
 * Comportamento imita o pacote real o suficiente pra `push.util.ts` rodar
 * de ponta a ponta de verdade (chunking, leitura de ticket) contra um
 * backend falso, em vez de mockar push.util.ts inteiro — testa mais código
 * real com o mesmo esforço.
 */

export class Expo {
  static isExpoPushToken(token: string): boolean {
    return typeof token === "string" && /^Expo(nent)?PushToken\[.+\]$/.test(token);
  }

  chunkPushNotifications<T>(messages: T[]): T[][] {
    return [messages]; // suficiente pros testes — nunca passam de 1 lote
  }

  async sendPushNotificationsAsync(
    messages: Array<{ to: string }>,
  ): Promise<Array<{ status: "ok" | "error"; id?: string; message?: string }>> {
    return messages.map((_, i) => ({ status: "ok", id: `fake-ticket-${i}` }));
  }
}

export type ExpoPushMessage = { to: string; sound?: string; title?: string; body?: string; data?: unknown };
export type ExpoPushTicket = { status: "ok" | "error"; id?: string; message?: string };
