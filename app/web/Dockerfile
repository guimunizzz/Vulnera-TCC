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

# Manifesto primeiro pra aproveitar cache de layer (mesma ordem do
# app/api/Dockerfile). Copiar `package*.json` não adianta: o projeto ignora
# package-lock.json no .gitignore, então NUNCA existe lock no contexto de
# build. Toda imagem resolve as versões do zero dentro das faixas do
# semver — é por isso que o npm tem que refazer o grafo de peers aqui.
COPY package.json ./

# ⚠️ --legacy-peer-deps é OBRIGATÓRIO, não é preferência: sem ele o npm
# 10.9 do node:22-alpine estoura resolvendo o grafo de peers deste projeto
# ("Cannot read properties of null (reading 'edgesOut')" — bug do Arborist).
#
# O preço é que a flag também DESLIGA a instalação automática de peer
# dependencies. Toda peer que o código realmente usa precisa estar
# declarada à mão no package.json — foi o que aconteceu com
# @testing-library/dom, que o `tsc` do build exige (é de lá que vêm
# `screen`, `waitFor` e `within`, só reexportados por
# @testing-library/react). Na máquina do dev o npm instalava a peer
# sozinho e o problema ficava invisível até o build do container.
RUN npm install --legacy-peer-deps

ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL

COPY index.html tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js ./
COPY src ./src

RUN npm run build

RUN addgroup -S vulnera && adduser -S vulnera -G vulnera && chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3000
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
