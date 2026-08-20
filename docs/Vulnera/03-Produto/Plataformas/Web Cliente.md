---
type: plataforma
tags: [feature]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Web Cliente

## Usuários
- Client Owner
- Client Member

## Papel
Portal self-service do cliente contratante. Interface para onboarding, acompanhamento de projetos, comunicação com a equipe técnica e recebimento de relatórios.

## Capacidades — OWNER
- onboarding: cadastro da empresa e seleção de plano
- edição de dados da empresa e convite de usuários (MEMBER)
- cadastro de Applications (dentro do limite do plano)
- abertura de Projects (solicitação de análise)

## Capacidades — OWNER e MEMBER
- dashboard da empresa (projetos, findings, maturidade, tendências)
- acompanhamento de projetos por status
- consulta de findings com filtros de severidade e status
- comentários em findings (thread assíncrona)
- chat em tempo real com o Pentester
- download de relatórios em PDF (executivo e técnico)
- solicitação de revalidação de findings corrigidos
- abertura e acompanhamento de tickets de suporte

## Restrições
- não vê dados de outras empresas ([[RN16 - Cliente so ve dados da propria Company]])
- não pode registrar findings nem atribuir Pentesters

## Stack técnica
- React + Vite com App Router
- rotas protegidas em `app/(client)/`
- pdf-lib para geração de relatórios client-side
- Socket.IO client para chat em tempo real

## Relacionado
[[Front-end Web React]]
[[Jornada - Cliente]]
[[Dashboard]]
[[ADR-003 - PDF gerado no cliente]]