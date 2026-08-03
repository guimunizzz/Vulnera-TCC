---
type: historico
tags: [operacao, decisao]
status: ativo
---

# Decisoes Recentes

Registro cronológico das decisões relevantes tomadas durante o projeto. Serve como ponto de entrada rápido para entender o que foi decidido recentemente e por quê, sem precisar varrer todos os ADRs.

> Para decisões estruturais formalizadas, ver `07-Decisoes/` com os ADRs completos.
> Para decisões de menor escopo, registrar aqui com justificativa sucinta.

---

## 2026-04-24 — Vault de documentação concluído

**Contexto**: após 9 sessões de trabalho, o vault do Vulnera está completamente documentado.

**O que foi decidido**:
- todas as 21 entidades de domínio documentadas
- todas as 24 regras de negócio documentadas
- todas as máquinas de estado documentadas
- toda a arquitetura técnica documentada
- todos os padrões de segurança documentados com implementação específica da stack
- todos os enums e modelo de dados documentados
- todos os 7 ADRs preenchidos
- operação documentada (esta sessão)

**Consequência**: o vault pode ser usado como fonte de verdade durante a implementação, para onboarding de membros e como material complementar da monografia.

---

## 2026-04-23 — Estrutura do vault criada

**Contexto**: primeira sessão de trabalho no vault.

**O que foi decidido**:
- estrutura de pastas consolidada (00-Hub, 01-Contexto, ..., 09-TCC)
- MOCs principais criados
- guia operacional do Claude definido
- notas canônicas iniciais criadas

---

## Decisões estruturais formalizadas (ADRs)

Sumário das 7 decisões arquiteturais documentadas:

| ADR | Decisão | Data |
|---|---|---|
| [[ADR-001 - Plataforma foca gestao e nao execucao real]] | Vulnera é gestão, não execução de ataques reais | 2026-04-23 |
| [[ADR-002 - Project 1 para 1 com Application]] | Um projeto vinculado a uma única aplicação | 2026-04-24 |
| [[ADR-003 - PDF gerado no cliente]] | Relatório PDF gerado no browser, não no servidor | 2026-04-23 |
| [[ADR-004 - Mobile cliente e read-mostly]] | App mobile focado em leitura e notificações | 2026-04-23 |
| [[ADR-005 - Desenvolvimento local com Docker minimo]] | Código local, apenas infra auxiliar no Docker | 2026-04-24 |
| [[ADR-006 - Gemini com rate limit agressivo]] | IA assistiva com rate limit de 10 chamadas/hora | 2026-04-23 |
| [[ADR-007 - Sonar informativo e ZAP manual]] | SonarQube não bloqueia; ZAP manual por marcos | 2026-04-24 |

---

## Template para novas decisões

Ao registrar uma nova decisão aqui:

```
## YYYY-MM-DD — [título curto]

**Contexto**: [o que levou à decisão]

**O que foi decidido**: [a decisão em si]

**Alternativa descartada**: [o que foi considerado e por quê não]

**Consequência**: [impacto esperado]

**Nota relacionada**: [[nome da nota]]
```

---

## Links relacionados
[[Changelog do Projeto]]
[[Historico de Ideias]]
[[Hipoteses em Validacao]]
[[MOC - Operacao]]
