<!-- SBOM do próprio Vulnera: o que foi inventariado, como foi gerado, como regenerar, o que ele mostra (vulnerabilidades e licenças) e os limites; consumido pelo time, pela banca e por quem for manter a cadeia de suprimentos do projeto. -->

# SBOM — a lista de materiais do próprio Vulnera

> **Evidências:** [`docs/evidencias/sbom/`](evidencias/sbom/README.md) ·
> **Gerado em:** 2026-11-27, sobre a `dev` em `54c6f36` ·
> **Branch:** `docs/sbom`

Um SBOM (*Software Bill of Materials*) é o inventário de tudo o que entra num
software: cada biblioteca, com versão, origem (`purl`) e licença. O Vulnera já
**consome** SBOMs dos clientes: importa CycloneDX no SAST/SCA
([`SAST_SCA.md`](SAST_SCA.md)) e transforma os componentes em sugestões de
inventário no Threat Intel ([`THREAT_INTEL.md`](THREAT_INTEL.md)). Este
documento trata do outro lado, o **SBOM do próprio Vulnera**: o que o projeto
carrega, quais vulnerabilidades conhecidas isso traz e como refazer o inventário.

## O que foi inventariado

Três SBOMs em **CycloneDX 1.7**, um por artefato entregue:

| Arquivo | Alvo | Como | Componentes | Achados (parser do Vulnera) |
|---|---|---|---|---|
| [`vulnera-api.cdx.json`](evidencias/sbom/vulnera-api.cdx.json) | imagem Docker `vulnera-tcc-api` | `trivy image` | 947 | 52 (7 críticos, 19 altos, 26 médios) |
| [`vulnera-web.cdx.json`](evidencias/sbom/vulnera-web.cdx.json) | imagem Docker `vulnera-tcc-web` | `trivy image` | 626 | 108 (7 críticos, 75 altos, 26 médios) |
| [`vulnera-mobile.cdx.json`](evidencias/sbom/vulnera-mobile.cdx.json) | `app/mobile/package-lock.json` | `trivy fs` | 598 | 35 (2 críticos, 19 altos, 12 médios, 2 baixos) |

"Achados" são os números que o próprio Vulnera mostraria ao importar cada
arquivo: a contagem saiu de `parseCodeReport` (`app/api/src/utils/code-import.util.ts`),
que agrupa repetições e usa a **maior** severidade entre as notas de cada CVE
(ver [Validação](#validação)).

Fora do inventário: as imagens de terceiros do `docker-compose.yml` (MySQL,
Redis, MailHog), que o projeto usa mas não constrói.

## Como foi gerado (e por quê)

### API e web: a imagem, não o lockfile

Os Dockerfiles de `app/api` e `app/web` copiam só o `package.json` e rodam
`npm install` **sem lockfile**. O `package-lock.json` da raiz (workspaces
`app/api` + `app/web`) está no `.gitignore`. Na prática, cada build resolve as
versões de novo, e nenhum lockfile do repositório descreve o que roda. O
inventário fiel é o da **imagem construída**: ela traz o `node_modules` que foi
de fato instalado, os pacotes do Alpine e o npm embutido na imagem base.

> [!NOTE]
> O SBOM anterior do Vulnera (2026-11-15, fixture
> `app/api/prisma/seeds/cenarios/fixtures/vulnera-trivy.cdx.json`, 391
> componentes e 47 vulnerabilidades) foi tirado do `package-lock.json` local.
> No dia desta geração esse lock estava **dessincronizado** do `package.json`
> (`npm ls` acusava `nodemailer` e `@types/nodemailer` faltando). Os números
> dos dois não são comparáveis: muda o método, muda o alvo e muda a base de
> vulnerabilidades.

### Mobile: o lockfile versionado

`app/mobile/package-lock.json` é versionado (última alteração em `7ec9e0f`,
2026-10-30) e o app não tem imagem Docker. Aqui o lockfile **é** a fonte certa.

### As fixtures do seed ficam de fora

A imagem da API leva `app/api/prisma/` inteira, inclusive
`prisma/seeds/cenarios/fixtures/*.cdx.json` (SBOMs de demonstração). O Trivy
reconhece arquivos CycloneDX dentro da imagem e **incorpora os componentes
deles**. Na primeira geração, 390 dos 1.338 componentes e 48 dos 100 achados da
API vinham da fixture antiga, e não de dependências reais (por exemplo,
`undici@7.29.1`, quando a imagem tem `7.30.2`). Por isso a API é escaneada com
`--skip-dirs app/prisma/seeds`. A mesma armadilha vale para qualquer imagem
futura que carregue um `.cdx.json` ou `.spdx.json`.

### Ferramenta e base

| Item | Valor |
|---|---|
| Scanner | Trivy **0.76.2**, imagem oficial fixada por digest `aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb` (mesma versão do SBOM de 15/11 e das evidências SAST/SCA) |
| Base de vulnerabilidades | trivy-db v2, atualizada em 2026-11-27 07:06 UTC |
| Scanners ligados | só `vuln`. O de segredos fica desligado: ele leria arquivos como `.env` e não faz parte de um SBOM |
| Dependências de desenvolvimento | entram nas imagens, porque o `npm install` dos Dockerfiles instala tudo (Vite, ESLint, `@typescript-eslint`). No mobile, o Trivy deixa de fora o que o lockfile marca como `dev: true` (o ESLint, por exemplo) e mantém o que vem como `devOptional` (o TypeScript) |

## Como regenerar

Pré-requisito: a stack construída (`docker compose up -d --build`). Os comandos
abaixo são para Git Bash. No Windows, `MSYS_NO_PATHCONV=1` evita que o Git Bash
reescreva os caminhos `/out` e `/src` do container.

```bash
export MSYS_NO_PATHCONV=1
TRIVY="aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb"
OUT="$(pwd -W)/docs/evidencias/sbom"   # em Linux/macOS: $(pwd)/docs/evidencias/sbom

# API — sem as fixtures do seed
docker run --rm -v //var/run/docker.sock:/var/run/docker.sock -v vulnera-trivy-cache:/root/.cache/ \
  -v "$OUT:/out" $TRIVY image --quiet --scanners vuln --skip-dirs app/prisma/seeds \
  --format cyclonedx --output /out/vulnera-api.cdx.json vulnera-tcc-api

# Web
docker run --rm -v //var/run/docker.sock:/var/run/docker.sock -v vulnera-trivy-cache:/root/.cache/ \
  -v "$OUT:/out" $TRIVY image --quiet --scanners vuln \
  --format cyclonedx --output /out/vulnera-web.cdx.json vulnera-tcc-web

# Mobile — o lockfile, montado só leitura
docker run --rm -v vulnera-trivy-cache:/root/.cache/ -v "$(pwd -W)/app/mobile:/src/app/mobile:ro" \
  -v "$OUT:/out" $TRIVY fs --quiet --scanners vuln --skip-dirs /src/app/mobile/node_modules \
  --format cyclonedx --output /out/vulnera-mobile.cdx.json /src/app/mobile
```

O volume `vulnera-trivy-cache` guarda a base de vulnerabilidades entre
execuções. Para ver a data da base usada: `docker run --rm -v
vulnera-trivy-cache:/root/.cache/ $TRIVY --version`.

Depois de regenerar, atualize as tabelas deste documento e os hashes em
[`evidencias/sbom/README.md`](evidencias/sbom/README.md). Um SBOM é uma foto
datada: a lista de componentes só muda com o código, mas a de vulnerabilidades
muda todo dia, junto com a base.

## O que o SBOM mostra (2026-11-27)

### Por origem

Nem todo achado é dependência do código do Vulnera. Separando pelo caminho de
cada componente na imagem:

| Artefato | Origem | Críticos | Altos | Médios | Baixos | Total |
|---|---|---|---|---|---|---|
| API | Pacotes do Alpine (`apk`) | 7 | 14 | 25 | – | 46 |
| API | Dependências da aplicação (`/app/node_modules`) | – | 4 | – | – | 4 |
| API | npm embutido na imagem (`/usr/local/lib/node_modules/npm`) | – | 1 | 1 | – | 2 |
| Web | Binário Go do esbuild (`@esbuild/linux-x64`) | 6 | 70 | 7 | – | 83 |
| Web | Dependências da aplicação | – | 4 | 8 | – | 12 |
| Web | Pacotes do Alpine | 1 | – | 10 | – | 11 |
| Web | npm embutido na imagem | – | 1 | 1 | – | 2 |
| Mobile | Dependências da aplicação | 2 | 19 | 12 | 2 | 35 |

Todos os achados de API e web têm versão corrigida publicada. No mobile, só um
ainda não tem (`CVE-2026-85393`, no `node-forge`).

### Pacotes afetados

| Artefato | Pacote | Versão | Corrigido em | Maior severidade | CVEs | De onde vem |
|---|---|---|---|---|---|---|
| API | `docker-cli` | 29.8.2-r1 | 29.9.3-r0 | Crítica | 16 | `apk add` do Dockerfile (o DAST fala com o Docker) |
| API | `python3`, `python3-pyc`, `pyc`, `python3-pycache-pyc0` | 3.14.8-r0 | 3.14.10-r0 | Crítica | 3 cada | `apk add python3 make g++` (compilar dependências nativas) |
| API | `libexpat` | 2.9.0-r0 | 2.11.0-r0 | Alta | 7 | dependência do `python3` |
| API e web | `zlib` | 1.3.2-r1 | 1.4-r0 | Crítica | 1 | base `node:22-alpine` |
| API e web | `libcrypto3`, `libssl3` | 3.5.9-r0 | 3.5.9-r1 | Média | 5 cada | base `node:22-alpine` |
| API | `effect`, `deepmerge-ts` | 3.21.0, 7.1.5 | 3.22.1, 8.0.0 | Alta | 1 cada | `prisma` → `@prisma/config` |
| API | `uuid` | 8.3.2 | 11.1.1 | Alta | 1 | `exceljs` |
| API e web | `minimatch` | 9.0.9 | 11.0.1 | Alta | 1 | `@typescript-eslint/parser` (lint, devDependency instalada na imagem) |
| Web | `stdlib` (Go) | v1.20.12 | Go 1.27.4 (na prática, um `esbuild` novo) | Crítica | 82 | binário do `esbuild@0.21.5`, compilado com Go 1.20 |
| Web | `golang.org/x/sys` | v0.0.0-2022… | 0.44.0 | Média | 1 | mesmo binário do `esbuild` |
| Web | `vite` | 5.4.21 | 6.4.4, 7.3.7 ou 8.1.6 (nenhuma na série 5) | Alta | 8 | devDependency direta; o container serve com `vite preview` |
| Web | `react-router` | 6.30.6 | 7.18.0 | Média | 2 | `react-router-dom` (dependência direta) |
| Web | `esbuild` | 0.21.5 | 0.25.0 | Média | 1 | `vite` 5 |
| API e web | `minimatch@10.2.5`, `glob@13.0.6` | – | 11.0.1, 14.0.2 | Alta / Média | 1 cada | npm embutido na imagem (`npm install -g npm@11`) |
| Mobile | `shell-quote` | 1.10.0 | 1.11.0 | Crítica | 1 | `react-native` → `react-devtools-core` |
| Mobile | `source-map-js` | 1.2.1 | 1.2.2 | Crítica | 1 | `expo` → `metro-config` → `postcss` |
| Mobile | `node-forge` | 1.4.0 | 1.4.3 corrige 20; `CVE-2026-85393` sem correção | Alta | 21 | `expo` → `@expo/cli` |
| Mobile | `brace-expansion`, `follow-redirects`, `decode-uri-component`, `minimatch`, `uuid@7.0.3`, `compression` | – | 5.0.12, 1.16.2, 0.5.1, 11.0.1, 11.1.1, 1.8.2 | Alta | 1 a 3 | transitivas do `expo`, `axios` e `expo-router` |

A coluna "Corrigido em" mostra a menor versão que corrige **todas** as CVEs
daquele pacote, segundo o Trivy. Quando há correção em mais de uma série, todas
aparecem. A exceção é o `stdlib` do Go: as CVEs antigas só listam as séries que
existiam na época, então a coluna mostra uma versão atual que cobre todas
(1.27.4), e não a menor possível. O detalhe por CVE está nos arquivos, no campo
`recommendation`.

### O que isso diz sobre a cadeia de suprimentos

- **A maior parte do risco da API vem da imagem, não do código.** 46 dos 52
  achados são pacotes do Alpine, e boa parte deles (`python3`, `libexpat`) é
  ferramenta de compilação que só serve durante o build. O Dockerfile tem um
  estágio só, então `python3`, `make` e `g++` vão para a imagem final.
- **No web, 83 dos 108 achados são de um único binário.** O `esbuild` 0.21.5
  (puxado pelo `vite` 5) vem compilado com Go 1.20.12. Quem o executa é o Vite
  (no build e ao carregar o `vite.config.ts`), mas o binário está na imagem que
  vai para produção.
- **O web roda uma ferramenta de desenvolvimento em produção.** O container
  serve com `npx vite preview` (ADR-022), então o `vite` 5.4.21 e as 8 CVEs
  dele fazem parte do servidor, e não só do build.
- **Ferramentas de lint e build vão para as imagens.** Como o `npm install`
  instala também as devDependencies, ESLint e `@typescript-eslint` estão nas
  duas imagens (é de lá que vem o `minimatch@9.0.9`).
- **Builds sem lockfile não se repetem.** A mesma tag pode gerar SBOMs
  diferentes em dias diferentes. Isso enfraquece o próprio SBOM como evidência
  do que foi entregue.

Essas observações estão no [backlog](BACKLOG.md) como `SBOM-FUT-*`. Corrigir
qualquer uma delas está fora do escopo desta documentação.

### Licenças

| Artefato | Licenças mais comuns | Sem licença declarada | Copyleft nas dependências da aplicação |
|---|---|---|---|
| API | MIT 682 · ISC 120 · Apache-2.0 35 · BSD-3 24 · BSD-2 20 | 7 | `jszip` (MIT **ou** GPL-3.0-or-later) |
| Web | MIT 405 · ISC 115 · Apache-2.0 25 · BSD-2 17 · BlueOak-1.0.0 14 | 5 | nenhuma |
| Mobile | MIT 508 · ISC 25 · Apache-2.0 12 · MPL-2.0 12 · BSD-2 11 | 0 | `node-forge` (BSD-3-Clause **ou** GPL-2.0-only) |

Os dois casos de copyleft têm licença dupla, e a opção permissiva vale. Os 13
componentes GPL-2.0-or-later da API são pacotes do Alpine (toolchain), não
bibliotecas do código. Este levantamento não substitui uma revisão jurídica.

## Importar no próprio Vulnera

Os três arquivos são CycloneDX com a seção `vulnerabilities`, dentro dos limites
da importação (10 MB, 5.000 achados). Dá para importar cada um num projeto pelo
fluxo normal do SAST/SCA ([`SAST_SCA.md`](SAST_SCA.md#como-usar)). Os
componentes viram sugestões de inventário no Threat Intel, como na evidência de
15/11 ([`evidencias/threat-intel/`](evidencias/threat-intel/README.md)).

Na importação, a API e o web mostram o aviso de que há vulnerabilidades sem
`ratings`: o Trivy não tem nota para algumas CVEs recentes, e elas entram como
MÉDIA até a triagem (comportamento documentado no SAST/SCA).

## Segurança

- **Sem segredos no SBOM.** Só o scanner `vuln` roda. Nos três arquivos não há
  variáveis de ambiente da imagem, caminhos da máquina local nem credenciais.
- **O que é público por natureza.** O SBOM da API traz o campo `supplier` dos
  pacotes do Alpine, com nome e e-mail do mantenedor do pacote no índice
  público do Alpine. É metadado padrão do pacote, não dado do projeto.
- **O que ele revela.** Um SBOM publicado mostra a um atacante exatamente quais
  versões vulneráveis existem. Ele é versionado aqui porque o repositório é do
  TCC e as vulnerabilidades são de bibliotecas públicas. Num produto real, ele
  iria para um artefato com acesso controlado.

## Validação

- **Parser do Vulnera.** Os três arquivos passaram por `parseCodeReport` (o
  mesmo código da importação), sem erro. As contagens de achados e componentes
  das tabelas saíram dele. A divisão por origem foi conferida contra os totais
  do parser (52, 108 e 35).
- **Fixtures do seed.** Conferido que nenhum componente da API sai mais da
  camada do `COPY prisma` (antes eram 390).
- **Versões reais.** Dentro do container da API, o `package-lock.json` gerado
  no build e o `node_modules` têm `undici@7.30.2` e `proxy-addr@2.0.8`, as
  mesmas versões do SBOM. ESLint e `@typescript-eslint/parser` estão no disco
  das duas imagens, e o `vite@5.4.21` no disco do web.
- **Código das imagens.** As imagens foram construídas em 2026-11-27 a partir
  de código idêntico ao da `dev` em `54c6f36`
  (`git diff 16b3da5 54c6f36 -- app/api app/mobile` e
  `git diff db0eeed 54c6f36 -- app/web` vazios).
- **Não validado:** a importação pela interface. Os arquivos não foram
  importados num projeto do banco de desenvolvimento, para não misturar o SBOM
  do Vulnera com os dados da demonstração.

## Correções aplicadas (2026-11-27, branch `fix/sbom-criticas-altas`, em andamento)

> [!IMPORTANT]
> Os arquivos em `docs/evidencias/sbom/` e as tabelas acima continuam sendo o
> retrato **antes** das correções. Regenerar os três SBOMs e atualizar este
> documento quando a branch for concluída.

| Frente | O que mudou | Validação |
|---|---|---|
| Alpine (API e web) | `apk upgrade --no-cache` nos dois Dockerfiles; build com a base `node:22-alpine` nova | Imagem da API: Alpine 3.24.4, `docker-cli` 29.9.3, `python3` 3.14.10, `zlib` 1.4, `libssl3`/`libcrypto3` 3.5.9-r1, `libexpat` 2.11.0 |
| Web | `vite` 5.4.21 → **6.4.6** (`esbuild` 0.21.5 → 0.25.12). O Vite 6 grava o config compilado em `node_modules/.vite-temp/`: o Dockerfile passou a dar `chown` nessa pasta (sem isso o container caía com `EACCES` como usuário `vulnera`) | `tsc`, lint (0 erros, 9 avisos de antes), contraste, `vite build` OK. Vitest 860/865 com Vite 6 e **também 860/865 com Vite 5** (instabilidade sob carga já existente: os testes que falham mudam a cada rodada e passam isolados). Container: 200, CSP presente, LP e login sem erro de console |
| API | `overrides` `effect` 3.22.1 e `deepmerge-ts` 8.0.0 (o `prisma` 6.19.3, última 6.x, fixa as vulneráveis), na raiz e em `app/api` | `prisma generate`/`validate`, build, Jest unitário 34/34 suítes e 456/456 testes; lint com os 4 erros já registrados em 26/11. Container saudável, 24 migrações conferidas, login, listagem e `export.xlsx` (XLSX válido) |
| API | `overrides` `exceljs` → `uuid` 11.1.1 (o `exceljs` 4.4.0, última, pede `uuid` ^8; usa só `require('uuid').v4`, que o `uuid` 11 mantém em CommonJS) | **Só instalação conferida** (`npm ls`). Falta a prova funcional (planilha com formatação condicional `dataBar`, único ponto que chama `uuidv4`) e rebuild da imagem |
| Mobile | `npm update` no lockfile (`shell-quote` 1.12.0, `source-map-js` 1.2.4, `node-forge` 1.4.4, `brace-expansion` 5.1.0, `follow-redirects` 1.16.3, `compression` 1.8.2) e `overrides` com escopo: `xcode` → `uuid` 11.1.1; `@expo/fingerprint` e `glob@13` → `minimatch` 11.0.1 | `npm ci` limpo, `npm ls` sem erro, lint OK, `expo export` web e android OK. Typecheck falha só em `app/mobile/output/**` (cópias de páginas do web versionadas ali), **igual na versão anterior** — pré-existente |

Reescaneamento parcial (antes do override do `uuid`), críticas + altas pela
regra do parser do Vulnera: API **26 → 3**, web **82 → 60**, mobile **21 → 2**.

O que ainda falta:

- **Web, 60 achados no binário do `esbuild` 0.25.12**, compilado com Go
  1.23.12. Caminho: um `esbuild` compilado com Go ≥ 1.27.4 via override com
  escopo no `vite` (sem afetar o `esbuild` do `tsx`). Não iniciado de fato.
- **`minimatch@9.0.9`** (API e web): vem do `@typescript-eslint` 7.18 (lint).
  A 8.74 usa `minimatch ^11.0.1` e aceita o ESLint 8.57; falta subir e
  ajustar a config de lint. Não iniciado de fato.
- **Aceito, sem correção possível agora:** `minimatch@10.2.5` e `glob@13.0.6`
  embutidos no próprio npm das imagens (npm 11 e 12 trazem as mesmas
  versões; tirar o npm quebra o `npx` do `CMD` e os seeds via `docker compose
  exec`); `decode-uri-component` 0.2.2 no mobile (a 0.5 é só ESM e o
  `query-string` faz `require` dela: quebra com `decodeComponent is not a
  function`).

## Limites

- É uma foto de 2026-11-27. Sem geração na CI, envelhece a cada dia (a
  automação ficou como `SBOM-FUT-01`).
- O componente raiz das imagens é a imagem (`pkg:oci`), não o projeto. Os
  pacotes que o Trivy lê do `node_modules` da imagem (`node-pkg`) vêm **sem
  grafo de dependências**. Para API e web, a coluna "De onde vem" foi conferida
  com `npm ls` e `npm explain` dentro dos containers. No container da API,
  `NODE_ENV=production` faz o `npm ls` esconder as devDependencies, embora elas
  estejam no disco: use `npm explain <pacote>@<versão>`. No Alpine e no mobile,
  a coluna vem do grafo do próprio SBOM.
- A severidade é a do Trivy (GHSA, NVD e base do Alpine). Nenhuma CVE daqui foi
  triada: alcance, exploração e contexto continuam em aberto (TI-FUT-05).
- Imagens de terceiros do compose (MySQL, Redis, MailHog) não foram
  inventariadas.
