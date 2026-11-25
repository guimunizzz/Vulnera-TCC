// Servidor SMTP mínimo e local para exercitar o protocolo real sem provedor externo.
// Mantém as conexões e mensagens de cada teste sob controle da suíte de integração.

import { createServer, type AddressInfo, type Server, type Socket } from "node:net";

export type SmtpTestServerOptions = {
  silentGreeting?: boolean;
  greetingDelayMs?: number;
  username?: string;
  password?: string;
  rejectAuthentication?: boolean;
  rejectRecipients?: boolean;
  rejectData?: boolean;
  advertiseStartTls?: boolean;
  advertiseSmtpUtf8?: boolean;
  stallAfterData?: boolean;
};

export class SmtpTestServer {
  readonly messages: string[] = [];
  readonly commands: string[] = [];
  readonly recipientCommands: string[] = [];
  readonly sockets = new Set<Socket>();
  connectionCount = 0;
  authenticationAttempts = 0;
  authenticatedCount = 0;

  private readonly server: Server;
  private readonly options: SmtpTestServerOptions;
  private greetingTimers = new Set<NodeJS.Timeout>();
  private listeningPort: number | undefined;

  constructor(options: SmtpTestServerOptions = {}) {
    this.options = options;
    this.server = createServer((socket) => this.accept(socket));
  }

  get port(): number {
    if (this.listeningPort === undefined) throw new Error("SMTP_TEST_SERVER_NOT_LISTENING");
    return this.listeningPort;
  }

  async listen(): Promise<this> {
    if (this.server.listening) return this;
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.server.off("error", onError);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(0, "127.0.0.1");
    });

    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("SMTP_TEST_SERVER_INVALID_ADDRESS");
    this.listeningPort = (address as AddressInfo).port;
    return this;
  }

  async close(): Promise<void> {
    for (const timer of this.greetingTimers) clearTimeout(timer);
    this.greetingTimers.clear();
    for (const socket of this.sockets) socket.destroy();

    if (!this.server.listening) return;
    await new Promise<void>((resolve) => {
      const forceClose = setTimeout(() => {
        for (const socket of this.sockets) socket.destroy();
        resolve();
      }, 1_000);
      forceClose.unref();
      this.server.close(() => {
        clearTimeout(forceClose);
        resolve();
      });
    });
    this.listeningPort = undefined;
  }

  private accept(socket: Socket): void {
    this.connectionCount += 1;
    this.sockets.add(socket);
    socket.setNoDelay(true);
    socket.setTimeout(5_000, () => socket.destroy());
    socket.once("close", () => this.sockets.delete(socket));
    socket.on("error", () => undefined);

    if (this.options.silentGreeting) return;
    const timer = setTimeout(() => {
      this.greetingTimers.delete(timer);
      if (!socket.destroyed) socket.write("220 localhost ESMTP ready\r\n");
    }, this.options.greetingDelayMs ?? 0);
    this.greetingTimers.add(timer);

    let buffered = "";
    let readingData = false;
    let messageLines: string[] = [];
    let authStage: "USERNAME" | "PASSWORD" | "PLAIN" | null = null;
    let authUsername = "";

    socket.on("data", (chunk) => {
      buffered += chunk.toString("utf8");
      for (;;) {
        const lineEnd = buffered.indexOf("\r\n");
        if (lineEnd < 0) break;
        const line = buffered.slice(0, lineEnd);
        buffered = buffered.slice(lineEnd + 2);

        if (readingData) {
          if (line === ".") {
            readingData = false;
            this.messages.push(messageLines.join("\r\n"));
            messageLines = [];
            if (!this.options.stallAfterData) {
              socket.write(this.options.rejectData ? "554 5.6.0 Message rejected\r\n" : "250 2.0.0 Message accepted\r\n");
            }
          } else {
            messageLines.push(line.startsWith("..") ? line.slice(1) : line);
          }
          continue;
        }

        this.commands.push(line);
        const command = line.match(/^([A-Z]+)(?:\s+(.*))?$/iu);
        const verb = command?.[1]?.toUpperCase() ?? "";
        const argument = command?.[2] ?? "";

        if (authStage === "USERNAME") {
          authUsername = decodeCredential(line);
          authStage = "PASSWORD";
          socket.write("334 UGFzc3dvcmQ6\r\n");
          continue;
        }
        if (authStage === "PLAIN") {
          authStage = null;
          const fields = decodeCredential(line).split("\0");
          const username = fields.length >= 2 ? fields[fields.length - 2] : "";
          this.finishAuthentication(socket, username, fields[fields.length - 1] ?? "");
          continue;
        }
        if (authStage === "PASSWORD") {
          const password = decodeCredential(line);
          authStage = null;
          this.finishAuthentication(socket, authUsername, password);
          continue;
        }

        switch (verb) {
          case "EHLO": {
            const startTls = this.options.advertiseStartTls ? "250-STARTTLS\r\n" : "";
            const smtpUtf8 = this.options.advertiseSmtpUtf8 ? "250-SMTPUTF8\r\n" : "";
            const auth = this.options.username ? "250-AUTH PLAIN LOGIN\r\n" : "";
            socket.write(`250-localhost\r\n${startTls}${smtpUtf8}${auth}250 SIZE 10485760\r\n`);
            break;
          }
          case "HELO":
            socket.write("250 localhost\r\n");
            break;
          case "AUTH":
            this.handleAuthentication(socket, argument, (stage, username) => {
              authStage = stage;
              authUsername = username;
            });
            break;
          case "MAIL":
            socket.write("250 2.1.0 Sender accepted\r\n");
            break;
          case "RCPT":
            this.recipientCommands.push(argument);
            socket.write(this.options.rejectRecipients
              ? "550 5.1.1 Recipient rejected\r\n"
              : "250 2.1.5 Recipient accepted\r\n");
            break;
          case "DATA":
            if (this.options.rejectRecipients) {
              socket.write("503 5.5.1 No valid recipients\r\n");
            } else {
              readingData = true;
              socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
            }
            break;
          case "RSET":
          case "NOOP":
            socket.write("250 2.0.0 OK\r\n");
            break;
          case "QUIT":
            socket.write("221 2.0.0 Bye\r\n");
            socket.end();
            break;
          case "STARTTLS":
            // A TLS negotiation is intentionally absent. Tests that advertise
            // STARTTLS use another server fixture if the adapter requires it.
            socket.write("454 4.7.0 TLS unavailable in test server\r\n");
            break;
          default:
            socket.write("500 5.5.2 Command not recognized\r\n");
        }
      }
    });
  }

  private handleAuthentication(
    socket: Socket,
    argument: string,
    setStage: (stage: "USERNAME" | "PASSWORD" | "PLAIN" | null, username: string) => void,
  ): void {
    const [mechanism, response] = argument.split(/\s+/u, 2);
    if (mechanism?.toUpperCase() === "PLAIN" && response) {
      const fields = decodeCredential(response).split("\0");
      const username = fields.length >= 2 ? fields[fields.length - 2] : "";
      const password = fields[fields.length - 1] ?? "";
      this.finishAuthentication(socket, username, password);
      return;
    }
    if (mechanism?.toUpperCase() === "PLAIN") {
      socket.write("334 \r\n");
      setStage("PLAIN", "");
      return;
    }
    if (mechanism?.toUpperCase() === "LOGIN") {
      socket.write("334 VXNlcm5hbWU6\r\n");
      setStage("USERNAME", "");
      return;
    }
    socket.write("504 5.5.4 Unsupported authentication mechanism\r\n");
  }

  private finishAuthentication(socket: Socket, username: string, password: string): void {
    this.authenticationAttempts += 1;
    const matches = username === this.options.username && password === this.options.password;
    if (!this.options.rejectAuthentication && matches) {
      this.authenticatedCount += 1;
      socket.write("235 2.7.0 Authentication successful\r\n");
    } else {
      socket.write("535 5.7.8 Authentication credentials invalid\r\n");
    }
  }
}

function decodeCredential(value: string): string {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}
