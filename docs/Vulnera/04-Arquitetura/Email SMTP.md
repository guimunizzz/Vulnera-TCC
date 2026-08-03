---
type: documentacao-tecnica
tags: [architecture, source-of-truth, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> E-mail transacional saiu do escopo do MVP. O Mailhog permanece no Docker Compose para uso futuro, mas nenhum fluxo depende de e-mail — a rastreabilidade é coberta por [[AuditLog]].
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Email SMTP

## Resumo
O Vulnera usa e-mail transacional para notificações críticas e recuperação de acesso. Em desenvolvimento, o Mailhog intercepta os e-mails localmente. Em produção, um servidor SMTP real (ex: SendGrid, Resend ou SMTP corporativo) é configurado via variáveis de ambiente.

## Papel na arquitetura
- canal de comunicação assíncrono para eventos que exigem confirmação fora da plataforma
- complementar às notificações in-app — não substitui, reforça
- único canal disponível para usuários que não estão logados (reset de senha)

## Tecnologia
- **Nodemailer** como biblioteca de envio
- **Mailhog** em desenvolvimento (captura e-mails sem enviar de verdade)
- SMTP externo configurável em produção via variáveis de ambiente

## Configuração

### Desenvolvimento (Mailhog via Docker Compose)
```yaml
mailhog:
  image: mailhog/mailhog:v1.0.1
  container_name: vulnera-mail
  ports:
    - "1025:1025"  # SMTP
    - "8025:8025"  # Web UI
```

Acesso à interface web: `http://localhost:8025`

### Variáveis de ambiente
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=           # vazio em dev
SMTP_PASS=           # vazio em dev
SMTP_FROM=noreply@vulnera.local
```

Em produção, substituir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` pelas credenciais do provedor real.

## Eventos que disparam e-mail

| Evento | Destinatário | Descrição |
|---|---|---|
| Nova assinatura pendente | Admin | Link direto para aprovação |
| Assinatura aprovada | Cliente (OWNER) | Boas-vindas com acesso |
| Ticket de suporte aberto | Admin | Subject + resumo + link direto |
| Resposta em ticket | Cliente | Notificação de resposta |
| Finding crítico criado | Cliente (OWNER) | Alerta com título do finding |
| Reset de senha | Usuário solicitante | Link com token de reset (TTL curto) |
| Comentário em finding | Partes envolvidas | Notificação de nova interação |

## Módulo Express (estrutura esperada)

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

## Considerações de segurança
- token de reset de senha enviado por e-mail deve ter TTL curto (15–60 min) e ser invalidado após uso — ver [[PasswordResetToken]]
- **nunca incluir dados sensíveis no corpo do e-mail**: sem hashes, tokens completos, senhas ou detalhes técnicos internos
- o link de reset deve conter apenas o token de curto prazo — o back-end valida o hash
- rate limiting no endpoint de "esqueci minha senha" para prevenir flood de e-mails
- credenciais SMTP devem estar em variáveis de ambiente — nunca em código ou no vault

## Riscos e cuidados
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
