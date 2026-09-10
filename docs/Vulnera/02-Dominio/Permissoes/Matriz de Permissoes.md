---
type: permissao
tags: [domain, source-of-truth]
status: ativo
---

# Matriz de Permissoes

> [!info] Atualizada em 2026-09-10 com o módulo [[DAST]]
> `PENTESTER` e `ADMIN` têm acesso total ao módulo; `CLIENT` (Owner ou Member) **não tem acesso nenhum** — sem item de menu e com 403 em qualquer rota `/dast/*` ou `/api/dast/*`. Não existe meio-termo de visibilidade, diferente de [[Vulnerability]], que o cliente lê.
> Dentro do módulo, cada `PENTESTER` só enxerga **os próprios scans** (ownership fina no service, não no middleware); `ADMIN` vê todos. Promover um achado exige ser [[ProjectMember]] do projeto de destino.

## Admin
Pode:
- gerenciar plataforma
- disparar e ver **qualquer** scan DAST, triar e promover achados
- ativar assinatura
- atribuir pentester
- registrar finding
- avaliar maturidade
- ver dashboard global

## Pentester
Pode:
- disparar scans DAST, ver **os próprios**, triar achados e promovê-los para projetos em que é membro
- atuar em projetos atribuídos
- registrar findings
- comentar
- gerar relatório

## Client Owner
Pode:
- criar empresa no onboarding
- editar empresa própria
- convidar usuários
- cadastrar aplicação
- abrir projeto
- comentar
- baixar relatório
- abrir ticket

## Client Member
Pode:
- consultar
- cadastrar aplicação
- abrir projeto
- comentar
- baixar relatório
- abrir ticket