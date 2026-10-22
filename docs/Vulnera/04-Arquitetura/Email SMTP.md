---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: parcial
---

> [!info] Escopo parcial — revisado em 2026-10-22
> A Etapa 2 da Issue #51 concluiu a verificação de e-mail para solicitações de acesso e foi validada com fixtures SMTP locais. Não houve teste com provedor externo, credenciais reais, certificado público ou inbox. Veja [[SECURITY-AUTH-ETAPA-2]]. Outros e-mails (reset de senha, convites, tickets e notificações) continuam fora do escopo. A antiga decisão de não ter qualquer fluxo de e-mail é histórica.
>
> O aviso original de julho de 2026 permanece como histórico para reset de senha e demais notificações. A exceção atual é a verificação de e-mail da Issue #51, concluída no recorte da Etapa 2; não implementar os outros eventos sem nova decisão de escopo.
> Fonte da decisão histórica: [[Contexto Mestre v4]] §14. Estado atual: [[SECURITY-AUTH-ETAPA-2]].

# Email SMTP

> Esta nota contém a visão arquitetural anterior e o contrato específico atual em
> [[SECURITY-AUTH-ETAPA-2]] e [[ADR-047 - Fundacao do acesso controlado]]. A
> implementação atual é limitada à verificação de e-mail de `AccessRequest`;
> os eventos genéricos listados abaixo não significam que esses fluxos existam.

## Resumo histórico — visão anterior substituída

> Os parágrafos abaixo descrevem uma proposta antiga. O sistema atual não envia
> notificações críticas, recuperação de acesso, tickets ou alertas por e-mail.
> O único fluxo implementado nesta etapa é a verificação de endereço de um
> `AccessRequest`; ver [[SECURITY-AUTH-ETAPA-2]].

O Vulnera usaria e-mail transacional para notificações críticas e recuperação de acesso. Em desenvolvimento, o Mailhog interceptaria as mensagens. Em produção, um servidor SMTP real seria configurado por ambiente.

## Papel na arquitetura (proposta histórica)
- canal de comunicação assíncrono para eventos que exigem confirmação fora da plataforma
- complementar às notificações in-app — não substitui, reforça
- único canal disponível para usuários que não estão logados (reset de senha)

## Tecnologia prevista na proposta histórica
- **Nodemailer** como biblioteca de envio
- **Mailhog** em desenvolvimento (captura e-mails sem enviar de verdade)
- SMTP externo configurável em produção via variáveis de ambiente

## Configuração da proposta histórica

### Desenvolvimento (Mailhog via Docker Compose, exemplo histórico)
```yaml
mailhog:
  image: mailhog/mailhog:v1.0.1
  container_name: vulnera-mail
  ports:
    - "1025:1025"  # SMTP
    - "8025:8025"  # Web UI
```

Acesso à interface web: `http://localhost:8025`

### Variáveis de ambiente (exemplo histórico)
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=           # vazio em dev
SMTP_PASS=           # vazio em dev
SMTP_FROM=noreply@vulnera.local
```

Em produção, substituir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` pelas credenciais do provedor real.

### Configuração vigente da verificação de acesso

O fluxo usa Nodemailer através de `SmtpEmailAdapter`. Quando a factory cria
esse adapter, estas variáveis são obrigatórias: `SMTP_HOST`, `SMTP_FROM` e
`PUBLIC_WEB_URL`. `SMTP_USER` e `SMTP_PASS` são opcionais, mas devem ser
configuradas em par. Valores opcionais e padrões: `SMTP_PORT=1025`,
`SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=false` fora de produção,
`SMTP_CONNECTION_TIMEOUT_MS=10000`, `SMTP_GREETING_TIMEOUT_MS=10000` e
`SMTP_SOCKET_TIMEOUT_MS=20000`. Em produção, TLS precisa estar habilitado ou
ser exigido, e `PUBLIC_WEB_URL` precisa usar HTTPS. `app/api/.env.example`
contém valores locais para Mailhog.

A configuração é resolvida de forma lazy quando a factory não recebe um sender
injetado. A factory apenas monta o serviço: não há rota, endpoint HTTP nem tela
frontend conectados. A futura tela deve ler o token do fragmento
`/verify-email#token=...` e enviá-lo ao endpoint que vier a ser definido.

## Eventos propostos historicamente (não implementados)

| Evento | Destinatário | Descrição |
|---|---|---|
| Nova assinatura pendente | Admin | Link direto para aprovação |
| Assinatura aprovada | Cliente (OWNER) | Boas-vindas com acesso |
| Ticket de suporte aberto | Admin | Subject + resumo + link direto |
| Resposta em ticket | Cliente | Notificação de resposta |
| Finding crítico criado | Cliente (OWNER) | Alerta com título do finding |
| Reset de senha | Usuário solicitante | Link com token de reset (TTL curto) |
| Comentário em finding | Partes envolvidas | Notificação de nova interação |

## Módulo NestJS da proposta histórica (não implementado)

```ts
// email.service.ts
@Injectable()
export class EmailService {
  private transporter: Transporter

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({ /* config */ })
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({ from: this.config.get('SMTP_FROM'), to, subject, html })
  }
}
```

Os métodos específicos (`sendPasswordReset`, `sendTicketNotification`, etc.) ficam no `EmailService` ou em serviços de domínio que o utilizam.

## Considerações de segurança da proposta histórica
- token de reset de senha enviado por e-mail deve ter TTL curto (15–60 min) e ser invalidado após uso — ver [[PasswordResetToken]]
- **nunca incluir dados sensíveis no corpo do e-mail**: sem hashes, tokens completos, senhas ou detalhes técnicos internos
- o link de reset deve conter apenas o token de curto prazo — o back-end valida o hash
- rate limiting no endpoint de "esqueci minha senha" para prevenir flood de e-mails
- credenciais SMTP devem estar em variáveis de ambiente — nunca em código ou no vault

## Riscos e cuidados descritos na proposta histórica
- envio de e-mail é operação assíncrona best-effort: falha no SMTP não deve travar a operação de negócio principal
- em dev, verificar sempre o Mailhog (`http://localhost:8025`) para confirmar envio
- e-mails com HTML devem ser testados em clientes variados — evitar CSS complexo
- sem fila de retry no MVP: e-mails não enviados são perdidos — aceitável no escopo do TCC

## Links relacionados
[[Notification]]
[[PasswordResetToken]]
[[RN22 - Nova assinatura notifica Admin]]
[[RN23 - Ticket de suporte gera email para Admin]]
[[Notificacoes]]
[[Docker Compose]]
[[MOC - Arquitetura]]
