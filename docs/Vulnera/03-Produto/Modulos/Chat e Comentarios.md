---
type: funcionalidade
tags: [feature, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> O chat em tempo real saiu do escopo. **Comentários em finding permanecem no escopo** via `VulnerabilityComment` — ver [[Findings]].
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Chat e Comentarios

## Objetivo
Permitir comunicação estruturada entre equipe técnica e cliente, tanto em contexto de finding (assíncrono) quanto em contexto de projeto (tempo real).

## Usuários envolvidos
- **Admin, Pentester, Cliente (OWNER e MEMBER)**: todos podem comentar e chatear

## Duas formas de comunicação

### Comentários em finding (assíncrono)
- thread de comentários por `Vulnerability` (entidade `VulnerabilityComment`)
- persistidos no banco — sem WebSocket
- notificação por e-mail quando novo comentário é adicionado
- histórico completo e rastreável por finding

### Chat do projeto (tempo real)
- chat por `Project` (entidade `ChatMessage`)
- comunicação via **Socket.IO** (WebSocket)
- mensagens persistidas no banco (não voláteis)
- todos os participantes do projeto (Admin, Pentesters, Clientes da empresa) entram na sala `project:{id}`
- notificação in-app e push mobile quando nova mensagem chega

## Capacidades
- envio e recebimento de mensagens em tempo real
- visualização do histórico de mensagens ao entrar na sala
- indicador de quem escreveu e quando
- notificação para usuários fora da sala

## Dependências técnicas
- `POST /vulnerabilities/:id/comments` + `GET` (comentários REST)
- Socket.IO Gateway no Express para chat
- `project:{id}` como room identifier
- persistência de ChatMessage via Prisma

## Relacionado
[[VulnerabilityComment]]
[[ChatMessage]]
[[WebSocket e Tempo Real]]
[[Notificacoes]]
[[RN24 - Push mobile filtravel por categoria]]