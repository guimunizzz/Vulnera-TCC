---
type: decisao
tags: [decision, frontend, design-system, acessibilidade, tema]
status: vigente
codigo: ADR-024
data: 2026-08-09
---

# ADR-024 - Sistema de temas com tokens OKLCH

> [!warning] Esta decisão REVERTE um corte de escopo
> "Alternância de tema" estava listada em [[Fora do Escopo]] e no [[ADR-014 - Escopo reduzido para prazo de 3 meses]] como cortada pelo prazo. A nota `Fora do Escopo` foi atualizada, apontando para cá.
>
> **Por que reverter:** o corte foi feito quando "tema" significava *uma funcionalidade a mais*. Na Fase 6.5 o problema mudou de natureza — a exigência era um design system com tokens semânticos, e **um sistema de tokens semânticos bem-feito já É um sistema de temas**. A camada de indireção (`--color-surface` → `--neutral-900`) tem que existir de qualquer forma para o mobile da Fase 7 consumir; ter um segundo tema é consequência quase gratuita dela. O que custou não foi o segundo tema — foi calibrar as cores de severidade para fundo claro, e essa calibragem também é o que prova que os tokens funcionam.

## Contexto

Até a Fase 6, o `app/web/tailwind.config.ts` tinha **9 cores em hex**, num tema escuro único, com `color-scheme: dark` fixo no `index.css`. Trocar de tema era impossível sem editar componente. Não havia escala tipográfica, escala de espaçamento própria, raio, elevação nem movimento — só o default do Tailwind.

Além disso, as cores de severidade (`#dc2626`, `#f97316`, `#eab308`, `#3b82f6`, `#6b7280`) foram calibradas contra `#0a0a0a` e nunca haviam sido medidas.

## Decisão

### 1. Cor em OKLCH, não hex

Sete rampas de 11 passos, todas compartilhando a mesma **espinha de lightness** (o passo 500 tem L≈0,596 em qualquer matiz; o 900, L≈0,290).

**Por que OKLCH:** o `L` é lightness *perceptual*. Em HSL, `hsl(60 100% 50%)` (amarelo) é muito mais claro que `hsl(240 100% 50%)` (azul) apesar do mesmo "50%". Como a rampa de severidade atravessa vermelho → laranja → amarelo → azul, é exatamente onde HSL mais mente. Com OKLCH dá para fixar a espinha e ter um chip `CRITICAL` e um chip `LOW` com o mesmo peso visual.

**Formato dos valores:** o token guarda só os três componentes (`0.596 0.200 292`), sem a função `oklch()`. É o que permite `oklch(var(--color-accent) / <alpha-value>)` no Tailwind e, portanto, `bg-accent/50` — sem depender de *relative color syntax*, que é recente demais.

### 2. Duas camadas, e componente só enxerga a de cima

`--iris-500` é **primitivo** ("a cor violeta, passo 500"). `--color-accent` é **semântico** ("a cor de ação"). Componente usa **somente** semântico, e isso é imposto por build: o `tailwind.config.ts` expõe apenas os semânticos, então `bg-iris-500` **não compila**. A regra virou erro de build, não recomendação.

### 3. Violeta como cor de ação — por eliminação

O acento anterior era `emerald #10b981`. Num produto de segurança o verde já significa "remediado", "sem risco", "postura estável" — usar o mesmo matiz para "isto é clicável" faz o olho competir entre ação e estado justamente na tela onde é preciso distinguir os dois rapidamente.

Sobrou pouco: vermelho é `CRITICAL`, laranja é `HIGH`, âmbar é `MEDIUM`, azul é `LOW`, verde é sucesso. **Violeta (matiz 292) é o único matiz a mais de 30° de todos eles** — o único que nunca compete com o dado.

### 4. Três temas, sem flash

`dark` (padrão) · `light` · `system`. Um script **síncrono no `<head>`** do `index.html` lê o `localStorage` e estampa `data-theme` antes do primeiro paint. A lógica é deliberadamente duplicada entre esse script e `design/theme.ts` (um módulo importado carregaria tarde demais); o teste `TEMA-01` confere que os dois usam a mesma chave e os mesmos valores.

O atributo estampado é **sempre concreto** (`dark`/`light`, nunca `system`), o que deixa o CSS com dois casos em vez de três e dispensa duplicar a paleta clara dentro de um `@media (prefers-color-scheme)`.

O seletor é `[data-theme="light"]`, **sem** `:root` na frente. Isso permite temar uma subárvore — é como a rota `/styleguide` mostra os dois temas lado a lado na mesma página.

### 5. Contraste medido, não estimado

`app/web/scripts/check-contrast.mjs` converte OKLCH → sRGB à mão (matemática do Björn Ottosson reimplementada, sem dependência de cor), calcula o contraste WCAG 2.1 a partir da cor **exibida** (pós-clamp de gamut) e falha o build abaixo do mínimo. Roda em `npm run check`.

**Resultado atual: 66 pares medidos, 0 falhas, 77 primitivos auditados, 0 fora do gamut sRGB.**

A ferramenta **encontrou quatro reprovações reais** na primeira execução: texto branco sobre `iris-500` media 4,18:1 e sobre `red-500`, 4,25:1 (por isso acento e perigo usam o passo **600** nos dois temas); `border-strong` media 2,55:1 (subiu de `neutral-600` para `neutral-500`). E **15 cores fora do gamut sRGB**, corrigidas regenerando as rampas com teto de crominância por matiz.

## Consequências

- Trocar de tema não toca em nenhum componente. Adicionar um terceiro tema (alto contraste, por exemplo) é escrever um bloco `[data-theme="x"]` com os semânticos.
- **A Fase 7 (mobile) consome `tokens.css` como especificação.** Os valores OKLCH portam para React Native via conversão para hex; a estrutura (primitivo → semântico) porta direto.
- **Custo real medido:** o CSS foi de 13,79 kB para 46,65 kB (10,98 kB gzip). O aumento é dos tokens e dos ~30 componentes novos, não do segundo tema.
- **No tema claro, a elevação muda de mecanismo:** no escuro é *lightness* (cada nível sobe ~0,05 de L); no claro é *sombra*. São meios diferentes porque o olho lê profundidade de formas diferentes em cada fundo — card branco sobre página branca só existe porque projeta sombra.
- **Armadilha encontrada e registrada:** `borderWidth` e `borderColor` do Tailwind não podem ter chaves iguais. Com `strong` nos dois, a classe `border-strong` emitia *largura E cor* ao mesmo tempo, e todo `border border-strong` virava silenciosamente 2px. A largura forte passou a se chamar `2`.

## Alternativa descartada

**Manter o tema escuro único e só extrair os tokens.** Descartada porque a extração de tokens semânticos é 90% do trabalho de um sistema de temas — parar antes do segundo tema teria o mesmo custo e nenhuma prova de que a indireção funciona. Foi justamente ao calibrar o tema claro que as quatro reprovações de contraste apareceram; num tema só, elas continuariam invisíveis.

## Relacionado
[[ADR-023 - Biblioteca de componentes propria em vez de Radix]]
[[ADR-014 - Escopo reduzido para prazo de 3 meses]]
[[Fora do Escopo]]
