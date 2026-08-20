---
type: decisao
tags: [decision, frontend, design-system, acessibilidade]
status: vigente
codigo: ADR-023
data: 2026-08-08
---

# ADR-023 - Biblioteca de componentes própria em vez de Radix

## Contexto

O [[ADR-020 - Stack final do frontend web e CORS]] escolheu montar os componentes base sobre primitivas `@radix-ui/react-*` + Tailwind, sem o CLI do `shadcn/ui`. A escolha funcionou para as Fases 3 a 6.

A auditoria da Fase 6.5 mediu o que de fato existia:

- **11 componentes em `components/ui/`, somando 257 linhas** — média de 23 linhas cada. Eram invólucros de `className`, não componentes.
- **Três importações de Radix, ao todo:**
  - `ui/dialog.tsx` → `react-dialog`, usando `Root`, `Portal`, `Overlay`, `Content`, `Title` e `Description`. É aqui que estava o valor real: armadilha de foco, Escape, clique-fora, `aria-modal`, trava de rolagem do body e retorno de foco ao gatilho.
  - `ui/button.tsx` → `react-slot`, só para `asChild`. Composição pura, zero acessibilidade.
  - `ui/label.tsx` → `react-label`, para suprimir seleção de texto no duplo clique. Comportamento cosmético.
- **`@radix-ui/react-select` estava no `package.json` e não era importado em lugar nenhum** — dependência morta desde a Fase 3.

Ou seja: de quatro pacotes, um entregava acessibilidade de verdade, dois entregavam conveniência marginal e um não era usado.

Ao mesmo tempo, a Fase 6.5 precisava de ~30 componentes (Combobox, Drawer, Popover, Tooltip, DropdownMenu, ContextMenu, Toast, Table com ordenação, Tabs, Accordion, Slider…). Continuar com o Radix significaria adicionar 8 a 10 pacotes novos.

## Decisão

**Remover o Radix por completo e construir a biblioteca de componentes do produto.**

`grep -rn "from \"@radix-ui" app/web/src` retorna vazio; `@radix-ui/*` não consta no `package.json`; o diretório `node_modules/@radix-ui` não existe.

**O custo assumido, explicitamente:** o Radix entrega acessibilidade testada por milhares de aplicações. Reconstruí-la significa assumir a responsabilidade por focus trap, `inert`, navegação por setas, typeahead, `aria-activedescendant` e retorno de foco — coisas que quebram silenciosamente e que ninguém percebe numa revisão de código.

**Como a acessibilidade foi preservada — três mecanismos:**

1. **Contrato escrito.** Todo componente interativo tem, no topo do arquivo, um bloco `CONTRATO DE ACESSIBILIDADE` em PT-BR declarando role e atributos ARIA, teclas suportadas, comportamento de foco (onde entra, onde é preso, para onde volta) e o que o leitor de tela anuncia.
2. **Maquinaria centralizada** em `components/ui/_internal/`, **não reexportada** pelo barril: `useFocusTrap`, `useDismiss`, `useScrollLock`, `useInertForaDe`, `Portal`, `useAnchoredPosition` e `useListaNavegavel`. Uma tela que importasse esses hooks estaria construindo um overlay fora do contrato — por isso são privados.
3. **Teste por item do contrato.** `overlays.test.tsx` prova, com `@testing-library/user-event`, cada linha: foco entra ao abrir, `data-autofocus` respeitado, Tab cicla e não escapa, Escape fecha, clique-fora fecha (e não fecha quando desligado), `aria-modal`/`aria-labelledby`/`aria-describedby` apontam para nós existentes, rolagem travada, foco devolvido ao gatilho, resto da árvore `inert`, setas/Home/End/typeahead no menu, `aria-activedescendant` no select, roving tabindex e ativação manual nas tabs. Mais `axe-core` sobre os componentes.

**Substituições dos comportamentos perdidos:**

| Radix | Substituto | Observação |
|---|---|---|
| `Slot` / `asChild` | `LinkButton` | `<Button asChild><Link>` sempre foi ambíguo: renderiza um `<a>` que parece botão. `LinkButton` diz no nome que navega, e é `<a>` de verdade — Ctrl+clique abre em nova aba. |
| `react-label` | `Field` + `Label` | `Field` gera ids e amarra rótulo/dica/erro por `useId`. Perde-se a supressão de seleção no duplo clique — cosmético. |
| posicionamento flutuante | `useAnchoredPosition` | ~80 linhas com flip e clamp. `@floating-ui` foi descartado: trocar uma dependência por outra contrariaria esta própria decisão. |

## Consequências

- **Uma decisão de implementação que vale registrar:** `Select`/`Combobox`/menus usam `aria-activedescendant`, **não** roving tabindex. Motivo concreto: no Combobox, mover o foco real para a opção tiraria o foco do campo de texto e impediria continuar digitando.
- **Achado durante os testes:** a primeira versão da armadilha de foco usava `offsetParent === null` para checar visibilidade — o atalho comum. Está errado para qualquer elemento `position: fixed` (ou seja, todo overlay) e é sempre `null` no jsdom. Foi trocado por checagem da cadeia de estilo computado. **Um bug real, encontrado só porque o contrato virou teste.**
- **Limitação conhecida:** a paridade foi provada em jsdom, não em leitor de tela real. NVDA/VoiceOver não foram testados — está registrado como limitação em `docs/BACKLOG.md`.
- A Fase 7 (mobile) herda o vocabulário e o contrato, não o código: React Native não tem DOM.
- `bundle`: sem Radix e com `motion` + fontes, o JS foi de 1.170 kB para 1.439 kB. O crescimento é do `motion` e do Recharts do dashboard novo, não da remoção do Radix.

## Alternativa descartada

**Manter o Radix e adicionar os 8-10 pacotes que faltavam.** Descartada por três razões: (a) o inventário mostrou que só o Dialog entregava valor real; (b) a Fase 6.5 é explicitamente sobre POSSUIR o design system, e uma biblioteca de componentes que é 90% invólucro de terceiro não é do projeto; (c) para a defesa do TCC, "reconstruí a acessibilidade e provei com teste" é material demonstrável — "instalei um pacote" não é.

## Relacionado
[[ADR-020 - Stack final do frontend web e CORS]]
[[ADR-024 - Sistema de temas com tokens OKLCH]]
