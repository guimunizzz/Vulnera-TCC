---
type: entidade
tags: [domain, source-of-truth, dast]
status: ativo
---

> [!info] Nota criada em 2026-09-10
> Entidade introduzida pelo módulo [[DAST]] (Fase 9, 2026-09-05); triagem e promoção adicionadas na Fase 9.2 (2026-09-09). Nomes de campo reais do `schema.prisma` (camelCase).

# DastFinding

## Definição

Um alerta do OWASP ZAP **já normalizado**: uma *instance* do JSON do ZAP vira um registro. Não é uma [[Vulnerability]] — é matéria-prima de máquina, ainda sem análise humana.

## Papel no sistema

É o que o pentester lê, filtra e **tria** dentro do silo do módulo [[DAST]]. Quando um achado se confirma relevante, ele é **promovido** para uma [[Vulnerability]] em um [[Project]] real e passa a seguir o fluxo normal do produto (evidências, comentários, relatório, dashboards).

## Campos críticos

| Campo | Papel |
|---|---|
| `fingerprint` | `sha256(pluginId \| normalizedUrl \| param)` — hex de 64 chars, seguro para índice único. **Nunca inclui a `evidence`**, porque ela muda entre execuções da mesma vulnerabilidade |
| `pluginId`, `title`, `cweId`, `wascId` | Identificação do alerta na taxonomia do ZAP/MITRE |
| `risk` | [[Enum - DAST]] `DastRisk` — `HIGH`/`MEDIUM`/`LOW`/`INFO`, mapeado do `riskcode` 0-3 do ZAP |
| `confidence` | Confiança declarada pelo ZAP. Passou da tabela para o detalhe expandido quando a coluna "Triagem" entrou (9.2) |
| `url` / `normalizedUrl` | URL bruta e a versão normalizada que entra no fingerprint (`/users/123` e `/users/999` colapsam) |
| `param`, `evidence` | Parâmetro afetado e o trecho que o ZAP considerou prova |
| `description`, `solution`, `reference` | Texto do ZAP, passado por `stripHtml()` antes de persistir |
| `triageStatus` | [[Enum - DAST]] `DastTriageStatus` — `NEW` (padrão) / `CONFIRMED` / `FALSE_POSITIVE` / `ACCEPTED_RISK` |
| `triageNote`, `triagedById`, `triagedAt` | Nota livre, autor e data da triagem |

## Relacionamentos

- pertence a um [[DastScan]] (`onDelete: Cascade`)
- triado por um [[User]] (`triagedById`, opcional)
- pode ter sido promovido para **no máximo uma** [[Vulnerability]] — a FK real mora em `Vulnerability.sourceDastFindingId`, que é `@unique`; deste lado a relação é 0..1

## Triagem

Estado do que o humano já analisou dentro do silo. Um scan devolve dezenas de alertas e o ZAP não sabe quais importam: sem triagem, quem revisa 40 achados não tem onde registrar o que já olhou e recomeça do zero na sessão seguinte.

```
NEW ──▶ CONFIRMED        (é real — candidato natural à promoção)
    ├─▶ FALSE_POSITIVE   (o ZAP errou)
    └─▶ ACCEPTED_RISK    (é real, mas o risco foi aceito)
```

Não há transição proibida: triagem é anotação de análise, não máquina de estados de negócio — corrigir uma classificação errada precisa ser trivial. O status salva **no clique**; a nota, por ser texto livre, exige commit explícito.

## Promoção para Vulnerability

Ver [[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]] e [[Fluxo - Scan DAST]]. Em resumo:

- o backend **sugere** um rascunho (título, descrição com a proveniência, categoria OWASP deduzida do CWE, vetor CVSS sugerido pela faixa de risco) e o pentester **revisa** antes de salvar — o vetor CVSS nunca é inventado a partir do `riskcode`, o que mantém a [[RN10 - Severidade via CVSS com override justificado]] intacta;
- CWE → categoria OWASP é **fato publicado** e entra direto; risco → vetor CVSS é **suposição** e vem com aviso visível na tela;
- um finding vira no máximo uma `Vulnerability` — garantia do `@unique` do banco, não de checagem de aplicação;
- pentester só promove para um `Project` em que seja **membro** (`ADMIN` não passa por essa checagem, igual ao `create` normal);
- apagar o scan de origem **não apaga** a vulnerability promovida (`onDelete: SetNull`): perde-se o ponteiro para a origem, nunca o achado.

## Comparação entre execuções

Dois scans do mesmo alvo são comparados por `fingerprint`, resultando em três grupos — **resolvidos**, **novos** e **continuam abertos**. É a evidência de que uma correção funcionou. Alvos diferentes devolvem `422 SCANS_TARGET_MISMATCH` em vez de um diff 100% "sumiu" + 100% "apareceu", correto e inútil.

## Links relacionados

[[DastScan]]
[[Vulnerability]]
[[DAST]]
[[Fluxo - Scan DAST]]
[[Enum - DAST]]
[[ADR-029 - DAST como silo]]
[[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]]
[[MOC - Dominio]]
