# OWASP ZAP baseline — Vulnera (Fase 8, Checkpoint 4)

> Gerado em 2026-08-11 contra a stack real do `docker compose up --build`
> (imagem de produção `vite preview`, não o dev server), alvo
> `http://host.docker.internal:3000` (frontend web — é a porta de entrada do
> usuário; a superfície da API é coberta pelos 225+ testes de segurança de
> integração da Fase 5, ver `docs/BACKLOG.md` "Limitações conhecidas — Fase 5").

## Como reproduzir

```bash
docker compose up -d --build          # sobe db + api + web
docker run --rm -v "$(pwd)/docs/evidencias/zap:/zap/wrk:rw" \
  -t zaproxy/zap-stable zap-baseline.py \
  -t http://host.docker.internal:3000 \
  -r zap-baseline-web.html -J zap-baseline-web.json -w zap-baseline-web.md -I
```

`host.docker.internal` é como o container do ZAP alcança o container `web`
do compose a partir de outra rede Docker — funciona out-of-the-box no Docker
Desktop (Windows/Mac); em Linux nativo use `--add-host=host.docker.internal:host-gateway`.

## Resultado final

**0 FAIL, 5 WARN, 62 PASS** (66 regras passivas no total). Nenhum achado de
severidade alta/crítica.

## O que foi corrigido (achado real → fix barato)

A primeira rodada (antes de qualquer fix) apontou **8 WARN**, incluindo dois
achados de infraestrutura descobertos só por causa deste scan — nenhum dos
dois tinha teste automatizado que os pegasse antes:

1. **`app/web/Dockerfile` não buildava de jeito nenhum contra dependências
   isoladas** — `RUN npm install` roda sem o lockfile do monorepo (workspace
   npm, um único `package-lock.json` na raiz, fora do build context de
   `app/web`), e `@types/node` nunca tinha sido declarado como
   devDependency — só "funcionava" localmente por hoisting acidental do
   workspace raiz. Corrigido adicionando `@types/node` a
   `app/web/package.json`. **Isto bloqueava o próprio `docker compose up
   --build` da stack de produção** (ADR-022) — achado mais valioso do
   Checkpoint 4 do que qualquer coisa que o ZAP reportou.
2. **`vite preview` (servidor de produção) bloqueava `host.docker.internal`**
   por padrão — proteção anti DNS-rebinding do próprio Vite. Liberado via
   `preview.allowedHosts` em `vite.config.ts` (seguro aqui: o container só
   existe pra demo/dev local, nunca exposto na internet).
3. **Cabeçalhos de segurança ausentes** (`X-Content-Type-Options`,
   `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` — 4 dos 8 WARN
   originais): `vite preview` não define nenhum por padrão. Corrigido com um
   plugin Vite mínimo (`securityHeaders()` em `vite.config.ts`) que injeta os
   4 headers via middleware — mesmo efeito em dev e produção, sem depender de
   reverse proxy.

## Limitações conhecidas (aceitas — não "grave e barato" o suficiente)

| Achado | Por que não foi corrigido agora |
| --- | --- |
| **CSP (Content-Security-Policy) ausente** | Uma CSP estrita o bastante pra valer a pena exigiria testar a aplicação inteira contra ela — o design system usa `style` inline (`style={{...}}`) em vários componentes (badges de severidade, gráficos), e uma política mal calibrada quebraria a UI sem aviso. Fica como trabalho futuro pós-TCC. |
| **Cross-Origin-Embedder-Policy ausente** | Só importa pra isolamento cross-origin (`SharedArrayBuffer` etc.) — o app não usa nenhuma API que precise disso. |
| **Storable but Non-Cacheable Content** | Achado de performance/cache, não de segurança — `vite preview` serve com `Cache-Control: no-cache` por padrão; ajustar cache de assets estáticos é trabalho de infra (CDN/reverse proxy), fora do escopo de uma sessão de fechamento. |
| **"Modern Web Application"** | Informativo — o ZAP só está avisando que o alvo é uma SPA (spidering tradicional cobre menos rotas client-side). Não é uma vulnerabilidade. |
| **"Suspicious Comments" no bundle JS** | **Falso positivo** — o regex do ZAP (`\bFROM\b`) casou com o cabeçalho de licença MIT do `tslib` ("...ARISING **FROM**, OUT OF OR IN CONNECTION..."), empacotado pelo Rollup. Remover o comentário violaria a licença; não há nada a corrigir. |

## Achado à parte (fora do escopo do ZAP): dependência com CVE conhecida

Durante esta sessão, o linting do editor apontou `react-router-dom@6.28.0`
com um Open Redirect conhecido (fix disponível só na major 7.x). **Não
atualizado agora** — é um salto de major version com mudanças de API que
exigiria re-testar toda a navegação da aplicação, incompatível com o "barato"
do Checkpoint 4. Listado como limitação conhecida no README raiz.
