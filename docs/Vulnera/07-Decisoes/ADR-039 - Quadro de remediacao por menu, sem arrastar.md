---
type: decisao
tags: [decision, kanban, remediation, acessibilidade, assignee, auditoria]
status: vigente
codigo: ADR-039
data: 2026-09-16
---

# ADR-039 - Quadro de remediação por menu, sem arrastar

## Contexto

O CP-7 entregou o quadro de remediação: os findings em aberto organizados por
status, com responsável. O ADR-033 já havia destravado as transições de retorno
justamente para que um quadro fizesse sentido.

Faltava decidir **como se move um cartão** — e o padrão da indústria
(arrastar-e-soltar, com `dnd-kit` ou equivalente) não sobreviveu à primeira
pergunta séria: como isso funciona para quem usa teclado?

## Decisão

**Mover é um MENU, não um gesto de arrastar. Não há biblioteca de
drag-and-drop.**

Cada cartão tem "Mover para…", que abre as transições **válidas a partir do
status atual** — a mesma máquina de estados do backend (ADR-033), navegável por
Tab e setas, com foco devolvido ao gatilho ao fechar.

**O quadro não mostra `CLOSED`.** Um quadro de trabalho mostra o que está em
aberto; a coluna de encerrados cresce para sempre e empurra as outras para fora
da tela.

**Atribuir é operação PRÓPRIA** (`POST /vulnerabilities/:id/assign`), não um
campo de um PUT do finding inteiro.

**Quem pode ser responsável é quem já ENXERGA o finding:**

| Papel do responsável | Regra                                          |
|----------------------|------------------------------------------------|
| `PENTESTER`          | precisa ser membro do projeto (RN17)           |
| `CLIENT`             | precisa ser da empresa dona do finding (RN16)  |
| `ADMIN`              | sempre                                          |

**Toda troca gera `ASSIGNEE_CHANGED`** na auditoria, com `{from, to}`.

## Justificativa

1. **Arrastar não é operável por teclado.** Este quadro grava no banco e entra
   na auditoria; deixar a ação principal só para quem usa mouse abriria um
   buraco no contrato de acessibilidade do produto exatamente na tela mais
   operacional.
2. **O menu é mais honesto que o arrastar.** Nem todo movimento é permitido —
   `CLOSED` é terminal. Um cartão arrastado para lá e recusado pelo servidor
   voltaria sozinho, sem explicação; o menu simplesmente não oferece o destino
   inválido.
3. **Atribuir a quem não enxerga o finding cria tarefa fantasma**: ela aparece
   no quadro de quem atribuiu e em lugar nenhum para o atribuído.
4. **"Quem ficou de corrigir, e desde quando" é pergunta de post-mortem.** Ela
   precisa ser respondível sem abrir diffs de campos — daí o evento próprio.
5. **Menos uma dependência.** `dnd-kit` custaria peso de bundle e uma camada de
   acessibilidade para reimplementar por cima.

## Consequências

- **`assignedTo` virou filtro de primeira classe**, expresso nos **dois**
  construtores gêmeos, com o valor especial `none` para "sem responsável" —
  `IN (...)` nunca casa com `NULL`, então o não-atribuído precisa virar
  `IS NULL` nos dois lados.
- **Índices novos**: `[assignedTo]` e `[companyId, assignedTo, status]`.
- **O Query Wizard ganhou o campo `responsavel`** (com apelidos `assignee`,
  `dono`, `atribuido`), resolvido por autocomplete como projeto/aplicação.
- **A listagem passou a trazer `assigneeName`** no mesmo JOIN do contexto: sem
  isso, o quadro precisaria de uma segunda requisição só para trocar ids por
  nomes — e o PENTESTER, que só enxerga a si mesmo em `GET /users`, veria ids
  crus nos cartões dos colegas.
- **Uma busca por quadro, não uma por coluna.** Três requisições devolveriam
  três retratos de instantes diferentes, e um finding movido entre elas
  apareceria em duas colunas ao mesmo tempo.
- **⚠️ Bug encontrado e corrigido no caminho.** Ao acrescentar o terceiro filtro
  composto ao `where()` do Prisma, apareceu que cada um montava a **sua própria
  chave `AND`** num mesmo objeto literal — e a última apagava as anteriores.
  Combinar SLA (CP-2) com aceite (CP-4) perdia o filtro de SLA em silêncio,
  devolvendo MAIS findings do que o pedido. Agora há uma lista única de
  condições e uma só chave `AND`. Canário: **`VULN-LIST-09`**.

## Alternativas descartadas

**Arrastar-e-soltar com `dnd-kit`.** Descartada — ver justificativa 1 e 2.

**Arrastar com fallback de teclado.** Descartada: duas implementações da mesma
ação, e a de teclado seria a menos testada — o padrão que produz recursos
acessíveis no papel e quebrados na prática.

**Entidades `Board`/`Column`/`Card` configuráveis.** Descartada desde o
mapeamento: criaria uma segunda máquina de estados concorrente com
`Vulnerability.status` (ver ADR-033).

**Mostrar `CLOSED` numa quarta coluna com paginação.** Descartada: paginar uma
coluna de Kanban é sinal de que ela não pertence ao quadro.

## Relacionado
[[ADR-033 - Transicoes de retorno na maquina de Vulnerability]]
[[ADR-038 - Buscas salvas guardam a pergunta, nunca a resposta]]
[[Matriz de Permissoes]]
