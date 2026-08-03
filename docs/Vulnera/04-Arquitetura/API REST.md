---
type: documentacao-tecnica
tags: [architecture]
status: ativo
---

# API REST

## Papel
Interface principal entre clientes web/mobile e o back-end.

## Responsabilidades
- autenticação
- CRUDs
- consulta de dashboards
- chat e comentários
- IA assistida
- relatórios
- notificações

## Regras importantes
Toda rota deve respeitar:
- autenticação
- autorização
- ownership
- validação de entrada
- logs sem dados sensíveis

## Organização interna
A API é estruturada por módulos de negócio, e cada módulo tende a conter:
- controller
- service
- repository
- DTOs
- module