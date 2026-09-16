# Resumo de execução — Exposure & Remediation Management

> Tudo abaixo é **saída de execução real**, em 2026-09-16, na máquina de
> desenvolvimento, contra a stack Docker desta branch
> (`feat/exposure-remediation-management`). Nenhum número foi estimado.

---

## Suítes

| Suíte | Comando | Resultado |
|---|---|---|
| API (Jest + Supertest) | `npx jest --runInBand` | **528 testes / 41 suítes — todos passando** · 272 s |
| Web (Vitest + Testing Library) | `npx vitest run` | **206 testes / 10 arquivos — todos passando** · 23 s |
| E2E (Playwright, Chrome real) | `npx playwright test e2e/exposure-remediation.spec.ts` | **9 testes — todos passando** · 12 s |
| Lint web (ESLint) | `npx eslint src --ext .ts,.tsx` | **0 erros**, 9 avisos (todos `react-refresh`, preexistentes) |
| Tipos (API e web) | `npx tsc --noEmit` | **0 erros** nos dois workspaces |

### De onde vieram os testes novos

| Área | Antes da iniciativa | Agora | Novos |
|---|---|---|---|
| API | 465 (35 suítes) | **528 (41 suítes)** | **+63** |
| Web | 190 (7 arquivos) | **206 (10 arquivos)** | **+16** |
| E2E | 1 arquivo (DAST) | **2 arquivos** | **+9** |

Os testes novos por checkpoint:

| Grupo | Casos |
|---|---|
| CP-5 · playbooks (integração) | `PB-01`..`PB-13`, `PB-SEED-01`, `TEN-33` — 15 |
| CP-5 · parser OWASP (unidade) | `OWASP-P-01`..`OWASP-P-08` — 8 |
| CP-5 · sanitização na escrita (unidade) | `SAN-01`..`SAN-10` — 10 |
| CP-5 · renderização segura (web) | `MD-01`..`MD-10` + `MD-08b` — 11 |
| CP-5 · CSP (web) | `CSP-01`..`CSP-05` — 5 |
| CP-6 · buscas salvas (integração) | `SQ-01`..`SQ-10`, `TEN-34` — 11 |
| CP-6 · canonização (unidade) | `SQ-U-01`..`SQ-U-08` + `SQ-U-07b` — 9 |
| CP-7 · responsável (integração) | `ASSIGN-01`..`ASSIGN-09`, `VULN-LIST-09` — 10 |
| E2E | `E2E-EXP-01`..`E2E-EXP-09` — 9 |

---

## Build Docker reproduzível

```
docker compose build --no-cache
→ BUILD_EXIT=0
→ Image vulnera-tcc-api Built
→ Image vulnera-tcc-web Built
```

Log completo em [`docker-build-no-cache.log`](docker-build-no-cache.log).

⚠️ **A PRIMEIRA execução FALHOU**, e isso é parte da evidência: o novo
diretório `app/web/config/` (que guarda a CSP) não estava no `COPY` do
`Dockerfile`, então o build passava fora do container e quebrava dentro dele:

```
src/test/csp.test.ts(21,74): error TS2307: Cannot find module '../../config/csp'
vite.config.ts(5,50): error TS2307: Cannot find module './config/csp'
target web: failed to solve: process "/bin/sh -c npm run build" did not complete successfully
```

Corrigido com uma linha no `Dockerfile` e rebuildado do zero. É exatamente o
tipo de defeito que só um `--no-cache` encontra.

### Stack de pé

```
vulnera-api   Up (healthy)
vulnera-db    Up (healthy)
vulnera-web   Up  → http://localhost:8086
vulnera-mail  Up
```

---

## Migrations do zero

Banco vazio (`vulnera_migrate_check`), `npx prisma migrate deploy`:

```
All migrations have been successfully applied.
```

As **18** migrations aplicam em sequência sobre um banco limpo, incluindo as
quatro desta iniciativa. Lista em
[`migrations-from-zero.txt`](migrations-from-zero.txt).

---

## CSP aplicada de verdade

Não é declaração: é o cabeçalho que o **container** devolve.

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none';
  frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:;
  font-src 'self' data:; style-src 'self' 'unsafe-inline';
  script-src 'self' 'sha256-hPE3TYmju45ZqV6nKG8MhV1P6YmIRg0VqIazm9m4+lc=';
  connect-src 'self' http://localhost:3001; worker-src 'self' blob:; frame-src 'none'
```

O hash é o do **script de tema do `index.html` realmente servido**, calculado a
cada boot. `script-src` não tem `'unsafe-inline'`, que é a única diretiva que
de fato barra um `<script>` injetado.

Saída completa em [`security-headers.txt`](security-headers.txt).

---

## Catálogo OWASP importado — verificação do conteúdo

Importado **offline**, do snapshot em `app/api/prisma/seeds/owasp/`:

```
criados: 10  atualizados: 0  falhas: 0
Licença do conteúdo: CC BY-SA 4.0 — OWASP Foundation.
```

Conferência do que foi gravado (todas as dez categorias com remediação, CWEs e
ao menos uma referência clicável):

| Categoria | resumo | causa raiz | como corrigir | exemplo | CWEs | refs |
|---|---|---|---|---|---|---|
| A01 | 499 | 1628 | 1585 | 881 | 34 | 10 |
| A02 | 455 | 2679 | 2567 | 1311 | 29 | 13 |
| A03 | 379 | 1343 | 1276 | 910 | 33 | 21 |
| A04 | 696 | 3248 | 1067 | 1347 | 40 | 9 |
| A05 | 474 | 1286 | 1403 | 1341 | 20 | 9 |
| A06 | 535 | 1340 | 1554 | 1068 | 3 | 3 |
| A07 | 360 | 1217 | 1391 | 1064 | 22 | 19 |
| A08 | 564 | 949 | 1284 | 1492 | 10 | 5 |
| A09 | 778 | 1150 | 1430 | 1328 | 4 | 10 |
| A10 | 530 | 650 | 1703 | 1183 | 1 | 6 |

(números = caracteres de Markdown gravados por seção)

⚠️ **O A10 só tem conteúdo por causa de uma correção.** Na primeira importação
ele entrou com `remediação = 0` e `CWEs = 0`, porque a tradução pt-BR usa
`## Como Previnir` (sic), `## Cenário de exemplo de um ataque` e `## Lista de
CWEs mapeadas` — redações diferentes das outras nove. O parser passou a casar
por assinatura. Sem a conferência do conteúdo gravado, o catálogo teria ido
para a demo com uma categoria muda.

---

## Nota de honestidade — uma falha intermitente observada

Numa das três execuções completas da suíte da API, o caso **`VRS-05`** falhou;
nas outras duas passou, e a suíte `vrs.test.ts` isolada passou **3 de 3** vezes
seguidas depois disso (9/9 em cada). O caso é do CP-3, anterior a esta rodada, e
não foi possível reproduzir a falha.

Está registrado aqui em vez de omitido: uma execução verde que escondesse uma
vermelha seria evidência pior que nenhuma. Fica como item a investigar —
provavelmente isolamento entre suítes, já que o teste compara conjuntos exatos
de resultados com o escopo de ADMIN (que enxerga todas as empresas).

---

## Como reproduzir

```bash
# 1. stack
docker compose build --no-cache && docker compose up -d

# 2. dados de demonstração + catálogo OWASP (este, sem Internet)
npm run db:seed --workspace=app/api
npm run db:seed:playbooks --workspace=app/api

# 3. suítes
npx jest --runInBand                 # em app/api
npx vitest run                       # em app/web
npx playwright test e2e/exposure-remediation.spec.ts   # em app/web, com a stack de pé

# 4. capturas desta pasta
npx playwright test e2e/capturar-evidencias.spec.ts    # em app/web
```

⚠️ Rode o Playwright **sozinho** (ver `playwright.config.ts`).
