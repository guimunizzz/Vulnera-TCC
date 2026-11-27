# app/web/Dockerfile
#
# `vite preview` serve o build de produção (dist/) com fallback de SPA já
# pronto pro React Router — evita ter que aprender/manter um Nginx só pra
# servir arquivo estático. Não é multi-stage: prioriza praticidade sobre
# tamanho de imagem (mesmo espírito do app/api/Dockerfile).
#
# ⚠️ VITE_API_URL é injetada em BUILD TIME — o Vite embute env var no bundle
# na hora do `vite build`, não dá pra trocar depois em runtime. Tem que ser
# o endereço que o NAVEGADOR (rodando no host, fora da rede do compose)
# enxerga — por isso é http://localhost:3001/api, nunca o nome do serviço
# Docker (`api`), que só existe dentro da rede interna do compose.
FROM node:22-alpine

WORKDIR /app

# Pacotes do Alpine com as correções publicadas depois da base (2026-11-27,
# docs/SBOM.md: `zlib` crítica, `libssl3`/`libcrypto3`). Mesmo motivo e mesma
# linha do app/api/Dockerfile.
RUN apk upgrade --no-cache

# npm 10.9.8 (a versão que vem junto do node:22-alpine) tem um bug conhecido no
# resolvedor de dependências (Arborist): `npm install` SEM lockfile aborta com
# "Cannot read properties of null (reading 'edgesOut')". O projeto inteiro
# ignora lockfile no .gitignore, então nenhum lock chega ao contexto de build e
# o grafo é sempre remontado do zero aqui dentro — exatamente o caminho que
# dispara o bug. É bug de versão do npm, não de dependência deste projeto.
#
# ⚠️ ESTA LINHA JÁ EXISTIU E FOI PERDIDA. Entrou em `72af22e` nos DOIS
# Dockerfiles (api e web); o commit da landing (`de4b33c`) a removeu do web, o
# fix `74cb60e` contornou de outro jeito (`--legacy-peer-deps`) e o revert da
# landing (`31988ba`) levou junto o contorno, deixando o build quebrado em
# `dev` e `main`. Restaurada aqui na forma ORIGINAL, que é também a que o
# app/api/Dockerfile usa — mesma causa, mesmo remédio, nos dois lugares.
#
# Por que npm@11 e não `--legacy-peer-deps`: a flag também DESLIGA a instalação
# automática de peer dependencies, e foi assim que `@testing-library/dom`
# sumiu do container em 2026-09-14. Subir o npm corrige a causa; a flag
# contornava o sintoma criando outro.
RUN --mount=type=cache,target=/root/.npm npm install -g npm@11

# Manifesto primeiro pra aproveitar cache de layer (mesma ordem do
# app/api/Dockerfile): só reinstala deps quando package.json muda, não a cada
# alteração de código-fonte. Copiar `package*.json` não adiantaria — não há
# lock no contexto, ver acima.
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm npm install

ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_TURNSTILE_ACTION=access-request
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_ACTION=$VITE_TURNSTILE_ACTION

COPY index.html tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js ./
# `config/` guarda a Content-Security-Policy (CP-5), importada pelo vite.config
# e verificada por teste. Sem esta linha o build falha DENTRO do container e
# passa fora dele — que foi exatamente o que aconteceu no primeiro
# `build --no-cache` depois de a CSP entrar.
COPY config ./config
COPY src ./src

# Sem o `tsc --noEmit` do `npm run build`: pesa em RAM e não muda o bundle. Typecheck: `npm run build` fora do Docker.
RUN npx vite build

# chown só das pastas onde o preview grava (não -R): `-R` duplicava o node_modules (~450 MB).
# Vite 5 gravava o vite.config compilado em /app; o Vite 6 grava em
# node_modules/.vite-temp/ — sem o chown dela o preview cai com EACCES na subida
# (2026-11-27, atualização do Vite pelas CVEs, docs/SBOM.md).
RUN addgroup -S vulnera && adduser -S vulnera -G vulnera \
  && mkdir -p node_modules/.vite-temp \
  && chown vulnera:vulnera /app node_modules/.vite-temp
USER vulnera

EXPOSE 3000
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
