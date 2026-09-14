---
type: funcionalidade
tags: [feature, findings, busca]
status: ativo
---

# Findings Globais

## Objetivo

Dar a quem analisa uma visão **entre projetos**: todos os achados que o ator
pode ver, num lugar só, com filtros combináveis e link compartilhável.

Até a Fase 9, ver findings exigia entrar projeto por projeto. Perguntas
elementares do trabalho de análise — *"o que está crítico e aberto em tudo que
eu acompanho?"*, *"onde mais apareceu A03 este mês?"* — não tinham como ser
respondidas sem abrir uma aba por projeto e somar à mão.

## Quem usa

| Papel | Acesso |
| --- | --- |
| **ADMIN** | Página global, findings de todas as empresas |
| **PENTESTER** | Página global, findings dos projetos onde é membro (RN17) |
| **CLIENT** | **Não tem a página.** Continua vendo os findings da própria empresa (RN16) no painel, dentro do projeto e no app mobile |

⚠️ O bloqueio do CLIENT é de **produto**, não de isolamento: uma varredura entre
empresas é ferramenta de quem analisa. O isolamento continua sendo do servidor,
e é o mesmo de sempre.

## Componentes

- **Barra de query wizard** — linguagem estruturada (`severidade = HIGH, CRITICAL`)
  misturada com texto solto. Expressão inválida vira chip em erro e **não é
  aplicada**. Sintaxe completa em `docs/FINDINGS_QUERY.md`.
- **Caixa de sugestões** — abre no clique mostrando os campos disponíveis com
  descrição e exemplo; escolher um campo passa a sugerir os valores dele, com a
  contagem de cada um. É o que torna a linguagem descobrível: uma consulta que
  ninguém descobre é um campo de busca comum com passos a mais.
- **Exportação CSV** do recorte inteiro (não da página), montada no navegador
  como os PDFs (ADR-003).
- **Controles de severidade, status e OWASP** com **contagem por opção**,
  refletindo os outros filtros já aplicados.
- **Tabela** com ordenação por coluna e paginação, ambas no servidor.
- **Chips** do que está ativo, removíveis um a um.
- **Página de detalhe** — trilha Empresa › Aplicação › Projeto › Finding, CVSS
  decomposto nas 8 métricas, severidade calculada × aplicada × justificativa,
  evidências, comentários, **trilha de auditoria** e as ações permitidas.

## Como os filtros se combinam

🎯 **AND entre campos diferentes, OR dentro do mesmo campo.**
`severidade = HIGH, CRITICAL status = OPEN` significa *(Alta ou Crítica) e Aberto*.

## Decisões que valem lembrar

- **Um componente só.** A tabela é a mesma na página global e na aba do projeto,
  configurada por contexto (`lockedFilters`, `hiddenColumns`). Ver [[ADR-028 - Tabela de findings como componente canonico]].
- **Contagem no banco, nunca no navegador.** Filtro, ordenação, paginação e
  facetas saem de `where`/`groupBy`, pela mesma regra que [[ADR-025 - Metricas analiticas derivadas do AuditLog]] impôs às métricas.
- **A faceta ignora o próprio filtro.** Se a contagem de severidade respeitasse o
  filtro de severidade, marcar "Alta" zeraria todas as outras — e seria
  impossível descobrir que ainda vale marcar "Crítica".
- **A URL é a fonte da verdade** na página global: link compartilhável, voltar do
  navegador desfaz filtro, recarregar preserva o recorte.

## Regras associadas

- [[RN16 - Cliente ve apenas dados da propria empresa]]
- [[RN17 - Pentester ve apenas projetos onde e membro]]
- [[RN10 - Severidade via CVSS com override justificado]]
- [[RN11 - Toda Vulnerability deve ter categoria OWASP]]

## Relacionado

- [[Findings]] — o módulo do finding individual
- [[ADR-028 - Tabela de findings como componente canonico]]
- [[ADR-021 - Maquina de Vulnerability com 4 estados]]
- `docs/FINDINGS_QUERY.md` — guia de uso da busca
