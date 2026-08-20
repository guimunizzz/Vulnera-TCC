---
type: decisao
tags: [decision, mobile, monorepo, npm, react]
status: vigente
codigo: ADR-027
data: 2026-08-20
---

# ADR-027 - Mobile fora do workspace npm da raiz

## Contexto

`app/mobile` (Expo, React fixado pela SDK) e `app/web` (React `^18.3.1`) sempre exigiram versões majors diferentes de `react`. Desde a Fase 7, os três apps (`api`, `mobile`, `web`) viviam no mesmo array `workspaces` do `package.json` raiz, e isso "funcionava" só porque o algoritmo de hoisting do npm por acaso hospedava o `react` 18.x do web na raiz e aninhava o 19.x do mobile só dentro de `app/mobile/node_modules` — arranjo correto, mas nunca garantido por nenhuma configuração explícita.

Rafael pediu downgrade do mobile de Expo SDK 57 para SDK 54 (celular físico só reconhece SDK 54 no Expo Go instalado). O downgrade em si (`npx expo install --fix`) foi direto, mas cada `npm install` subsequente na raiz — necessário porque o conflito de peer dependencies do `expo-router@6` (RSC opcional pedindo `react@^19.2.8`) só resolvia com `--legacy-peer-deps` — fez o hoisting virar: a raiz passou a hospedar o `react` 19.x do mobile, e o `react-router-dom` do web (hoisted, peer de `react` frouxo, `>=16.8`) passou a resolver contra a versão errada. Resultado: `tsc` do `app/web` quebrado (`ReactNode`/`bigint` incompatível entre React 18 e 19) e risco real de **duas cópias de React no mesmo bundle do Vite** em runtime (não só erro de tipo).

Tentativas de correção, todas sem sucesso:
- **`npm overrides`** (`react-router-dom`→`react` fixo, depois `@vulnera/mobile`→`react` fixo): mecanismo padrão do npm pra isso, mas **não teve nenhum efeito neste ambiente** — nem aparece no `package-lock.json` mesmo após reinstall limpo com log verboso. Sem explicação encontrada; documentado como armadilha conhecida deste projeto.
- **Reordenar o array `workspaces`** (hipótese: ordem influencia qual workspace "ganha" o slot de hoisting): sem efeito.
- **`npm dedupe` / `--force` / reinstall limpo repetido**: sempre voltava a hospedar o `react` do mobile na raiz.

## Decisão

**`app/mobile` sai do array `workspaces` do `package.json` raiz.** Passa a ter `node_modules` e `package-lock.json` próprios, instalados separadamente (`cd app/mobile && npm install`) — que é exatamente o que o `README.md` já documentava (`cd ../mobile && npm install`, ver linha ~176) antes mesmo desta decisão. A raiz volta a hospedar só `app/api` + `app/web`, cada um com uma única versão de React em jogo.

Efeito colateral positivo: o `npm install` na raiz não precisa mais de `--legacy-peer-deps` (esse flag só existia por causa do peer conflito opcional do `expo-router@6`, que agora fica isolado dentro de `app/mobile`).

## Consequências

- `npm install` na raiz cobre só `api`+`web`. `app/mobile` precisa do próprio `npm install` (já era o fluxo documentado no README).
- Nenhum script/CI referenciava `--workspace=app/mobile` (confirmado por busca no repo) — nada quebrou.
- `expo-doctor` no mobile ainda acusa "duplicate react" (19.1.0 aninhado vs 18.3.1 na raiz, agora de workspaces desacoplados) — é **falso positivo**: a resolução de módulos do Node sempre acha a cópia aninhada primeiro, o build do Metro nunca toca a cópia da raiz. Mesmo aviso que já existia (documentado) antes desta sessão, com os números trocados.
- Efeito colateral corrigido durante a mesma sessão: `expo-status-bar@3.0.9` (SDK 54) não expõe *config plugin* nenhum (`main` aponta pro `.ts` fonte, sem build compilado) — listá-lo em `app.json > plugins` quebrava `expo config`/`expo-doctor` com `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (Node recusa fazer strip de tipos dentro de `node_modules`). Removido de `plugins`; o componente `<StatusBar/>` continua funcionando normalmente via import direto em `app/_layout.tsx` — ele nunca precisou estar ali.

## Alternativa descartada

**Forçar `resolve.dedupe: ['react', 'react-dom']` no `vite.config.ts` do web.** Resolveria o conflito fazendo o Vite sempre usar uma única cópia — mas essa cópia seria a hospedada na raiz (React 19.x do mobile), rodando o `app/web` de fato sob uma versão de React diferente da declarada (`^18.3.1`), silenciosamente. Descartada por mudar comportamento de runtime não testado só pra contornar um problema de tooling.

## Relacionado
[[ADR-009 - Pastas no plural e cadeia de camadas]]
