---
type: decisao
tags: [decision, risk, scoring, cvss, priorizacao]
status: vigente
codigo: ADR-035
data: 2026-09-16
---

# ADR-035 - Vulnera Risk Score aditivo e auditável

## Contexto

O CVSS responde *"quão grave é esta falha, tecnicamente?"* e é deliberadamente
**independente de contexto** — a mesma injeção de SQL tem o mesmo vetor num
ambiente de desenvolvimento interno e no portal de pagamentos exposto à
internet. Essa é a virtude do CVSS, e é também o que o torna insuficiente para
responder à pergunta operacional: *"o que eu corrijo primeiro?"*.

O CP-1 passou a registrar o contexto de risco da aplicação (ambiente,
criticidade, exposição à internet, sensibilidade de dados). O CP-3 precisava
transformar CVSS + contexto num número de PRIORIZAÇÃO.

O relatório de mapeamento propunha uma fórmula **multiplicativa** (CVSS ×
fatores). Foi descartada antes da implementação.

## Decisão

**O Vulnera Risk Score (VRS) é ADITIVO, com teto em 100 e piso em 0.**

```
VRS = round(cvss × 6)            0–60   a gravidade técnica
    + criticidade                0/5/10/15
    + ambiente                   0/3/7
    + exposto à internet         0/8
    + sensibilidade de dados     0/3/7/10
```

Faixas: `MONITORAR` · `PLANEJADO` · `URGENTE` · `IMEDIATO`.

**O VRS NÃO substitui o CVSS.** As duas telas mostram os dois, lado a lado. O
CVSS continua sendo o dado comparável com o mundo; o VRS é a ordem de trabalho
desta empresa.

**O que fica DE FORA do VRS, de propósito:**

- **SLA.** Um finding não fica mais grave porque está atrasado. Misturar as
  duas coisas produziria um número que sobe sozinho com o relógio e que não se
  pode explicar a um cliente ("por que subiu?" — "porque demorou").
- **Proveniência (`sourceType`).** Um achado vindo do DAST não é mais nem menos
  arriscado que um achado manual. Pontuar a origem premiaria a ferramenta, não o
  risco.

## Justificativa

1. **Aditivo é explicável parcela a parcela.** A tela mostra "60 (CVSS 9.8) + 15
   (crítica) + 8 (exposta) = 83". Numa fórmula multiplicativa, a contribuição de
   cada fator depende de todos os outros, e a resposta a "por que 83?" vira
   "porque a conta deu isso".
2. **Multiplicativo explode e comprime nos lugares errados.** Um fator 1.5 sobre
   um CVSS 9.8 vale três vezes mais pontos que sobre um 3.3 — ou seja, o
   contexto quase não move findings de baixa gravidade, que é exatamente onde o
   contexto mais importa (um "médio" num portal de pagamentos exposto merece
   subir de fila).
3. **Teto conhecido.** Com soma e clamp, 100 significa algo estável. Com
   produto, o máximo depende de quantos fatores existem — e muda toda vez que
   um fator novo é acrescentado.
4. **Auditável.** `vrsFactors` guarda o detalhamento em JSON junto do score, e
   `vrsComputedAt` diz quando. Um número sem a explicação ao lado é um número
   que ninguém defende numa reunião.

## Consequências

- **O VRS é gravado**, não calculado na leitura: a busca ordena e filtra por ele
  no banco (`sortBy=vrsScore`, `vrsMin`/`vrsMax`), e recalcular por linha numa
  listagem de 100 findings seria inviável.
- **Mudar o contexto de risco da aplicação recalcula o VRS dos findings dela.**
  O gancho é injetado na factory (`setRiskContextChangedHook`) para que o
  `ApplicationService` continue sem conhecer `Vulnerability`.
- **Mudar o CVSS recalcula o VRS** no mesmo update.
- **Finding sem CVSS fica sem VRS** (`null`), e `null` nunca entra numa faixa de
  `vrsMin`/`vrsMax` — igual em Prisma e em SQL cru.
- **Backfill** via `npm run vrs:backfill` para o histórico.
- **A fórmula tem teste de unidade por parcela** (`vrs.util.test.ts`): cada
  contribuição é verificada isoladamente, e não só o total.

## Alternativas descartadas

**Fórmula multiplicativa (proposta no relatório de mapeamento).** Descartada
pelos motivos 1–3 acima, antes de qualquer linha de implementação.

**Substituir o CVSS pelo VRS nas telas.** Descartada: o CVSS é o vocabulário
comum com o resto da indústria e com a banca; esconder o vetor tornaria o
finding incomparável fora do Vulnera.

**Deixar os pesos configuráveis por empresa na v1.** Descartada por ora: pesos
por tenant tornam o número incomparável entre empresas e exigem versionar a
fórmula junto do score para o histórico continuar interpretável. Trabalho futuro.

## Relacionado
[[ADR-034 - SLA de remediacao persiste o prazo e deriva o estado]]
[[ADR-029 - DAST como silo]]
[[Vulnerability]]
