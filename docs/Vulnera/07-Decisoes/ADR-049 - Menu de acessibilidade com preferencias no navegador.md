---
type: decisao
tags: [decision, frontend, acessibilidade, wcag, design-system]
status: vigente
codigo: ADR-049
data: 2026-10-31
---

<!-- Registra por que o web ganhou um menu de acessibilidade, onde as preferências moram e por que o alto contraste é um reforço e não um tema; consumido pelos mantenedores e pela banca. -->

# ADR-049 — Menu de acessibilidade com preferências no navegador

## Contexto

O design system já media contraste AA nos dois temas (`check-contrast.mjs`), respeitava
`prefers-reduced-motion` e tinha contrato de acessibilidade por componente. Faltava dar à pessoa
controle **dentro do produto**: ampliar a letra sem depender do zoom do navegador, pedir menos
movimento sem mexer no sistema operacional, reforçar o contraste e testar o espaçamento de texto do
WCAG 1.4.12. O pedido (Rafael, 2026-10-31) foi um menu no canto superior direito, que abre um painel,
com ícone próprio em cada opção, mirando WCAG 2.2 AA.

## Decisão

Respostas do Rafael às quatro perguntas abertas, mais o que decorreu delas:

- **Onde aparece: todas as telas.** Cabeçalho do `AppLayout` (ao lado do tema), barra da landing e
  botão fixo nas rotas sem cabeçalho (login, cadastro, planos, onboarding) via a rota de layout
  `ComMenuAcessibilidade`. **Exceção:** o relatório do ZAP, que é um iframe `sandbox` de
  terceiros — nossas preferências não alcançam o documento dele; o zoom do navegador alcança.
- **Onde fica salvo: no navegador** (`localStorage`, chave `vulnera:a11y`), como o tema
  (ADR-024). Vale antes do login, não exige schema, migration nem endpoint, e um script inline no
  `index.html` aplica antes do primeiro paint — quem pediu 150% não vê a página nascer em 100%.
  Custo aceito: a escolha não acompanha a pessoa entre dispositivos.
- **Alto contraste é reforço, não tema.** Um bloco por tema em `tokens.css` §11 sobe texto a 7:1
  (régua AAA, medida pelo `check-contrast.mjs`), bordas de controle e anel de foco. Um terceiro
  tema (preto e amarelo) obrigaria a recalibrar toda a rampa de severidade.
- **Opções:** tamanho do texto (100–200%), alto contraste, reduzir animações, sublinhar links,
  espaçamento de texto e foco reforçado, mais "Restaurar padrão". Cursor grande ficou de fora.
- **Uma fonte da verdade para movimento.** `design/accessibility.ts` expõe `movimentoReduzido()`
  (menu **ou** sistema). `useMotion()`, o `MotionConfig` da raiz, os efeitos GSAP da landing, o
  fundo do login e a intro 3D da landing passaram a consultá-la. No CSS, o mesmo piso do
  `@media (prefers-reduced-motion)` vale para `:root[data-reduzir-movimento]`.
- **Popover, não DropdownMenu.** O painel tem interruptores e botões de passo; `role="menu"` só
  admite itens de menu. Botões no limite usam `aria-disabled` para não perder o foco.

## Consequências

- `base.css` passou a usar `font-size: calc(100% * var(--a11y-escala-fonte, 1))` em vez de `16px`:
  o tamanho de letra configurado no navegador agora também é respeitado.
- Ampliar pela raiz escala texto **e** espaçamento (tudo é rem), mas os breakpoints são em px. Dois
  pontos se sobrepunham e foram corrigidos: os links centrais da landing saem com texto acima de
  110%, e o lema do hero do dashboard sai por container query em rem.
- A intro 3D da landing não roda mais com movimento reduzido — antes ela ignorava a preferência.
- A landing (`--vx-*`) e o login (`--login-*`) têm paletas próprias: recebem reforço de texto e
  borda, mas não estão na régua AAA do `check-contrast.mjs`.
- Provas: `sistema.test.tsx` (MOV-03, A11Y-PREF-01..05) e `e2e/acessibilidade.spec.ts` (AC-01..04,
  com `axe-core` WCAG 2.x A/AA em 9 telas, também com alto contraste e texto a 200%).
- **Não testado com leitor de tela real** (NVDA/VoiceOver), como o resto do design system.
