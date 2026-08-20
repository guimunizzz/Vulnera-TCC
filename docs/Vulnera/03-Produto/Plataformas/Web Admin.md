---
type: plataforma
tags: [feature]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Web Admin

## Usuários
- Admin
- Pentester

## Papel
Interface principal da equipe interna da consultoria. Cobre todas as operações de gestão, análise e entrega.

## Capacidades — Admin
- gestão de empresas-cliente (CRUD)
- aprovação e rejeição de assinaturas
- atribuição de Pentesters a projetos
- triagem e gestão do ciclo de vida dos projetos
- avaliação de maturidade por domínios e controles
- visualização e gestão de tickets de suporte
- dashboard global da operação
- encerramento de projetos

## Capacidades — Pentester
- visualização dos projetos atribuídos
- registro de findings com CVSS e OWASP
- upload de evidências
- comentários em findings
- chat em tempo real com o cliente
- uso da IA para assistência no registro
- geração de relatórios técnico e executivo

## Stack técnica
- React + Vite com App Router
- rotas protegidas em `app/(admin)/` e `app/(pentester)/`
- Tailwind CSS + shadcn/ui
- Recharts para gráficos e charts
- Socket.IO client para chat

## Relacionado
[[Front-end Web React]]
[[Jornada - Admin]]
[[Jornada - Pentester]]
[[Dashboard]]