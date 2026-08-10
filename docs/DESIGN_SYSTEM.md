# DESIGN_SYSTEM.md — Vulnera

> **Este documento é a especificação que a Fase 7 (mobile) consome.**
> Ele descreve o sistema, não a implementação web. Onde o React Native precisar
> de algo diferente, o que vale é a INTENÇÃO registrada aqui — não o CSS.
>
> Criado na Fase 6.5 (2026-08-09). Decisões formais em
> [ADR-023](Vulnera/07-Decisoes/ADR-023%20-%20Biblioteca%20de%20componentes%20propria%20em%20vez%20de%20Radix.md)
> e [ADR-024](Vulnera/07-Decisoes/ADR-024%20-%20Sistema%20de%20temas%20com%20tokens%20OKLCH.md).

---

## 1. Direção estética

**"Instrumento, não painel de marketing."**

O Vulnera é ferramenta profissional de segurança, densa em dados, usada por horas
seguidas. A referência é Linear, Datadog e Tenable — não app de consumo.

Três compromissos, e o porquê de cada um:

**Fundo slate-azulado profundo, nunca preto puro.** `#000` com texto branco
produz *halation* (o texto "vaza" nas bordas em LCD) e *smearing* ao rolar em
OLED. `L 0.17` dá praticamente o mesmo contraste sem nenhum dos dois. Os neutros
carregam 0,002–0,018 de crominância no mesmo eixo frio do acento: cinza puro ao
lado de violeta parece esverdeado por contraste simultâneo, e um neutro
levemente frio faz a tela ler como um sistema só, não como "cinza com adesivos
coloridos".

**Um único acento violeta, reservado exclusivamente à AÇÃO.** Não é gosto, é
eliminação. Num produto de segurança, vermelho é `CRITICAL`, laranja é `HIGH`,
âmbar é `MEDIUM`, azul é `LOW` e verde é "remediado". O acento anterior era
`emerald #10b981` — o mesmo matiz de "resolvido", o que fazia o olho competir
entre ação e estado justamente na tela onde é preciso distinguir os dois. Violeta
(matiz 292) é o único matiz a mais de 30° de todos os outros: **o único que
nunca compete com o dado**.

**Números que não dançam.** `font-variant-numeric: tabular-nums` em toda tabela,
métrica e valor mono. Sem isso, um KPI animando de 18 para 21 muda de largura no
meio da animação, e uma coluna de CVSS não alinha na vírgula.

### O que NÃO fazer

- ❌ Usar cor de severidade para dimensão sem significado (categoria OWASP,
  aplicação). Um A01 pintado de vermelho é lido como "crítico" por qualquer
  pessoa que já viu a outra tela. Use `--color-chart-1..6`.
- ❌ Usar verde para "clicável". Verde é resultado, não ação.
- ❌ Comunicar estado só por cor. Toda severidade tem texto ("Crítica", "Alta");
  todo erro tem ícone e texto; todo switch muda a POSIÇÃO do polegar (WCAG 1.4.1).
- ❌ Inventar duração de animação, raio, sombra ou espaçamento no componente.
  Se o token não serve, o token está errado — conserte o token.

---

## 2. Tokens

Fonte única: **`app/web/src/styles/tokens.css`**.

### 2.1 As duas camadas

| Camada | Exemplo | Significa | Muda com o tema? |
|---|---|---|---|
| **Primitivo** | `--iris-500` | "a cor violeta, passo 500" | Não |
| **Semântico** | `--color-accent` | "a cor de ação" | **Sim** — aponta para outro primitivo |

🎯 **REGRA INVIOLÁVEL: componente usa SOMENTE semântico.**

Na web isso é imposto por build: o `tailwind.config.ts` expõe apenas semânticos,
então `bg-iris-500` **não compila**. No mobile, imponha por lint ou por revisão —
o efeito de um primitivo num componente é pregá-lo ao tema escuro para sempre.

A única exceção autorizada é a rota `/styleguide`, que mostra as rampas e o faz
por `style={{}}` explícito.

### 2.2 Formato dos valores

Os tokens de cor guardam **só os três componentes** do OKLCH:

```css
--iris-500: 0.596 0.200 292;   /* L C H, sem a função oklch() */
```

Isso é o que permite ao Tailwind aplicar opacidade
(`oklch(var(--color-accent) / <alpha-value>)`, habilitando `bg-accent/50`) sem
depender de *relative color syntax*.

⚠️ **Exceção:** tokens que já embutem alpha (`--color-scrim`,
`--color-bg-hover`) guardam a cor inteira e **não** aceitam modificador de
opacidade.

**Para o mobile:** converta OKLCH → hex uma vez, na geração da paleta. Os hexes
de referência estão em comentário ao lado de cada primitivo no `tokens.css`.

### 2.3 Cor — as rampas

Sete rampas × 11 passos (50…950), **todas na mesma espinha de lightness**:

| Passo | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **L** | .970 | .932 | .876 | .795 | .706 | .596 | .520 | .442 | .362 | .290 | .222 |

É isso que faz um chip `CRITICAL` e um chip `LOW` pesarem igual na tela.

| Rampa | Matiz | Papel |
|---|---|---|
| `neutral` | 255 | superfícies, texto, bordas |
| `iris` | 292 | **ação** (botão, link, foco, seleção) |
| `red` | 27 | `CRITICAL`, destrutivo, erro |
| `orange` | 55 | `HIGH` |
| `amber` | 85 | `MEDIUM`, atenção |
| `blue` | 258 | `LOW` |
| `green` | 155 | sucesso, remediado, série "resolvidos" |

A **crominância varia por matiz**, e isso não é descuido: o gamut sRGB não é
uniforme. Amarelo satura muito em L alto e quase nada em L baixo; azul o
contrário. Forçar a mesma crominância produziria cores fora do gamut, que o
navegador clampa — e cor clampada é cor que mente, porque dois passos vizinhos
viram a mesma cor na tela.

### 2.4 Semânticos que você vai usar

```
Superfícies   --color-bg-canvas · -surface · -raised · -overlay · -inset
Texto         --color-text-primary · -secondary · -muted · -inverted
Bordas        --color-border-subtle · -default · -strong
Ação          --color-accent · -hover · -active · -fg · -ink · -surface
              --color-focus-ring
Estados       --color-success/warning/danger  (+ -ink, -surface, -fg)
Severidade    --color-severity-{critical,high,medium,low,info}
                                (+ -ink, -surface)
Gráficos      --color-chart-1..6 · -grid · -axis
```

**A convenção `-ink` / `-surface` — leia isto antes de usar severidade:**

| Sufixo | Para quê | Mínimo de contraste |
|---|---|---|
| *(nenhum)* | **preenchimento** gráfico (fatia, barra, ponto) | 3:1 |
| `-ink` | **texto** | 4,5:1 |
| `-surface` | fundo tingido do chip | o `-ink` tem que passar sobre ele |

Não são intercambiáveis. `--color-severity-critical` num texto reprova AA.

### 2.5 Tipografia

**Par de fontes:** **Archivo** (interface) + **JetBrains Mono** (dados).

Archivo é uma grotesca com x-height alta e aberturas fechadas: aguenta 13–14px
em tabela densa sem fechar os contornos, e tem personalidade suficiente para não
parecer "o default".

JetBrains Mono não é enfeite. Um vetor
`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` e um id `cuid()` só são
conferíveis se `0`/`O` e `1`/`l`/`I` forem inconfundíveis — que é exatamente o
que ela resolve. **Use mono em: vetor CVSS, id, nota numérica, código, e qualquer
valor que a pessoa vá conferir caractere a caractere.**

**Escala modular 1.200 (terça menor)**, ancorada em `0.875rem` = 14px:

| Token | rem | px | Uso |
|---|---|---|---|
| `xs` | 0.729 | 11,7 | ⚠️ **só** micro-rótulo em CAIXA ALTA com tracking aumentado |
| `sm` | 0.875 | **14** | **corpo e tabela** — o piso do texto de leitura |
| `base` | 1.05 | 16,8 | texto de destaque |
| `lg` | 1.26 | 20,2 | título de seção |
| `xl` | 1.512 | 24,2 | título de página |
| `2xl` | 1.815 | 29,0 | KPI |
| `3xl` | 2.177 | 34,8 | KPI grande |
| `4xl` | 2.613 | 41,8 | display |

Cada tamanho vem **com** entrelinha e tracking pareados (a entrelinha cai
conforme o corpo sobe; título grande fecha o tracking, micro-rótulo abre).
Escolher o tamanho sem escolher a entrelinha é o começo do `text-3xl
leading-tight` espalhado por 40 arquivos.

### 2.6 Espaçamento — 4px, sem exceções

`0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96`

Os meios-passos do Tailwind (`0.5`/`1.5`/`2.5`/`3.5` = 2/6/10/14px) foram
**removidos da config**, não apenas evitados. Meio-passo é a porta de entrada do
alinhamento "quase certo" que ninguém consegue justificar.

`px` (1px) sobrevive para hairline de borda e separador — que é largura, não
espaçamento.

**Alvo de toque:** `--size-touch-target: 44px` (WCAG 2.5.5/2.5.8). Controles
densos usam `.alvo-estendido`, que estende a área CLICÁVEL a 44px por
pseudo-elemento sem alterar o layout.

### 2.7 Raio, borda e elevação — nomeados por INTENÇÃO

```
--radius-control    6px   botão, input, chip, checkbox
--radius-container 10px   card, painel
--radius-overlay   14px   dialog, popover, drawer, toast
--radius-full             avatar, pill

--elevation-raised        card levantado da página
--elevation-overlay       popover, dropdown, toast
--elevation-modal         dialog, drawer
```

Nome por tamanho (`sm`/`md`/`lg`) obriga a decidir de novo a cada uso; nome por
intenção decide uma vez: *é controle? é contêiner? é overlay?*

⚠️ **A elevação muda de MECANISMO por tema.** No escuro é *lightness* (cada
nível sobe ~0,05 de L; sombra quase não lê sobre fundo escuro). No claro é
*sombra* (card branco sobre página branca não tem para onde subir em L). No
mobile, a mesma lógica: `elevation` no Android escuro precisa de tom, não só de
sombra.

### 2.8 Movimento

```
--duration-instant   80ms   press, troca de cor de estado
--duration-fast     140ms   SAÍDA de overlay, hover
--duration-base     200ms   ENTRADA de overlay, troca de conteúdo
--duration-slow     320ms   entrada de drawer
--duration-chart    700ms   ÚNICA acima de 400ms: desenho de gráfico

--ease-out          cubic-bezier(0.16, 1, 0.3, 1)
--ease-spring       cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-emphasized   cubic-bezier(0.2, 0, 0, 1)
```

🎯 **Nenhum componente inventa duração.** O espelho em TypeScript
(`src/motion/tokens.ts`) é conferido contra o CSS por teste.

---

## 3. Catálogo de componentes

Todos em `app/web/src/components/ui/`, exportados por `index.ts`.
`_internal/` **não** é reexportado — ver §5.

### Primitivas

| Componente | Props que importam |
|---|---|
| `Button` | `variant` (primario·secundario·fantasma·sutil·destrutivo) · `size` (sm·md·lg) · `carregando` · `iconeInicio/Fim` · `rotulo` (**obrigatório** se só ícone) · `larguraTotal` |
| `LinkButton` | `to` + as mesmas de `Button`. Renderiza `<a>` — use quando NAVEGA |
| `Input` | `prefixo` · `sufixo` · `mono` |
| `Textarea` | `mostrarContador` · `maxLinhas` (cresce sozinho) |
| `Field` | `rotulo` · `dica` · `erro` · `obrigatorio` · `rotuloOculto`. Render prop entrega `id`/`aria-describedby`/`aria-invalid` prontos |
| `Checkbox` / `Radio` / `RadioGroup` | `rotulo` · `descricao` · `indeterminado` (checkbox) |
| `Switch` | `checked` · `onCheckedChange` · `rotulo`. **Efeito imediato** — se depende de "Salvar", use `Checkbox` |
| `Slider` | `textoDoValor` · `mostrarValor` |
| `Select` / `Combobox` | `opcoes` (`{valor, rotulo, sufixo?}`) · `valor` · `aoMudar`. Combobox filtra |

### Overlays

| Componente | Props que importam |
|---|---|
| `Dialog` (+`Title`/`Description`/`Footer`/`Close`) | `aberto` · `aoFechar` · `tamanho` · `fecharAoClicarFora` |
| `useDialog()` | devolve `propsDoGatilho` com `aria-expanded`/`aria-controls` prontos |
| `Drawer` (+`Header`/`Body`/`Footer`) | `lado` (direita·esquerda·baixo) |
| `Popover` | `gatilho` (elemento) · `lado` · `alinhamento`. **Não** é modal |
| `Tooltip` | `conteudo` · `lado`. ⚠️ nunca para informação essencial |
| `DropdownMenu` / `ContextMenu` | `itens: ItemDeMenu[]` (`{id, rotulo, aoEscolher, icone?, desabilitado?, destrutivo?, atalho?}`) |
| `ToastProvider` + `useToast()` | `.sucesso()` · `.erro()` · `.mostrar()`. Erro **não** expira |

### Layout e dados

| Componente | Props que importam |
|---|---|
| `Card` | `titulo`+`descricao`+`acoes` (vira `<section>` nomeada) **ou** composição com `CardHeader`/`CardTitle` |
| `Tabs` | `abas: Aba[]` · `paramUrl` (aba vive na URL) |
| `Accordion` | `secoes` · `multiplas` · `abertasPorPadrao` |
| `Table` | `legenda` (**obrigatória**) · `colunas` (com `ordenarPor`, `alinhamento`, `ocultarEmTelaEstreita`) · `selecionadas` · `primeiraColunaFixa` · `vazio` |
| `Badge` / `SeverityBadge` / `StatusBadge` | `tom` / `severidade`+`cvss` / `status` |
| `Progress` | `valor` · `rotulo` (**obrigatório**) · `textoDoValor` · `tom` (`automatico` pinta por faixa) |
| `Avatar` | `nome` · `src` · `tamanho` |
| `Breadcrumb` / `Pagination` / `ScrollArea` | `itens` / `pagina`+`totalPaginas` / `rotulo`+`orientacao` |
| `Skeleton` / `RegiaoCarregando` | forma do conteúdo final / `aria-busy` + texto anunciado |
| `EmptyState` / `ErrorState` | `titulo`+`descricao`+`acao` / `aoTentarNovamente` |
| `Alert` | `tom` · `titulo` · `aoFechar`. **Fica** na página (toast some) |
| `Separator` | `orientacao` · `decorativo` |

---

## 4. Contrato de acessibilidade

Cada componente interativo traz, no topo do arquivo, um bloco
`CONTRATO DE ACESSIBILIDADE` declarando **role e ARIA · teclado · foco · o que o
leitor de tela anuncia · alvo de toque**. Isso não é comentário decorativo: é a
especificação que `overlays.test.tsx` verifica item por item.

### O que é obrigatório em qualquer componente novo

| Exigência | Detalhe |
|---|---|
| **Elemento nativo** | `<button>`, `<input>`, `<table>`. Um `role` falso não participa de formulário, não recebe autofill e não funciona com os gestos próprios do leitor de tela |
| **`:focus-visible`, nunca `:focus`** | Pintar o anel no clique de mouse é o que leva times a removê-lo com `outline:none`, e aí quem usa teclado fica sem nada |
| **Foco em overlay** | entra ao abrir (respeitando `data-autofocus`), fica preso enquanto aberto, **volta ao gatilho** ao fechar |
| **`inert` no resto da árvore** | a armadilha de foco resolve o teclado; `inert` resolve a navegação por voz, em que a pessoa lê a página sem mover o foco |
| **Rótulo de ícone** | botão sem texto **exige** `rotulo` → `aria-label` |
| **Estado sem cor** | ícone, texto ou posição além da cor (WCAG 1.4.1) |
| **44×44 de alvo** | ou `.alvo-estendido` |
| **Live region preexistente** | `aria-live` num elemento criado junto com o conteúdo **não é anunciado**. A região tem que existir vazia antes |

### Estratégia de foco em listas — e por que

`Select`, `Combobox`, `DropdownMenu` e `ContextMenu` usam
**`aria-activedescendant`**, não roving tabindex: no Combobox, mover o foco real
para a opção tiraria o foco do campo e impediria continuar digitando.

`Tabs` e `ThemeToggle` usam **roving tabindex**: ali o foco real DEVE estar no
elemento, porque é ele que responde a Enter.

`Tabs` usa **ativação manual** (seta move, Enter ativa) porque cada aba do
dashboard dispara requisições — ativação automática dispararia quatro cargas ao
atravessar a barra com a seta.

### Contraste — medido, nunca estimado

`npm run check:contrast` converte OKLCH → sRGB, calcula WCAG 2.1 sobre a cor
**exibida** e falha abaixo do mínimo.

```
66 pares medidos · 0 falha(s) · 77 primitivos auditados · 0 fora do gamut sRGB
✓ Todos os pares atendem WCAG 2.1 AA nos dois temas.
```

| Par | dark | light | mínimo |
|---|---|---|---|
| Texto principal / superfície | 16,66:1 | 16,66:1 | 4,5 |
| Texto atenuado / superfície | 6,89:1 | 6,53:1 | 4,5 |
| Texto do botão primário | 5,78:1 | 5,78:1 | 4,5 |
| Link / superfície | 8,92:1 | 8,15:1 | 4,5 |
| Chip CRITICAL (texto/fundo) | 7,43:1 | 6,83:1 | 4,5 |
| Chip HIGH | 7,32:1 | 6,50:1 | 4,5 |
| Chip MEDIUM | 7,38:1 | 8,86:1 | 4,5 |
| Chip LOW | 7,50:1 | 6,44:1 | 4,5 |
| Chip INFO | 10,07:1 | 8,36:1 | 4,5 |
| Fatia CRITICAL (gráfico) | **3,91:1** | 5,84:1 | 3,0 |
| Borda de controle / superfície | 4,15:1 | 4,02:1 | 3,0 |
| Anel de foco / superfície | 6,33:1 | 5,78:1 | 3,0 |

O pior caso de texto é o **chip LOW no tema claro, 6,44:1** — 43% acima do
mínimo. O pior caso gráfico é a **fatia CRITICAL no tema escuro, 3,91:1**, e é
assim de propósito: vermelho saturado sobre fundo escuro não tem como subir mais
sem virar rosa.

⚠️ **Limitação:** a paridade foi provada em jsdom + `axe-core`, **não em leitor
de tela real**. NVDA e VoiceOver não foram testados.

---

## 5. Movimento

🎯 **Movimento serve à compreensão, nunca à decoração.** Cada animação responde
a uma pergunta: *de onde isso veio? o que mudou? o que está acontecendo?* Se não
responde a nenhuma, remova.

### `prefers-reduced-motion` — o que significa aqui

**Não** é "sem animação". É: sai o deslocamento, sai a escala, **fica a
opacidade**, e a duração encolhe. A pessoa continua vendo QUE algo mudou — só
não vê a coisa se mover, que é o que dispara desconforto vestibular.

Implementado como **hook central** (`useMotion()`), não caso a caso: quem consome
`variantesOverlay()` recebe a versão certa sem saber que existe uma errada.

**Exceção documentada:** spinner de carregamento continua girando (mais devagar,
em ritmo constante). Um spinner congelado comunica "travou", não "carregando" —
movimento reduzido pede menos movimento, não menos informação.

### Padrões

| Padrão | Regra | A armadilha que ele evita |
|---|---|---|
| **Lista escalonada** | 30ms por item, teto de 12 itens, **só na primeira montagem** | Reanimar a cada refetch faz o item pular sob o cursor quando o cache atualiza |
| **Overlay** | escala 0,96→1 + fade; entrada ~200ms, **saída ~140ms** | Saída lenta faz a interface parecer pesada: a pessoa já decidiu |
| **Número (KPI)** | spring, com `tabular-nums` | Sem tabular-nums a largura oscila enquanto conta |
| **Gráfico** | desenho progressivo **uma vez** (`useDesenhoInicial`) | O Recharts reanima a cada re-render: a linha se redesenha a cada tecla da busca |
| **Skeleton → conteúdo** | crossfade, espaço **reservado antes** | Sem reservar, o crossfade vira salto de layout |
| **Rota** | crossfade ~150ms, **sem deslocamento** | Deslocar a página enjoa na vigésima navegação |
| **Press** | `scale: 0.97`, em CSS puro | É a animação mais frequente da app; não vale JS por clique |
| **Toast** | spring + `layout` para empilhar | Sem `layout`, os toasts existentes pulam ao abrir espaço |

### Física

Spring para movimento **espacial** (posição, escala, layout): `stiffness`
200–400, `damping` 25–35. Duração + easing para **opacidade e cor**.

Por quê: duração fixa faz todo deslocamento levar o mesmo tempo independentemente
da distância — 4px parece lento, 400px parece teleporte. A spring resolve pela
física. E spring em opacidade produz overshoot invisível ao passar de 1,0.

⚠️ **Anime apenas `transform` e `opacity`** (propriedades compostas). Para
layout, use `layout` do `motion`, nunca `width`/`height` direto. A única exceção
é a altura do `Accordion`, que não tem alternativa — e por isso é medida e
interpolada pelo `motion`, não deixada para o CSS.

---

## 6. Como adicionar um tema

1. Novo bloco em `tokens.css`, com o mesmo conjunto de semânticos:
   ```css
   [data-theme="alto-contraste"] {
     color-scheme: dark;
     --color-bg-canvas: …;
     /* todos os semânticos — nenhum pode faltar */
   }
   ```
   Use `[data-theme="x"]` **sem** `:root` na frente: é o que permite temar uma
   subárvore (como a `/styleguide` faz para mostrar dois temas lado a lado).
2. Acrescente o valor a `TEMAS` em `src/design/theme.ts` **e ao script inline do
   `index.html`** — a duplicação é deliberada (o inline roda antes do React, para
   não haver flash) e o teste `TEMA-01` trava as duas versões juntas.
3. Adicione os pares a `scripts/check-contrast.mjs` e rode `npm run check:contrast`.
   **Um tema que não passa não entra.**
4. Confira em `/styleguide`.

---

## 7. Comandos

```bash
npm run check           # lint + contraste + testes
npm run check:contrast  # só a tabela WCAG (é a evidência para a banca)
npm run test            # vitest
npm run dev             # /styleguide fica em http://localhost:3000/styleguide
```

`/styleguide` só existe em desenvolvimento — a rota é registrada sob
`import.meta.env.DEV` e o Vite elimina o ramo no build de produção.

---

## 8. Para a Fase 7 (mobile) — o que portar e o que não

| Porta direto | Porta com adaptação | Não porta |
|---|---|---|
| Valores dos tokens (converta OKLCH→hex uma vez) | Elevação: tom no escuro, sombra no claro — no Android use `elevation` + tom | CSS, Tailwind, `_internal/` |
| Escalas: tipografia 1.200, espaçamento 4px, raios | Alvo de toque: 44px vira 48dp no Android (Material) | Overlays (RN tem `Modal` nativo) |
| Vocabulário: `-ink`/`-surface`, nomes por intenção | Fontes: Archivo e JetBrains Mono existem para RN via `expo-font` | `useAnchoredPosition` |
| Princípios de movimento e as durações | `prefers-reduced-motion` → `AccessibilityInfo.isReduceMotionEnabled()` | `focus-visible` (não há mouse) |
| Contrato de acessibilidade (a INTENÇÃO) | ARIA → `accessibilityRole`/`accessibilityState`/`accessibilityLabel` | `inert`, `aria-activedescendant` |

**A regra que mais importa levar:** componente usa só token semântico. É o que
faz o mobile herdar o tema em vez de reinventá-lo.
