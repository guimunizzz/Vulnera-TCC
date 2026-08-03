---
type: documentacao-tecnica
tags: [architecture, source-of-truth, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> Socket.IO e comunicação em tempo real saíram do escopo do MVP.
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# WebSocket e Tempo Real

## Resumo
O Vulnera usa Socket.IO integrado ao Express para comunicação em tempo real. Dois casos de uso principais: chat de projeto (troca de mensagens entre cliente e pentester) e entrega de notificações in-app sem polling.

## Papel na arquitetura
- canal bidirecional permanente entre clientes e servidor
- entrega imediata de mensagens de chat e notificações
- complementar à API REST (não a substitui — operações de negócio continuam via HTTP)

## Tecnologia
- **Socket.IO** via `socket.io` e `express.io`
- **Socket.IO client** no front-end web (React + Vite)
- **Socket.IO client** no mobile Expo (via `socket.io-client`)

## Casos de uso

### 1. Chat de projeto
Cada projeto tem uma "sala" própria identificada por `project:<id>`.

```
Cliente e Pentester conectam → join('project:42')
Cliente envia mensagem → emit('message', payload)
Server: persiste ChatMessage no banco
Server: broadcast para todos na sala project:42
Pentester recebe em tempo real
```

Fluxo no servidor:
```ts
@SubscribeMessage('message')
async handleMessage(client: Socket, payload: MessageDto) {
  const userId = extractUserFromSocket(client)
  // valida ownership do project
  const msg = await this.chatService.save(payload, userId)
  this.server.to(`project:${payload.projectId}`).emit('message', msg)
}
```

### 2. Notificações in-app
Usuários ficam em uma sala pessoal `user:<id>`:

```
Usuário conecta → join('user:42')
Evento de negócio ocorre (ex: finding crítico)
NotificationService persiste Notification
NotificationService emite para sala 'user:42'
Front-end recebe e exibe badge/toast
```

## Autenticação no WebSocket
- o token JWT deve ser enviado no handshake (header `Authorization` ou query param `token`)
- um `WsAuthGuard` valida o token antes de permitir a conexão
- sem token válido: conexão recusada com `disconnect`

```ts
// handshake authentication
@UseGuards(WsAuthGuard)
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN } })
export class ChatGateway {}
```

## Ownership no WebSocket
- ao fazer `join('project:42')`, o servidor verifica se o usuário tem acesso ao projeto
- CLIENT: verifica se o projeto pertence à sua Company
- PENTESTER: verifica se é `ProjectMember` do projeto
- ADMIN: acesso total

Validação de ownership deve ocorrer no `join`, não apenas no `emit`.

## Considerações de segurança
- CORS deve ser configurado com whitelist de origens — nunca `origin: '*'` em produção
- autenticação obrigatória no handshake — nunca aceitar conexões sem JWT válido
- ownership verificado no `join room` — impedir que usuário não autorizado receba mensagens de outro projeto
- rate limiting: considerar limitar eventos por conexão para prevenir flood
- `content` das mensagens não deve ser processado como HTML no servidor

## Riscos e cuidados
- reconexão automática do Socket.IO pode expirar o token JWT — o cliente deve lidar com `disconnect` e reconectar com token renovado
- mensagens não entregues (cliente offline) ficam apenas no banco — o cliente busca histórico via API REST ao reconectar
- múltiplas tabs abertas no mesmo navegador criam múltiplas conexões — projetar o front-end para lidar com isso

## Integração com domínio
- persiste [[ChatMessage]] no banco em cada mensagem de chat
- usa [[Notification]] para entrega de alertas in-app
- respeita [[RN16 - Cliente so ve dados da propria Company]] e [[RN17 - Pentester so ve Projects atribuidos]]

## Links relacionados
[[ChatMessage]]
[[Notification]]
[[Back-end Express]]
[[Middlewares e Ownership]]
[[Chat e Comentarios]]
[[Notificacoes]]
[[Mobile Expo]]
[[MOC - Arquitetura]]
