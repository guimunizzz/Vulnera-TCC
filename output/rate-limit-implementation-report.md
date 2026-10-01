# Relatório de implementação — rate limiting multi-tenant

Data: 2026-09-21  
Branch: `feat/rate-limit`  
Estado do Git: alterações locais não estão commitadas nem staged.

## 1. Resumo executivo

Foi implementado rate limiting HTTP em camadas para a API Express: global,
usuário autenticado, tenant `CLIENT`, escrita, consultas caras, relatórios,
criação DAST e fluxos públicos de autenticação. A solução usa Token Bucket em
memória, sem dependência de runtime nova, schema, migration ou lockfile.

Os valores são baseline configurável, não capacidade medida do Render. A carga
local confirmou respostas estáveis abaixo do limite e `429` acima dele, sem
`5xx` nem timeout nos cenários executados.

## 2. Políticas finais

| Escopo | Taxa / burst | Chave confiável |
|---|---:|---|
| Global | 5 RPS / 15 | uma chave da instância |
| Tenant `CLIENT` | 2 RPS / 10 | `companyId` resolvido do banco/cache curto |
| Usuário autenticado | 1 RPS / 10 | `userId` do JWT validado |
| Escrita | 30/min / 5 | `userId` |
| Consulta cara | 10/min / 3 | `userId` |
| Relatório/exportação | 3/min / 2 | `userId` |
| Criar scan DAST | 2/min / 2 | `userId` |
| Login por conta | 5/5 min / 5 | hash do e-mail normalizado |
| Login por IP | 20/5 min / 20 | hash de `req.ip` |
| Register por IP | 5/5 min / 5 | hash de `req.ip` |
| Refresh | 10/min / 3 | hash estável do `userId` assinado; hash do token só se inválido |

Todos os parâmetros podem ser ajustados em ambiente por `RATE_LIMIT_*`. O
default é ligado fora de `NODE_ENV=test`; `RATE_LIMIT_ENABLED=false` existe
somente para benchmark controlado, nunca como default de produção.

## 3. Arquitetura

- `TokenBucketStore` isolado usa relógio monotônico, refill, burst, cálculo de
  `Retry-After`, TTL, limpeza periódica `unref()` e máximo de chaves.
- `RateLimitService` centraliza políticas, chaves e cache limitado de tenant.
- A factory compõe store, resolver e middleware sem misturar Prisma ao Express.
- O middleware global é aplicado antes das rotas de negócio. `/api/health` é
  isento intencionalmente para não competir com usuários.
- As rotas autenticadas compõem autenticação e rate limit em um middleware
  explícito; políticas adicionais são aplicadas só nos endpoints caros.
- `POST /api/dast/scans` recebe a política HTTP adicional, sem mudar watchdog,
  concorrência, timeout ou limites de recursos do DAST.

`429` retorna `RATE_LIMITED`, mensagem em PT-BR, `Retry-After`,
`RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`. Logs de bloqueio
contêm somente escopo, método, rota normalizada e espera; não registram token,
senha, e-mail, `userId`, `companyId` ou query string.

## 4. Segurança e tenancy

O JWT continua contendo somente `{ userId, role }`. Para `CLIENT`, o resolver
consulta `UserRepository.findCompanyIdById` apenas no cache miss; o cache é
curto (60 s por default), limitado (1.000 chaves) e nunca participa de RBAC ou
ownership. URL, body, query e `X-Tenant-ID` não escolhem a cota.

`ADMIN` e `PENTESTER` usam buckets global, usuário e endpoint: nunca entram em
`tenant:null`, pois não há uma empresa única confiável nessa camada. Login usa
hashes de IP/conta e reembolsa ambos somente no sucesso. Refresh não persiste
nem registra token cru. Quando o store alcança o teto, tráfego comum não pode
evictar buckets `auth-`; se só restarem buckets protegidos, a nova chave é
recusada até a expiração.

`TRUST_PROXY_HOPS` é 0 por padrão e deve ser configurado explicitamente para o
número de proxies confiáveis do deploy; `trust proxy = true` não é usado.

## 5. Código e documentação

Principais arquivos novos:

- `app/api/src/config/rate-limit.config.ts`, `services/rate-limit.service.ts`,
  `utils/token-bucket.util.ts`, factory e middleware: implementação.
- `app/api/tests/unit/rate-limiter.test.ts` e
  `app/api/tests/integration/rate-limit.test.ts`: comportamento determinístico
  do algoritmo e integração HTTP/multi-tenant.
- `app/api/tests/load/k6/`: smoke, steady, breakpoint, rate-limit e
  multi-tenant, com bloqueio de URL remota por default.
- `app/api/tests/load/jmeter/`: steady, over-limit e multi-tenant. O plano
  over-limit usa componente JSR223 nativo do JMeter para marcar `200` e `429`
  como resultados esperados, sem plugin externo.

Arquivos adaptados incluem `app.ts`, `EnvKeys`, repository de usuário, rotas
protegidas, rotas de autenticação e `.env.example`.

Documentação atualizada: `PRD_VIVO.md`, `docs/BACKLOG.md`,
`docs/RATE_LIMITING.md`,
`docs/Vulnera/04-Arquitetura/Middlewares e Ownership.md` e ADR-040 em
`docs/Vulnera/07-Decisoes/`.

As histórias de usuário, casos de uso e critérios de aceite estão em
`docs/RATE_LIMITING.md`. Elas cobrem a relação entre autenticação, saúde,
isolamento de empresas, DAST e segurança dos testes de carga.

## 6. Testes

| Comando | Resultado real |
|---|---|
| `npm run test --workspace=app/api -- tests/unit/rate-limiter.test.ts tests/integration/rate-limit.test.ts` | PASS — 2 suítes, 14 testes |
| `npm run test --workspace=app/api` | PASS — 43 suítes, 552 testes, 302,243 s |
| `npm run build --workspace=app/api` | PASS — TypeScript |
| `npm run lint --workspace=app/api` | NOT PASS — dois imports não usados preexistentes em `src/services/vulnerability.service.ts:45` (`UserEntity`, `UserResponseDTO`); nenhuma falha nas alterações desta entrega |
| Parse XML dos três `.jmx` | PASS |
| `GET http://localhost:3002/api/health` | PASS — 200 |

Os testes de integração exercitam health fora do global, endpoint público,
refill e headers, usuário, tenant compartilhado e isolado, spoofing de tenant,
`ADMIN`/`PENTESTER`, escrita, endpoints caro/report/DAST e auth
(login/register/refresh). Os unitários cobrem burst, refill, expiração, teto,
clock regressivo, concorrência e a proteção de eviction de autenticação.

## 7. Testes de carga

Ambiente executado: API local isolada em `http://localhost:3002`, produção
simulada (`NODE_ENV=production`), k6 `v2.2.0` e Apache JMeter `5.6.3`.

| Ferramenta/cenário | Comando resumido | Resultado |
|---|---|---|
| k6 smoke | `k6 run ... smoke.js` | 6/6 checks, 6 `2xx`, 0 `5xx`, 0 timeout; p50 1,8095 ms, p95 9,5851 ms, p99 11,15102 ms |
| k6 abaixo do limite | `MODE=below RPS=1 DURATION=5s ... rate-limit.js` | 6 `2xx`, 0 `429`, 0 `5xx`, 0 timeout; p50 4,64045 ms, p95 6,159025 ms, p99 6,299645 ms |
| k6 acima do limite | `MODE=above RPS=10 DURATION=5s ... rate-limit.js` | 39 `2xx`, 11 `429`, 0 `5xx`, 0 timeout; aceitas p50 4,0655 ms, p95 5,74898 ms, p99 10,317722 ms; limitadas p50 1,3146 ms, p95 1,86805 ms, p99 1,91657 ms |
| JMeter over-limit | `jmeter -n -t .../over-limit.jmx -Jport=3002 -JdurationSeconds=5` | 478 respostas: 38 `200`, 440 `429`; 0 erros de cenário e nenhum `5xx` registrado |

Artefatos: `output/load/k6/*.summary.json` e
`output/load/jmeter/over-limit.jtl`.

`steady.js`, `breakpoint.js`, `multi-tenant.js`, JMeter steady e JMeter
multi-tenant estão **NOT RUN**: exigem tokens temporários de papéis/empresas
reais, que não foram criados para não manipular dados do ambiente. O comando
reproduzível e as variáveis necessárias estão em `docs/RATE_LIMITING.md`.

O k6 assinala HTTP `429` em `http_req_failed`; este valor é intencionalmente
separado nas métricas `rate_limited_429` e `app_5xx`. Neste relatório, `429`
não é erro da aplicação.

## 8. Resultados

Os critérios funcionais foram atingidos nas provas automatizadas: global,
usuário, tenant seguro, autenticação, endpoints caros, DAST HTTP, health,
headers, configuração, retenção limitada e ausência de `tenant:null`. Na carga
pública acima do limite, a API converteu o excesso em `429` e manteve `0` 5xx.

Capacidade observada **não é** limite configurado: não houve benchmark de
capacidade com `RATE_LIMIT_ENABLED=false`. O script `breakpoint.js` está pronto
para a medição controlada com reinício da API entre os cenários. Métricas locais
não representam a capacidade do Render Free.

## 9. Limitações

- O store reseta no restart e atende somente uma instância.
- Várias réplicas exigem store distribuído (por exemplo Redis) antes de escalar.
- Cache de tenant pode usar temporariamente uma cota anterior; nunca concede
  autorização.
- Docker Compose está saudável, mas as imagens em execução são anteriores a
  esta alteração: `docker compose up --build -d` foi interrompido porque ficou
  preso em uma camada de build existente. A versão atual foi validada no Node
  local isolado em 3002.
- Lint preexistente impede declarar o gate de lint como aprovado.

## 10. Revisão

| Origem | Finding | Severidade | Decisão/correção |
|---|---|---|---|
| Estratégia de testes (Luna Max) | Necessidade de relógio injetável, métricas separadas e proteção de URL remota | — | Aceito; implementado e testado |
| Revisão independente (Luna Max), 1ª passagem | refresh rotativo poderia obter novo burst; refund de IP ausente; `RateLimit-Reset`, cobertura e JMeter incompletos | P1/P2/P3 | Aceitos e corrigidos |
| Revisão independente (Luna Max), 2ª passagem | tráfego comum podia expulsar lockout de autenticação; ADR desatualizado | P1/P2 | Aceitos e corrigidos |
| Revisão independente (Luna Max), final | prefixo real era `auth-`, não `auth:` | P1 | Aceito; correção e teste com `auth-login-account:*`; nova revisão sem achados acionáveis |

O subagente de arquitetura/segurança foi interrompido antes de entregar um
parecer; este fato é registrado para não simular uma revisão que não ocorreu.
As decisões de segurança foram então verificadas na revisão independente e nos
testes de integração.

## 11. Deploy/monitoramento

`docker compose ps` final mostrou API e banco `healthy`, com web e MailHog em
execução. `/api/health` da instância atualizada local retornou 200. Para deploy:

1. defina `TRUST_PROXY_HOPS` somente para proxies conhecidos;
2. mantenha `RATE_LIMIT_ENABLED=true`;
3. monitore logs seguros de `scope`, método, rota normalizada e espera;
4. para múltiplas réplicas, substitua o store mantendo a interface atual;
5. execute novamente steady, multi-tenant e capacity em ambiente controlado.

## 12. Diff stat

O `git diff --stat` rastreia somente arquivos já versionados. Snapshot final:

```text
22 files changed, 146 insertions(+), 52 deletions(-)
```

Os novos arquivos de fonte, testes, carga, ADR e este relatório aparecem como
`??` até serem adicionados manualmente ao índice; por isso não entram nessa
soma. Reexecute antes do commit manual:

```powershell
git diff --stat
git status --short
```
