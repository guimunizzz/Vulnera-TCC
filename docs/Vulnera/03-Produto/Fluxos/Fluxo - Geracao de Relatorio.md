---
type: fluxo
tags: [feature, flow]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Fluxo - Geracao de Relatorio

## Objetivo
Permitir que Admin ou Pentester gere um relatório (executivo ou técnico) de um Project, em PDF client-side.

## Ator principal
Admin ou Pentester (geração) · Cliente (download)

## Pré-condições
- Project no status `IN_REVIEW` ou superior (`DELIVERED`, `CLOSED`)
- usuário autenticado com role `ADMIN` ou `PENTESTER`

## Passos principais

### Geração
1. Admin ou Pentester acessa o projeto e clica em "Gerar Relatório"
2. Seleciona o tipo: **Executivo** (visão de risco, resumo de maturidade) ou **Técnico** (detalhes de findings, evidências)
3. O front-end carrega os dados do projeto via API
4. O front-end renderiza o PDF usando `pdf-lib` (processamento 100% no browser)
5. Sistema registra metadados do relatório em `Report` (tipo, título, data, gerado_por)
6. PDF fica disponível para download

### Download pelo cliente
1. Cliente acessa a área de relatórios do projeto
2. Visualiza lista de relatórios disponíveis
3. Clica em "Baixar" → download do PDF direto pelo browser

## Regras de negócio relacionadas
- [[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]] — gate de status
- [[ADR-003 - PDF gerado no cliente]] — justifica o processamento client-side

## Pós-condições
- `Report` criado no banco com metadados
- PDF disponível para download pelo cliente

## Notas de arquitetura
- **nenhum processamento de PDF ocorre no servidor** — reduz superfície de ataque DDoS
- o PDF é gerado a partir de dados já disponíveis no front-end
- relatório técnico inclui: sumário executivo, lista de findings por severidade, evidências selecionadas, recomendações
- relatório executivo inclui: resumo de risco, score de maturidade, gráfico de distribuição, tendências

## Relacionado
[[Fluxo - Abertura de Projeto]]
[[Relatorios]]
[[Report]]
[[Project]]
[[Maquina - Project]]
[[ADR-003 - PDF gerado no cliente]]
