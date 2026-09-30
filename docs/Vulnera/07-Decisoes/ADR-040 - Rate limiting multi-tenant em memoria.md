---
type: decisao
tags: [decision, security, rate-limit, multi-tenant, disponibilidade]
status: vigente
codigo: ADR-040
data: 2026-09-21
---

# ADR-040 - Rate limiting multi-tenant em memória

## Contexto

Uploads, autenticação, relatórios, consultas agregadas e criação de scans DAST
podiam ser repetidos sem limite HTTP. Isso abre abuso de recursos, enumeração
de credenciais e degradação entre clientes. A API atual roda em uma instância e
Redis não faz parte do MVP.

## Decisão

Adotar **Token Bucket em memória**, com teto de chaves, TTL, limpeza periódica
com timer `unref()` e reset normal após restart. As políticas padrão são:

| Camada | Taxa / burst |
|---|---|
| global | 5 RPS / 15 |
| tenant CLIENT | 2 RPS / 10 |
| usuário autenticado | 1 RPS / 10 |
| escrita | 30/min / 5 |
| consulta cara | 10/min / 3 |
| relatório/exportação | 3/min / 2 |
| criação DAST | 2/min / 2 |

Login limita IP hasheado e conta normalizada hasheada; register limita IP.
Refresh válido usa o `userId` assinado como chave estável; token inválido usa
somente seu hash efêmero, nunca o valor cru. Login bem-sucedido devolve um
token aos buckets de IP e conta, para que sucesso não conte como falha. Ao
atingir o teto de memória, buckets `auth:` não são desalojados por tráfego
normal; se só houver chaves protegidas, a nova chave é recusada até expirar.

O JWT permanece apenas `{ userId, role }`. Para `CLIENT`, a associação com
company vem de `UserRepository.findCompanyIdById`, em cache curto dedicado
exclusivamente ao limiter. `ADMIN` e `PENTESTER` usam global + usuário +
endpoint, nunca `tenant:null`, pois o escopo deles não é uma única empresa.

`TRUST_PROXY_HOPS` é 0 por padrão e 1 atrás do proxy único de produção. Nunca
é configurado como `true`. O cliente recebe `429 RATE_LIMITED`, `Retry-After`
e `RateLimit-Limit/Remaining/Reset`; logs de rejeição incluem apenas escopo,
método e rota normalizada.

## Consequências

- O limiter não participa de RBAC ou ownership e não confia em URL, body,
  query ou `X-Tenant-ID` para escolher tenant.
- `/api/health` continua disponível para sondas; o catálogo público fica sob
  o bucket global.
- Capacidade deve ser medida em processo isolado com `RATE_LIMIT_ENABLED=false`;
  isso nunca é default de produção.
- Em várias réplicas será necessário substituir o store por Redis ou outro
  estado compartilhado, sem mudar controllers ou serviços de domínio.

## Alternativas descartadas

**Redis agora.** Descartado: adiciona serviço, operação e dependência fora do
MVP para uma única instância. A interface de store permite essa evolução.

**Tenant no JWT ou em header.** Descartado: token ficaria defasado e header/body
permitiria escolher uma cota que não pertence ao ator.

**`trust proxy = true`.** Descartado: aceitaria uma cadeia de IP forjada pelo
cliente, tornando a limitação por IP contornável.

## Relacionado
[[Middlewares e Ownership]]
[[Padrao - Autenticacao e JWT]]
[[Multi-tenancy por escopo]]
