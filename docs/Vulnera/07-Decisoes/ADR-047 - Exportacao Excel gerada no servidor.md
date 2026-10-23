---
type: decisao
tags: [decision, findings, exportacao, excel]
status: vigente
codigo: ADR-047
data: 2026-10-22
---

<!-- Registra por que o Excel de findings é gerado no servidor, com qual biblioteca e com quais garantias; consumido pelos mantenedores e pela banca. -->

# ADR-047 — Exportação Excel gerada no servidor

## Contexto

A página Findings só exportava CSV, montado no navegador (limite de 10.000 linhas). O cliente
pediu um relatório em Excel pronto para apresentação e para acompanhar a correção — com abas,
dashboard de gráficos nativos, controle de remediação e formatação como requisito contratual. O
[[ADR-003 - PDF gerado no cliente]] mantém PDF e CSV no navegador; um `.xlsx` com fórmulas, gráficos,
validação de dados, proteção e impressão não cabe nessa abordagem.

## Decisão

- **Geração no servidor**, em `GET /api/vulnerabilities/export.xlsx`, aberta a ADMIN, PENTESTER e
  CLIENT (a página `/findings` continua só ADMIN/PENTESTER; o CLIENT exporta pela aba Findings do
  projeto). O CSV permanece no navegador, onde estava.
- **Mesma fonte de filtro que a listagem.** O parse da query saiu do controller para um util
  compartilhado e o escopo de acesso para `VulnerabilityService.montarFiltro`. A exportação lê pelo
  `repository.buscar` em lotes: não há um segundo construtor de `where`.
- **ExcelJS em streaming + gráficos injetados.** O ExcelJS não cria gráficos. A alternativa XlsxWriter
  (Python) tinha gráficos nativos, mas acrescentaria uma segunda linguagem à API e ao CI; foi
  descartada por decisão do dono do produto. O pacote é reescrito em streaming (`yauzl` → `yazl`) para
  acrescentar o desenho e os gráficos, cujo XML é escrito em `graficos.ts`.
- **Arquivo temporário em disco** antes do primeiro byte ao cliente (o `yauzl` precisa de acesso
  aleatório). Falha na geração vira status HTTP, nunca download truncado.
- **Limite configurável** (`EXPORT_MAX_ROWS`, 50.000), com `422` e os números; escopo próprio de rate
  limit (`export`, por usuário); auditoria `FINDINGS_EXPORTED` gravada **antes** da entrega.
- **Fórmulas portáveis com valor em cache**; data de referência como valor fixo (não `TODAY()`).
- **Injeção de fórmula:** texto sempre como string; o que começa com `=`, `+`, `-`, `@`, TAB, CR ou LF
  recebe o formato Texto — o dado fica intacto. O `quotePrefix` nativo não existe no ExcelJS.
- A API expõe `Content-Disposition` e `Retry-After` por CORS.

## Consequências

- O servidor passa a fazer uma leitura em massa e a gastar CPU na mesma thread que atende a API. A
  mitigação é o limite de linhas, o rate limit e a cessão do event loop a cada 500 linhas (pior atraso
  medido: 1,7 s com 50.000 linhas). **Não foi medido no Render Free.**
- Mantemos XML de gráfico à mão. O LibreOffice e o `openpyxl` o aceitam e a paridade de recálculo foi
  provada, mas a abertura **sem aviso no Excel desktop/Online não foi automatizada** — exige conferência
  manual.
- O ranking de ativos usa uma aba Auxiliar com um retrato dos 50 ativos mais frequentes: renomear um ativo
  na aba Findings não o inclui no ranking.
- A impressão da aba Findings (23 colunas em 1 página de largura) é miúda; o Dashboard e o Acompanhamento
  foram dimensionados para A4 paisagem.
- **Ponto de extensão assíncrono** (não implementado): `preparar()` continua igual e `gerar()` — que já
  escreve num arquivo — passaria a rodar num job.
- Três dependências de produção novas na API (`exceljs`, `yazl`, `yauzl`) e dois pacotes de tipos.
  `npm audit` acusa `uuid` (moderado) via ExcelJS; o advisory exige passar um `buf` ao `uuid`, o que não ocorre aqui.

## Relacionado

[[ADR-003 - PDF gerado no cliente]] · [[ADR-028 - Tabela de findings como componente canonico]] ·
[[ADR-040 - Rate limiting multi-tenant em memoria]] · guia: `docs/FINDINGS_EXCEL_EXPORT.md`
