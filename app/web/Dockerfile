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

COPY package.json ./
RUN npm install

ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL

COPY index.html tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js ./
COPY src ./src

RUN npm run build

RUN addgroup -S vulnera && adduser -S vulnera -G vulnera && chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3000
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
