---
type: plataforma
tags: [feature]
status: ativo
---

# Mobile Cliente

## Usuários
- CLIENT

## Papel
Acompanhamento read-only de projetos e findings da própria empresa, com notificações push de novas vulnerabilidades críticas.

## Limites
- sem funções administrativas
- sem criação ou edição principal de projetos
- chat em tempo real não é foco inicial

## Decisão associada
[[ADR-004 - Mobile cliente e read-mostly]]

## Escopo vigente do MVP

Cinco telas: Login, Home/Projetos, ProjectDetail, FindingDetail e Configurações/Minha conta. O cadastro acontece no web. O cliente consulta projetos, vulnerabilidades, evidências e comentários; não cria/edita dados nem envia comentários no mobile. Relatórios/PDF, chat e preferências por categoria não integram a Fase 7. Em 2026-10-06, a área autenticada recebeu visual próprio com roxo/liquid glass e integração validada contra a API real, mantendo o login. Ver `docs/ROADMAP_PROMPTS.md` e [[ADR-045 - Consulta mobile paginada e isolamento de sessao]].
