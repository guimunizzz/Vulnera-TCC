---
type: entidade
tags: [domain, source-of-truth, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> Chat em tempo real saiu do escopo do MVP. O model `ChatMessage` não existe no `schema.prisma` atual.
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# ChatMessage

## Definição
Representa uma mensagem enviada no chat em tempo real de um `Project`. Registra no banco cada mensagem trafegada via WebSocket entre clientes e pentesters durante o andamento do projeto.

## Papel no sistema
`ChatMessage` é o canal de comunicação geral do projeto. Diferente do `VulnerabilityComment` (ancorado a um finding específico), o chat é o espaço de comunicação livre entre as partes envolvidas no projeto. As mensagens são entregues em tempo real via Socket.IO e persistidas no MySQL.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `project_id` | uuid FK | Referência ao [[Project]] |
| `author_id` | uuid FK | Referência ao [[User]] que enviou |
| `content` | text | Conteúdo da mensagem |
| `sent_at` | datetime | Momento de envio/persistência |

## Relacionamentos
- pertence a um [[Project]]
- pertence a um [[User]] como autor
- um Project pode ter múltiplos ChatMessages

## Regras associadas
- [[RN16 - Cliente so ve dados da propria Company]] — cliente só acessa chat de projetos da sua Company
- [[RN17 - Pentester so ve Projects atribuidos]] — pentester só acessa chat de projetos atribuídos
- [[RN24 - Push mobile filtravel por categoria]] — nova mensagem pode disparar push mobile filtrável por categoria `CHAT_MESSAGE`

## Estados / enums
`ChatMessage` não possui estados. Mensagens são imutáveis após enviadas (sem edição/exclusão no MVP).

## Permissões / visibilidade
- criação (envio): ADMIN, PENTESTER atribuído, CLIENT da company do projeto
- leitura (histórico): mesmos que criação
- exclusão/edição: não prevista no MVP

## Considerações de segurança
- `content` é texto livre — deve ser sanitizado no front-end para prevenir XSS
- `author_id` deve ser sempre extraído do JWT, nunca do corpo da requisição
- o WebSocket deve validar autenticação e ownership do project no momento da conexão (join room), não apenas no envio

## Riscos de inconsistência
- mensagem persistida no banco sem entrega via WebSocket (falha de conexão): o histórico já estará correto; o cliente verá ao recarregar
- usuário removido do ProjectMember após mensagens enviadas: mensagens já persistidas ficam no histórico com `author_id` válido; não há problema
- sala WebSocket deve ter validação de pertencimento ao projeto para evitar que um usuário entre no room de um projeto não autorizado

## Links relacionados
[[Project]]
[[User]]
[[RN24 - Push mobile filtravel por categoria]]
[[WebSocket e Tempo Real]]
[[Chat e Comentarios]]
[[MOC - Dominio]]
