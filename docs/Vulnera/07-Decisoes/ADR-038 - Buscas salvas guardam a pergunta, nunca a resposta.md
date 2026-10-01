---
type: decisao
tags: [decision, saved-query, watchlist, tenancy, query]
status: vigente
codigo: ADR-038
data: 2026-09-16
---

# ADR-038 - Buscas salvas guardam a pergunta, nunca a resposta

## Contexto

O CP-6 acrescentou buscas salvas e watchlists sobre a listagem de findings, que
já tem um vocabulário rico de filtros (severidade, status, OWASP, SLA, aceite,
VRS, responsável, texto, datas, ordenação).

A pergunta de projeto era o que exatamente se persiste — e a resposta óbvia
("guarda o resultado para abrir rápido") é a errada.

## Decisão

**Persiste-se a QUERY CANÔNICA da API. Nunca o conjunto de resultados.**

```
SavedQuery.queryString = "severity=CRITICAL&status=OPEN&assignedTo=none"
```

Abrir um atalho é **navegar** para `/findings?<queryString>`; a listagem busca
de novo, com o escopo de quem abriu.

**Escopos:** `PRIVATE` (só o dono) e `COMPANY` (todo o time).
**PENTESTER só cria busca privada** — ele atravessa empresas (é membro de
projetos, não de uma companhia), então "compartilhar com a empresa" não teria
destinatário definido; e publicar para o cliente o vocabulário interno de quem
testa é outra coisa que ninguém pediu.

**A string é CANONIZADA na escrita** (`saved-query.util.ts`): só parâmetros
conhecidos entram, valores são validados contra o mesmo vocabulário da listagem,
campos e valores são reordenados, e `page`/`pageSize` são removidos.

## Justificativa

1. **Um snapshot envelhece com cara de atual.** A watchlist "críticas
   estouradas" precisa refletir HOJE; um retrato mostraria ontem, e ninguém
   perceberia a diferença olhando a tela.
2. **É o problema de tenancy mais sutil da feature.** Um snapshot gravado por
   quem via um finding continuaria exibindo esse finding para quem perdeu o
   acesso. Guardando a pergunta, quem recorta é sempre a listagem — e a mesma
   watchlist devolve conjuntos diferentes para pessoas com acessos diferentes,
   que é o comportamento correto (provado por `SQ-09`).
3. **Canonizar resolve três problemas de uma vez:** lixo não vira contrato
   persistido; `status=OPEN&severity=HIGH` e `severity=HIGH&status=OPEN` deixam
   de ser dois atalhos diferentes; e um filtro inválido é recusado na hora de
   salvar, não meses depois ao clicar.
4. **A busca salva não é um passe de acesso.** Ela pode conter
   `companyId=<outra empresa>` — e executá-la não entrega nada, porque perguntar
   não dá acesso (provado por `SQ-10`).

## Consequências

- **Descarte é RELATADO, não silencioso.** Ao salvar, os parâmetros removidos
  voltam na resposta (`descartados`) e a tela avisa. Descobrir depois, ao clicar
  no atalho e ver resultados demais, seria tarde.
- **Um filtro inválido não derruba a busca inteira.** Um projeto apagado sai; o
  resto do atalho continua valendo.
- **Existe teto**: 50 buscas por pessoa e 8 fixadas na barra lateral. Uma barra
  lateral infinita deixa de ser atalho.
- **Nome é único por dono** (`@@unique([ownerId, name])`), e a mesma pergunta
  salva duas vezes é recusada — comparação pela forma canônica, não pelo nome.
- **⚠️ Acoplamento assumido com `vulnerability.controller.ts`.** O vocabulário
  de filtros está duplicado (as constantes de status e de aceite são locais
  daquele controller e não exportadas). A duplicação é presa pelo teste
  **`SQ-U-08`**, que lê o controller e falha se ele ganhar um parâmetro que este
  utilitário não conhece. O canário já cobrou a dívida uma vez: `assignedTo`
  (CP-7) foi acrescentado à listagem e o teste falhou na mesma hora.
- **404, não 403,** ao pedir busca alheia: um 403 confirmaria que o id existe.

## Alternativas descartadas

**Guardar o resultado (lista de ids).** Descartada — ver justificativa 1 e 2.

**Guardar a query como veio.** Descartada — ver justificativa 3.

**Deixar o PENTESTER compartilhar com a empresa do projeto.** Descartada: expõe
ao cliente o vocabulário de trabalho de quem testa, e "qual empresa?" não tem
resposta única para alguém que é membro de projetos de várias.

## Relacionado
[[ADR-037 - Catalogo OWASP importado por CLI com snapshot offline]]
[[ADR-039 - Quadro de remediacao por menu, sem arrastar]]
