---
type: enum
tags: [data, domain, source-of-truth, dast]
status: ativo
---

> [!info] Nota criada em 2026-09-10
> Cobre os três enums do módulo [[DAST]] (`DastScanStatus`, `DastRisk`, `DastTriageStatus`) e o campo de proveniência `Vulnerability.sourceType`.

# Enum - DAST

## Exceção consciente à filosofia "sem enums nativos"

A filosofia #3 do cabeçalho do `schema.prisma` é `String` + validação em TypeScript — por portabilidade MySQL/PostgreSQL e para não exigir migration a cada valor novo. É o que fazem `ProjectStatus`, `VulnerabilityStatus` e companhia ([[Enum - ProjectStatus]], [[Enum - VulnerabilityStatus]]).

Os enums do DAST são **enums nativos do Prisma**, exceção sinalizada ao Rafael antes da migration. Razão registrada no próprio schema: os dois conjuntos são **fechados por contrato externo** (`DastRisk` é a taxonomia fixa do ZAP; `DastScanStatus` é um ciclo de vida interno de 5 valores) e não se espera adicionar valor sem tocar código de qualquer forma.

> [!warning] Onde a exceção está registrada de fato
> O comentário do `schema.prisma` remete ao ADR "DAST como silo", mas nem o [[ADR-029 - DAST como silo]] nem o [[ADR-028 - Execucao do ZAP via Docker spawn]] mencionam enums. O registro efetivo é o comentário do schema (linhas 509-515) — esta nota e ele são a documentação da decisão.

---

## `DastScanStatus`

Ciclo de vida de uma execução ([[DastScan]]).

| Valor | Descrição |
|---|---|
| `QUEUED` | Criado e **na fila FIFO** do watchdog. Ainda não há container. É o estado inicial de todo scan |
| `RUNNING` | Container de pé; o runner conduz spider → passivo → ativo pela API HTTP do ZAP e escreve `progress`/`phase` |
| `COMPLETED` | Relatório JSON obtido e parseado. Pode ter `warningMessage` (tipicamente `simulated: true`) |
| `FAILED` | Erro, timeout, abort do watchdog por falta de pulso, ou órfão de restart detectado no boot da API |
| `CANCELLED` | Interrompido pelo usuário (`POST /:id/cancel`) — o container é destruído com `docker rm -f <containerName>` |

```prisma
enum DastScanStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Não é máquina de estados de domínio.** Diferente de [[Maquina - Vulnerability]], quem escreve aqui é o runner e o watchdog, não um pedido de usuário — a única transição pedida por gente é o cancelamento. Por isso `phase` (`SPIDER`, `PASSIVE`, `ACTIVE`, `REPORT`…) é `String` e não enum: é rótulo de UI, e a máquina já é o `status`.

---

## `DastRisk`

Severidade do alerta como o ZAP a declara ([[DastFinding]]).

| Valor | `riskcode` do ZAP | Vetor CVSS **sugerido** na promoção |
|---|---|---|
| `HIGH` | `3` | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` |
| `MEDIUM` | `2` | `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N` |
| `LOW` | `1` | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| `INFO` | `0` e qualquer valor não documentado | `CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N` |

⚠️ **A coluna da direita é sugestão, não cálculo.** O ZAP não fornece vetor CVSS — só o `riskcode`. O vetor sugerido aparece pré-preenchido no diálogo de promoção **com aviso visível**, e só vira `cvssScore` depois que o pentester revisa e confirma; `calculateCvss` roda sobre o vetor revisado. É isso que mantém a [[RN10 - Severidade via CVSS com override justificado]] intacta e o produto **sem uma única `Vulnerability` com CVSS estimado**.

Valor fora de 0-3 cai em `INFO` de propósito: um alerta desconhecido nunca deve inflar severidade sozinho.

---

## `DastTriageStatus`

O que o humano já concluiu sobre um [[DastFinding]], **dentro do silo**.

| Valor | Descrição |
|---|---|
| `NEW` | Ainda não olhado. Padrão de todo finding recém-importado — e de todo finding histórico, pela migration aditiva de 2026-09-09 |
| `CONFIRMED` | O pentester validou: é real. Candidato natural à promoção |
| `FALSE_POSITIVE` | O ZAP errou |
| `ACCEPTED_RISK` | É real, mas o risco foi aceito conscientemente |

```prisma
enum DastTriageStatus {
  NEW
  CONFIRMED
  FALSE_POSITIVE
  ACCEPTED_RISK
}
```

Sem transição proibida: é anotação de análise, não estado de negócio — corrigir uma classificação errada tem de ser trivial. Acompanham o status: `triageNote` (texto livre), `triagedById` e `triagedAt`.

---

## `Vulnerability.sourceType` — proveniência

**Não é enum nativo** (é `String` com `@default("MANUAL")`), justamente porque aqui vale a filosofia padrão do projeto: é vocabulário do produto, não de ferramenta externa.

| Valor | Significado |
|---|---|
| `MANUAL` | O pentester digitou depois de análise humana. Todo o histórico até 2026-09-09 — que é exatamente o que ele é |
| `DAST_IMPORT` | Nasceu da promoção de um [[DastFinding]]. O ponteiro para a origem fica em `sourceDastFindingId` (`@unique`, `onDelete: SetNull`) |

Sem esse campo, misturar as duas origens na mesma tabela degradaria a confiança em `Vulnerability` como "achado triado por humano" — a objeção nº 3 do [[ADR-029 - DAST como silo]], respondida em vez de evitada pelo [[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]].

---

## Links relacionados

[[DastScan]]
[[DastFinding]]
[[Vulnerability]]
[[DAST]]
[[Entidades e Relacionamentos]]
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]]
[[MOC - Dominio]]
