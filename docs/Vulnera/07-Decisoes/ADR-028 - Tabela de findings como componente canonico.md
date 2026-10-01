---
type: decisao
tags: [decision, frontend, findings, componentes, api]
status: vigente
codigo: ADR-028
data: 2026-09-14
---

# ADR-028 - Tabela de findings como componente canônico

## Contexto

Até a Fase 9, listar findings era feito de **duas maneiras diferentes**, e nenhuma
delas sabia da outra:

1. **Aba Findings do `project-detail-page.tsx`** — chamava
   `GET /vulnerabilities?projectId=X`, recebia o array inteiro do projeto e
   filtrava, ordenava e paginava **em memória**, com três `<select>` nativos e
   uma `<table>` escrita à mão que não usava o design system da Fase 6.5.
2. **Os três dashboards** — chamavam o mesmo endpoint sem `projectId`, baixavam
   tudo que o ator podia ver e resumiam com `list.filter(...).length`.

O custo dessa divergência era concreto, não teórico:

- **Comportamentos diferentes para a mesma coisa.** A aba paginava de 10 em 10
  sobre um array já inteiro na memória; o dashboard não paginava. Nenhuma das
  duas tinha busca textual, contagem por opção ou URL compartilhável.
- **Correção em dobro.** Qualquer ajuste de coluna, rótulo, estado vazio ou
  acessibilidade precisava ser lembrado nos dois lugares — e a migração de
  design system da Fase 6.5 (`KAN-661`) já tinha deixado a aba do projeto para
  trás, com `<table>` crua enquanto o resto do app usava `Table`.
- **Escala.** Baixar todos os findings para contar cinco números no navegador
  funciona com os 11 registros do seed e não funciona com dez mil.

Além disso, o finding `BACKEND-002` da auditoria consolidada registrava a raiz
do problema no servidor: *"controller aceita apenas `projectId`; queries não têm
severity/status/OWASP/skip/take"*. Sem filtro no backend, filtrar no cliente era
a única saída possível — e é por isso que as duas implementações nasceram.

## Decisão

**Uma implementação só: `app/web/src/components/findings/findings-table.tsx`,
configurada por contexto.**

O componente recebe o que muda entre os usos, e nada mais:

```tsx
<FindingsTable
  lockedFilters={{ projectId }}                          // filtro do contexto
  hiddenFields={["projeto", "empresa", "aplicacao"]}      // some da barra
  hiddenColumns={["project", "company", "application"]}   // some da tabela
  syncToUrl={false}                                       // URL só na página global
  onSelect={(id) => navigate(`/findings/${id}`)}
/>
```

- **Filtro travado é contexto, não preferência.** `lockedFilters` entra por
  último na montagem da query e **sobrescreve** o que a pessoa digitou: numa aba
  de projeto, o `projectId` não é negociável. Sem isso, um filtro digitado
  poderia fazer a aba do projeto A mostrar findings do projeto B.
- **A busca de dados também é única** (`hooks/use-findings.ts`), e o estado de
  filtro vive separado dela (`hooks/use-findings-filters.ts`). Essa separação é
  o que permite a MESMA tabela usar a URL como fonte da verdade na página global
  e um espelho local na aba do projeto, sem virar dois componentes.

Para isso ser possível, `GET /api/vulnerabilities` ganhou filtros, ordenação,
paginação e facetas contadas no banco — fechando `BACKEND-002`.

## Consequências

- **Toda tela nova que liste findings consome este componente.** Uma listagem
  própria é considerada regressão em revisão de código.
- A aba do ProjectDetail e os três dashboards foram migrados; o app mobile leu
  o envelope novo. Nenhuma listagem paralela sobrou (`grep` no CP7).
- Os dashboards deixaram de baixar findings para contar: leem `pagination.total`
  e as facetas. Isso exigiu duas adições ao endpoint — a faceta `company` (para
  o "top empresas" do ADMIN) e o filtro `createdBy` (para o "registrados por
  mim" do PENTESTER) — ambas preservando comportamento existente em vez de
  mudar o significado dos indicadores.
- A `Table` do design system ganhou, de forma **aditiva**, ordenação controlada
  (`ordem` + `aoOrdenar`) e linha operável por teclado. Ordenação controlada era
  obrigatória: com paginação no servidor, ordenar no cliente reordenaria apenas
  as 25 linhas da página — parece que funcionou e está errado.
- **O que o componente ganha, toda tela ganha.** A caixa de sugestões da barra e
  a exportação CSV foram escritas uma vez e já valem em qualquer contexto — a
  exportação atrás de `exportavel` (ligada na página global), as sugestões
  sempre, respeitando `hiddenFields`. Com duas implementações, cada uma delas
  seria escrita duas vezes ou existiria só numa tela.
- O envelope da resposta mudou de `Vulnerability[]` para
  `{ data, pagination, facets }`. Seis asserções de teste e quatro consumidores
  foram migrados junto. É a única quebra de contrato desta entrega, e foi feita
  de uma vez em vez de conviver com duas formas.

## Alternativa descartada

**Manter listagens separadas por contexto**, cada tela com a sua, e só adicionar
filtros ao backend.

Descartada porque não resolve o problema que motivou a entrega: o backend
ganharia filtros e as duas telas continuariam implementando busca, ordenação,
paginação, estados vazio/erro e acessibilidade por conta própria — agora com
mais superfície para divergir, não menos. A Fase 6.5 já tinha demonstrado o
custo disso ao deixar a aba do projeto fora da migração de design system.

## Relacionado

- [[ADR-021 - Maquina de Vulnerability com 4 estados]] — os status que o filtro oferece
- [[ADR-023 - Biblioteca de componentes propria em vez de Radix]] — de onde vêm `Table`, `Popover`, `EmptyState`
- [[ADR-025 - Metricas analiticas derivadas do AuditLog]] — a regra de agregar no banco, que esta entrega estendeu à listagem
- `docs/FINDINGS_QUERY.md` — a sintaxe do query wizard, para o usuário final
