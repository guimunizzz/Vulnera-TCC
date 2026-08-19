---
type: decisao
tags: [decision, frontend, design-system, landing, three.js]
status: vigente
codigo: ADR-026
data: 2026-08-19
---

# ADR-026 - Landing pública "cyber-samurai" e paleta exclusiva da superfície de marketing

> [!info] Executa a task 8.12 do `docs/BACKLOG.md`
> `fix/landing-publica` (2026-08-18) deixou a landing como placeholder mínimo
> — reaproveitando tokens/componentes do produto — e registrou a cena
> Three.js completa como item novo (8.12, 8h), com a exigência explícita de
> um `useHeroScene` com `dispose()`/`cancelAnimationFrame`/descarte de render
> targets no unmount. Esta ADR é a decisão de arquitetura para essa task.

## Contexto

`docs/DESIGN_SYSTEM.md` estabelece "Instrumento, não painel de marketing"
como direção estética do PRODUTO (dashboards, findings, relatórios): fundo
slate-azulado (nunca preto puro), um único acento violeta reservado à AÇÃO,
severidade com vocabulário fixo, e a **regra inviolável** de que componente
usa só token SEMÂNTICO — imposta em build pelo `tailwind.config.ts`, que não
expõe primitivo nenhum.

A landing pública (`/`, fora do `ProtectedRoute`) não é o instrumento — é a
primeira tela de quem ainda não é usuário, o material de apresentação da
banca (comentário em `App.tsx`). O briefing da task pede uma identidade
própria e mais expressiva: fundo "obsidian purple" quase preto, textura ASCII
processual, aberração cromática, scanlines, partículas e glitch — deliberadamente
mais próxima de Awwwards do que de Linear/Datadog.

Duas perguntas de arquitetura, então: (1) essa identidade convive com o
sistema de temas claro/escuro do produto? (2) essas cores entram em
`tokens.css`, violando a regra do §1?

## Decisão

### 1. A landing força `data-theme="dark"` numa subárvore — não ganha tema claro

`tokens.css` já documenta que `[data-theme="x"]` **sem** `:root` na frente
tema uma subárvore, e é assim que `/styleguide` mostra os dois temas lado a
lado. A raiz de `landing-page.tsx` usa o mesmo mecanismo:
`<div data-theme="dark">`. Os componentes reaproveitados do produto (`Button`,
`LinkButton`, `Card`, `SeverityBadge`) continuam lendo semântico normalmente e
resolvem sempre para o escuro, **independente da preferência salva** de quem
visita — uma landing com scroll de 30 segundos não é a superfície em que
"trabalhar horas seguidas" (a razão de existir do tema claro) se aplica.

**Alternativa descartada:** dar à landing os dois temas. Custaria calibrar
severidade/glitch/ASCII contra fundo claro para uma tela que ninguém usa por
mais que alguns segundos — o mesmo argumento que o ADR-024 usou a favor do
tema claro no produto (uso prolongado) argumenta CONTRA aqui.

### 2. Paleta cyber fica FORA de `tokens.css`, num módulo hex dedicado

`app/web/src/components/landing/landing-palette.ts` guarda os hex do "void"
(`#05010B`→`#0D041A`, ancorados perceptualmente perto do `--iris-950`
existente, `#1f0a45`) e dos canais de glitch (split cyan/magenta). Precedente
direto: `src/lib/severity-colors.ts` já existe exatamente por isso — Recharts
e `pdf-lib` pintam via canvas/SVG e exigem hex cru, então esse arquivo é
"fonte única pra não duplicar (e divergir) o mesmo valor em três lugares".
Three.js (`WebGLRenderer`, shaders GLSL) tem a mesma exigência: um `uniform
vec3` não lê `oklch(var(--x))`.

Manter esse hex FORA de `tokens.css` — em vez de virar primitivo novo — é
deliberado:
- a regra inviolável do §1 é sobre **componentes do produto** consumindo
  primitivo via classe Tailwind; um módulo de paleta consumido só por
  `components/landing/*` não viola isso, do mesmo jeito que
  `severity-colors.ts` não viola;
- `scripts/check-contrast.mjs` varre `tokens.css` par a par — um "void" que
  não é par de texto/fundo do produto não pertence àquela varredura, e
  colocá-lo lá obrigaria decidir o que fazer com ele no script sem necessidade;
- a paleta cyber é decoração de UMA tela, não vocabulário do design system.
  Se um dia outra tela precisar dela, é o sinal para promovê-la a token —
  não antes.

### 3. Three.js vanilla + `examples/jsm/postprocessing`, sem dependência nova além de `three`

`EffectComposer`/`RenderPass`/`ShaderPass` vêm dentro do pacote `three`
(`three/examples/jsm/postprocessing/*`) — não exige `@react-three/fiber` nem
`postprocessing` do npm. Menos superfície de dependência, e o hook
`useHeroScene` pedido pelo backlog já é a abstração que o R3F existiria para
dar; escrevê-la à mão é código que a banca lê e entende sem uma segunda
biblioteca no meio.

O efeito ASCII é procedural: um atlas de glifos é desenhado em runtime num
`<canvas>` 2D offscreen usando **JetBrains Mono** (a mesma fonte de dado do
design system, já carregada via `@fontsource-variable`) e essa textura
alimenta o `ShaderPass` que faz threshold de luminância por célula — sem
depender de imagem estática nem de fonte extra.

### 4. Contrato de degradação — o mesmo em produção e em teste

`useHeroScene` só cria o `WebGLRenderer` se `"WebGL2RenderingContext" in
window` (feature-detect que NÃO toca o canvas — chamar `getContext("webgl2")`
aqui e de novo dentro do `WebGLRenderer`, com atributos diferentes, faria o
segundo pedido ser ignorado pela spec do Canvas, silenciosamente anulando
`antialias:false`/`alpha:false`) **e** `prefers-reduced-motion` não pedir
menos movimento. Quando qualquer um falha,
a cena não monta — o `<CyberCanvas>` mostra só o gradiente CSS estático (que
usa a MESMA paleta de `landing-palette.ts`, aplicada via `style={{}}` inline,
o mesmo mecanismo que `Separator`/`Skeleton` já usam para cor fora do
Tailwind). Isso cobre três casos com um único caminho de código:

- visitante com `prefers-reduced-motion: reduce`;
- navegador/GPU sem WebGL2;
- **jsdom nos testes** — não implementa contexto WebGL, então
  `landing-page.test.tsx` exercita o fallback real, não um mock.

`document.hidden` pausa o `requestAnimationFrame` (retoma no
`visibilitychange`); o `useEffect` de limpeza chama `dispose()` em
geometrias/materiais/render targets do composer e `cancelAnimationFrame` —
exatamente a exigência registrada em `docs/BACKLOG.md` 8.12, para não vazar
contexto WebGL a cada navegação landing↔dashboard.

## Consequências

- `tokens.css` e `tailwind.config.ts` não mudam — zero risco de regressão no
  produto ou em `check:contrast`.
- Nova dependência de produção: `three` (+ `@types/three` em dev). Sem
  `@react-three/fiber`, `postprocessing` nem assets de imagem externos.
- A landing tem uma segunda paleta para manter sincronizada manualmente
  (`landing-palette.ts`), mas o raio de mudança é um arquivo, e o precedente
  (`severity-colors.ts`) já provou que isso não vira fonte de divergência
  silenciosa neste projeto — os dois arquivos ficam lado a lado com o mesmo
  formato de comentário.
- Qualquer navegador/dispositivo sem WebGL2 (ou com `prefers-reduced-motion`)
  vê uma landing perfeitamente funcional e ainda "no espírito" — só sem a
  cena 3D. Não há tela quebrada, nem uma segunda versão de copy a manter.

## Atualização (2026-08-19, mesma sessão) — achados da validação em navegador real

`jsdom` nunca executa WebGL de verdade, então nenhum teste automatizado
exercitava a cena depois de montada. Rodando de verdade num Chromium real
(Playwright ad-hoc, já que a extensão do Chrome não conectou) contra
`vite build` + `vite preview`, apareceram três bugs que a leitura de código e
os testes não pegaram:

1. **Contexto perdido sem lançar exceção.** `new THREE.WebGLRenderer()` podia
   retornar normalmente mesmo com o contexto já morto (visto em modo dev com
   StrictMode montando duas vezes + software rendering degenerado) — o
   `<canvas>` ficava opaco e QUEBRADO (branco) por cima do fallback, pior do
   que nunca ter montado. Corrigido com `renderer.getContext().isContextLost()`
   explícito logo após a criação (cai no mesmo `catch` de qualquer outra
   falha de montagem) e um listener `webglcontextlost` contínuo — novo
   parâmetro `onLost` em `useHeroScene`, que devolve `cyber-canvas.tsx` pro
   fallback se o contexto morrer no meio da sessão.
2. **Escala de `gl_PointSize` errada.** O fator `200.0` (com `aSize` e a
   distância da câmera usadas) dava 240-560px de ponto ANTES do clamp de
   `ALIASED_POINT_SIZE_RANGE` — em GPU real viraria blob enorme; em software
   rendering simplesmente sumia. Ajustado pra `28.0`, com `aSize` também
   reduzido — confirmado visualmente como faísca/pétala pequena, não mancha.
3. **O mais sério: `ShaderPass` clona o objeto de uniforms.** Passar
   `{uniforms: asciiUniforms, vertexShader, fragmentShader}` (um descritor
   plano) faz o `ShaderPass` copiar o VALOR inicial dos uniforms pra um objeto
   novo — não guardar a referência. Todo update por frame
   (`asciiUniforms.uTime.value = ...`, `uResolution`, `uGlitchAmount`...)
   estava escrevendo num objeto que o material renderizado nunca lia.
   `uResolution` ficava congelado no default `(1,1)`: a grade de células do
   passe ASCII colapsava pra UM texel só, fora do range `[0,1]` (clampado na
   borda pela textura), e a tela inteira virava uma cor sólida. **O efeito
   ASCII nunca tinha de fato rodado em nenhuma verificação anterior desta
   sessão** — só passava despercebido porque a cor resultante era próxima do
   void, então "parecia" só um fundo escuro plano em vez de claramente
   quebrado. Corrigido construindo `new THREE.ShaderMaterial({uniforms:
   asciiUniforms, ...})` explicitamente e passando a INSTÂNCIA pro
   `ShaderPass` (esse branch do construtor usa a referência direto, sem
   clonar).

Achado colateral: um comentário com crase (`` ` ``) dentro do próprio
template literal do GLSL fechava a string JS mais cedo e quebrava `vite
build` inteiro — `esbuild` (usado pelo `vite build`) não faz type-check, só
`tsc --noEmit` capturaria; reforça por que os dois rodam separados no
`npm run check`.

**Lição pro próximo componente com shader:** revisão de código e testes em
`jsdom` provam que o TypeScript compila e que o componente não lança — não
provam que o shader está desenhando o que deveria. Qualquer mudança futura em
`shaders.ts`/`use-hero-scene.ts` pede pelo menos um `vite build` +
`vite preview` + screenshot real antes de considerar pronta.

## Relacionado
[[ADR-024 - Sistema de temas com tokens OKLCH]]
[[ADR-023 - Biblioteca de componentes propria em vez de Radix]]
