# app/api/Dockerfile
#
# Imagem única (sem multi-stage) — prioriza praticidade: `docker compose up
# --build` sobe API + Web + MySQL juntos, acessível via localhost, sem
# precisar de 3 terminais abertos. Decisão revisada em relação ao
# ADR-005 original ("código roda local, só infra no Docker") — ver
# docs/Vulnera/07-Decisoes/ADR-022 - Stack completa no Docker Compose.md.
FROM node:22-alpine

WORKDIR /app

# bcrypt (hash de senha) tem binding nativo em C++ — precisa de toolchain
# de compilação pra instalar em cima do Alpine (musl), senão o npm install
# falha tentando compilar o addon.
#
# docker-cli (adicionado em 2026-09-09): o módulo DAST sobe UM container do
# OWASP ZAP por scan via `docker run`. Sem o binário aqui dentro, o
# `execFile("docker", ...)` do zap-runner falha com ENOENT e TODO scan cai no
# fallback simulado — a "Causa 1" de docs/DAST-DOCKER-GAP.md §3. É só o
# CLIENTE: quem executa os containers é o daemon do HOST, alcançado pelo
# socket montado no docker-compose.yml (padrão DooD, ADR-028).
#
# `apk upgrade` (2026-11-27, docs/SBOM.md): a base `node:22-alpine` é
# publicada com os pacotes do dia em que foi gerada, e esta camada fica em
# cache. O SBOM achou `zlib`, `libssl3`/`libcrypto3` e o próprio `docker-cli`
# com CVE crítica/alta já corrigida no repositório do Alpine. Atualizar aqui
# traz as correções a cada build sem cache; combine com `docker compose build
# --pull` para a base também vir nova.
RUN apk upgrade --no-cache && apk add --no-cache python3 make g++ docker-cli

# npm 10.9.8 (versão que vem junto do node:22-alpine) tem um bug conhecido no
# resolvedor de dependências (Arborist) que quebra `npm install` sem lockfile
# em certos grafos de dependência — a MESMA linha, pela MESMA causa, está em
# app/web/Dockerfile. Preventivo aqui: a API nunca reproduziu o erro; o web
# reproduz sempre (é o grafo dele que dispara o bug). As duas imagens usam a
# mesma base e o mesmo padrão (install sem lockfile), então as duas levam o fix.
#
# ⚠️ Em 2026-09-15 esta afirmação estava FALSA: o revert `31988ba` tinha
# removido o fix do web, e o build de lá quebrava enquanto este comentário
# dizia que estava corrigido. Restaurado no CP-0 da iniciativa Exposure &
# Remediation — se algum dia a linha sumir de um dos dois, este comentário
# volta a mentir.
# Cache do npm no BuildKit (fora da imagem): mudar o package.json não rebaixa tudo.
RUN --mount=type=cache,target=/root/.npm npm install -g npm@11

# Manifesto primeiro pra aproveitar cache de layer: só reinstala deps se
# package.json mudar, não a cada alteração de código-fonte.
COPY package.json ./
RUN --mount=type=cache,target=/root/.npm npm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Usuário não-root — boa prática de segurança em container.
#
# ⚠️ O `vulnera` entra TAMBÉM no grupo root (GID 0). Motivo: no Docker Desktop
# o socket montado (/var/run/docker.sock) é `srw-rw---- root root`, então sem
# GID 0 o processo recebe "permission denied" ao falar com o daemon e todo
# scan cai no simulado — a "Causa 2" de docs/DAST-DOCKER-GAP.md §3. É menos
# invasivo que rodar o container inteiro como root, mas não é gratuito: quem
# fala com o socket do Docker controla o daemon do host. Consequência aceita e
# registrada em ADR-031. Em host Linux o socket costuma ser root:docker (GID
# 999/998) — nesse caso use `group_add` no compose com o GID local, em vez
# deste GID 0.
#
# chown só onde a API grava (o .xlsx vai pro /tmp): `chown -R /app` duplicava o node_modules (~450 MB).
RUN addgroup -S vulnera && adduser -S vulnera -G vulnera \
  && addgroup vulnera root \
  && mkdir -p uploads dast-reports && chown vulnera:vulnera uploads dast-reports
USER vulnera

EXPOSE 3001

# Aplica migrations pendentes (idempotente — pula as já aplicadas, seguro
# de rodar toda subida) e só então inicia o servidor. Seed NÃO roda
# automático (evitar duplicar dados de demo a cada restart do container):
# rodar à mão quando precisar → `docker compose exec api npm run db:seed`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
