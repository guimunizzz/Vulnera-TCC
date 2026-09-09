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
RUN apk add --no-cache python3 make g++

# npm 10.9.8 (versão que vem junto do node:22-alpine) tem um bug conhecido no
# resolvedor de dependências (Arborist) que quebra `npm install` sem lockfile
# em certos grafos de dependência — mesma causa raiz corrigida em
# app/web/Dockerfile. Preventivo aqui: a API não reproduziu o erro até agora,
# mas usa a mesma imagem base e o mesmo padrão (install sem lockfile).
RUN npm install -g npm@11

# Manifesto primeiro pra aproveitar cache de layer: só reinstala deps se
# package.json mudar, não a cada alteração de código-fonte.
COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Usuário não-root — boa prática de segurança em container
RUN addgroup -S vulnera && adduser -S vulnera -G vulnera \
  && mkdir -p uploads && chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3001

# Aplica migrations pendentes (idempotente — pula as já aplicadas, seguro
# de rodar toda subida) e só então inicia o servidor. Seed NÃO roda
# automático (evitar duplicar dados de demo a cada restart do container):
# rodar à mão quando precisar → `docker compose exec api npm run db:seed`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
