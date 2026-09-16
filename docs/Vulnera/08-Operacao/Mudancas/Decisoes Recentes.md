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

## 2026-09-16 — Exposure & Remediation Management: CP-1 a CP-7 implementados

**Contexto**: o produto registrava vulnerabilidades muito bem e não dizia nada
sobre o que acontece **depois** do achado — prazo, prioridade, quem corrige,
como corrigir, e o que fazer com o que não será corrigido.

**O que foi decidido** (cada uma com ADR próprio, 034 a 039):

- **SLA persiste o PRAZO e deriva o ESTADO.** Sem coluna de estado e sem job:
  o estado muda com o relógio, e um job deixaria janelas em que a tela mente.
- **VRS é ADITIVO**, não multiplicativo — muda em relação ao relatório de
  mapeamento. Motivo: explicabilidade parcela a parcela.
- **Aceite de risco é entidade, não status.** O finding continua aberto;
  segregação de função sem exceção; expiração preguiçosa e atômica.
- **Catálogo OWASP entra por CLI, com snapshot versionado.** Sem endpoint de
  sync: indisponibilidade do GitHub não pode virar indisponibilidade do produto.
  E a demo precisa funcionar sem Internet.
- **CSP real**, aplicada no `vite preview` (o que o Docker serve e o ZAP
  escaneia), com `script-src` sem `'unsafe-inline'`.
- **Busca salva guarda a pergunta, nunca a resposta.**
- **O quadro de remediação não tem arrastar-e-soltar** — mover é menu, operável
  por teclado.

**Consequência**: sete entregas, quatro entidades novas
([[SlaPolicy]], [[RiskAcceptance]], [[RemediationPlaybook]], [[SavedQuery]]) e
um bug de busca corrigido no caminho (filtros compostos se apagavam no `where()`
do Prisma). **CP-8 (Exposure Graph) não foi implementado** — era condicional.

**Nota relacionada**: [[ADR-034 - SLA de remediacao persiste o prazo e deriva o estado]]

---

## 2026-09-09 — DAST: triagem, promoção para Vulnerability e comparação entre scans

**Contexto**: o módulo DAST terminava num beco — o scan rodava, mostrava dezenas de alertas e a única saída era um PDF. Além disso, o watchdog limitava *quantos* scans rodam, mas nada limitava *quanto cada um consome* (medido: ~960% de 1200% de CPU e RAM sem teto).

**O que foi decidido**:
- triagem por finding dentro do silo (`NEW`/`CONFIRMED`/`FALSE_POSITIVE`/`ACCEPTED_RISK`), salvando no clique;
- promoção do achado para [[Vulnerability]] com proveniência (`sourceType`/`sourceDastFindingId`), **CVSS sugerido pelo backend e revisado pelo humano** — nunca derivado sozinho do `riskcode`;
- comparação entre duas execuções do mesmo alvo por `fingerprint` (resolvidos / novos / continuam abertos);
- limites de RAM e CPU por container, com `-Xmx` derivado do teto.

**Alternativa descartada**: importar findings automaticamente com CVSS estimado — um score inventado convincente é pior que score nenhum, e contaminaria a confiança do produto no `cvssScore` ([[RN10 - Severidade via CVSS com override justificado]]).

**Consequência**: o ciclo scan → triagem → promoção → remediação → novo scan → prova da correção fecha, e o produto continua **sem nenhuma `Vulnerability` com CVSS estimado**.

**Nota relacionada**: [[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]] · [[Fluxo - Scan DAST]]

---

## 2026-09-09 — ZAP em modo daemon por scan e DooD na stack Docker

**Contexto**: dentro do `docker compose`, **todo** scan caía silenciosamente no gerador simulado, e nada na interface indicava isso.

**O que foi decidido**: rodar o ZAP em modo daemon (um container por scan, ainda isolado), conduzido pela API HTTP dele; montar o socket do Docker do host na API (DooD); criar watchdog com fila FIFO e teto de 2 scans simultâneos; persistir `progress`/`phase`/`simulated`/`warningMessage`.

**Alternativa descartada**: manter o `zap-full-scan.py` — é caixa preta sem progresso, e qualquer barra construída sobre ele seria estimativa de tempo fingindo ser medição.

**Consequência**: scan real na stack, progresso medido de verdade, e resultado simulado passa a ser declarado na tela.

**Nota relacionada**: [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]

---

## 2026-09-05 — Módulo DAST: ZAP via Docker spawn, em silo, sem fila

**Contexto**: dar ao pentester varredura dinâmica automatizada dentro do produto, sem comprometer o núcleo já validado de findings.

**O que foi decidido**: um container efêmero do ZAP por scan via `execFile` (nunca shell), com bloqueio de SSRF; findings do ZAP num **silo** sem FK para o núcleo multi-tenant; execução assíncrona fire-and-forget, sem Redis/BullMQ.

**Alternativa descartada**: importar direto para `Vulnerability` (o ZAP não fornece vetor CVSS) e adotar fila externa (peso desproporcional para o TCC).

**Consequência**: módulo isolado, testável sem Docker (`DAST_FORCE_SIMULATE`), com o risco do socket Docker assumido e documentado. O silo foi parcialmente revisto em 2026-09-09 pela promoção com revisão humana.

**Nota relacionada**: [[ADR-028 - Execucao do ZAP via Docker spawn]] · [[ADR-029 - DAST como silo]] · [[ADR-030 - Execucao assincrona sem fila]] · [[DAST]]

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

> [!warning] Este sumário parou nas 7 primeiras ADRs
> Existem **31 ADRs** em `07-Decisoes/` (2026-09-10), numeradas até a 032 — a 016 não existe. A tabela abaixo é registro de abril/2026 e não foi mantida; a lista completa e atualizada está na pasta e em `docs/DECISIONS.md` do repositório. As ADRs do módulo DAST são a 028, 029, 030, 031 e 032.

Sumário das 7 primeiras decisões arquiteturais documentadas:

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
