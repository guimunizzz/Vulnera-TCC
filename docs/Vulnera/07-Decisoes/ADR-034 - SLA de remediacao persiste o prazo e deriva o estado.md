---
type: decisao
tags: [decision, sla, remediation, query, performance]
status: vigente
codigo: ADR-034
data: 2026-09-16
---

# ADR-034 - SLA de remediação persiste o prazo e deriva o estado

## Contexto

O CP-2 da iniciativa **Exposure & Remediation Management** introduziu prazo de
remediação por severidade (`SlaPolicy`) e a pergunta operacional que justifica a
feature: *"o que está estourado?"*.

Existem duas formas de representar isso:

1. **Persistir o ESTADO** (`ON_TRACK`, `DUE_SOON`, `BREACHED`) numa coluna.
2. **Persistir o PRAZO** (`slaDueAt`) e derivar o estado comparando com `agora`.

A primeira é tentadora porque deixa o filtro trivial (`WHERE slaState =
'BREACHED'`). E está errada: o estado muda sozinho com a passagem do tempo, sem
ninguém escrever no banco. Um finding vira `BREACHED` à meia-noite de um sábado.
Persistir o estado obrigaria a um job periódico varrendo a tabela — e, entre
duas execuções, a tela mostraria `ON_TRACK` num finding já estourado.

Havia ainda uma restrição concreta: a busca de findings tem **dois construtores
de filtro gêmeos** (`where()` para o Prisma e `condicoesSql()` para o SQL cru da
ordenação por severidade). Qualquer regra de SLA precisa ser expressável nos
dois, com resultado idêntico.

## Decisão

**Persistir o prazo; derivar o estado. Sempre.**

Colunas gravadas em `Vulnerability`:

| Coluna         | Significado                                                 |
|----------------|-------------------------------------------------------------|
| `slaStartedAt` | início do ciclo — igual a `createdAt` na criação             |
| `slaDueAt`     | o prazo                                                      |
| `slaDueSoonAt` | o instante em que o finding passa a ser "vencendo"           |
| `slaPausedMs`  | tempo acumulado de pausa (aceite de risco vigente, CP-4)     |
| `slaPolicyId`  | qual política gerou este ciclo                               |

O estado é função pura de `(slaDueAt, slaDueSoonAt, status, agora)` e vive em
`app/api/src/utils/sla.util.ts`.

**`slaDueSoonAt` é persistido, e não calculado na consulta.** É a decisão menos
óbvia deste ADR. "Vencendo" são os últimos 20% do ciclo, ou seja
`dueAt - 0.2 × (dueAt - startedAt)`. Essa expressão **não é escrevível no
`where()` do Prisma**, que não compara colunas entre si nem faz aritmética de
datas. Persistindo a data, os dois construtores gêmeos passam a expressar
DUE_SOON da mesma forma trivial: *uma coluna contra `agora`*. Sem isso, o filtro
teria de existir só no caminho SQL — e os gêmeos divergiriam, que é exatamente
a falha que o canário `VULN-LIST-07b` existe para impedir.

**Um único `agora` por busca.** O service fixa o instante e passa aos dois
construtores (`FiltroBusca.slaNow`). Se cada um chamasse `new Date()`, um
finding que vence entre as duas consultas apareceria na página e não na
contagem.

## Justificativa

1. **O estado derivado nunca fica velho.** Não existe janela entre "venceu" e
   "o job percebeu".
2. **Nenhum job periódico.** A stack não tem fila nem agendador (ADR-030), e
   esta feature não é motivo para introduzir um.
3. **Auditoria honesta.** O que muda por decisão humana (a política, a pausa) é
   gravado; o que muda pelo relógio não gera evento nenhum — porque não houve
   ação.
4. **Os gêmeos continuam gêmeos.** Todo filtro de SLA é "coluna vs. `agora`",
   escrevível em Prisma e em SQL com o mesmo significado.

## Consequências

- **Trocar a política NÃO recalcula prazos.** Quem já tem prazo mantém o prazo;
  a política nova vale para os próximos findings. Reaplicar é ação separada,
  explícita, de ADMIN, e gera `SLA_RECALCULATED` na auditoria. É o que impede
  "consertar" um estouro afrouxando a regra.
- **Severidade `NONE` não tem SLA.** `slaDueAt` fica nulo e o estado é `NO_SLA`
  — que é diferente de "no prazo".
- **O vocabulário da BUSCA não é o vocabulário da TELA.** A busca oferece
  `RESOLVED`, que junta "resolvido no prazo" e "resolvido com atraso"; a tela
  mostra os dois separados. `SLA_FILTER_VALUES` é a lista da busca, validada no
  controller.
- **A pausa por aceite de risco (CP-4) desloca `slaDueAt` e `slaDueSoonAt`
  juntos** e soma o intervalo em `slaPausedMs`. Deslocar só um deles faria o
  "vencendo" e o "vencido" andarem em ritmos diferentes.
- **Migration adiciona colunas nullable** e um backfill (`npm run sla:backfill`)
  preenche o histórico. Finding antigo sem política aplicável fica sem SLA, que
  é honesto: não havia prazo quando ele foi criado.

## Alternativas descartadas

**Coluna de estado com job de atualização.** Descartada: exige agendador,
introduz janela de inconsistência e grava no banco um dado que é função do
relógio.

**Calcular tudo na consulta, sem persistir nada.** Descartada: sem
`slaStartedAt` e `slaPolicyId` gravados, o prazo de um finding mudaria
retroativamente ao trocar a política — e o histórico deixaria de ser auditável.

**Calcular `DUE_SOON` por expressão na query.** Descartada: não é expressável no
`where()` do Prisma, e implementá-la só no SQL cru quebraria a equivalência dos
dois construtores.

## Relacionado
[[ADR-033 - Transicoes de retorno na maquina de Vulnerability]]
[[ADR-035 - Vulnera Risk Score aditivo e auditavel]]
[[Vulnerability]]
