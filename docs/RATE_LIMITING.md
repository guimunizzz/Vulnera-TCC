# Rate limiting — operação e critérios de aceite

## Histórias de usuário e casos de uso

| História | Caso observável | Critério de aceite |
|---|---|---|
| Como CLIENT, quero que outro cliente não esgote minha cota. | Dois usuários da empresa A excedem a cota; B e C fazem chamadas normais. | A recebe `429`; B e C seguem em `2xx`, sem `5xx`. |
| Como usuário legítimo, quero saber quando tentar de novo. | Uma rota ultrapassa qualquer bucket. | Resposta `429` traz `RATE_LIMITED`, `Retry-After` inteiro positivo e `RateLimit-*`, sem id, e-mail, token ou company. |
| Como operador, quero que health continue observável em incidente. | O bucket global esgota. | `GET /api/health` ainda retorna `200`; endpoint público comum recebe `429`. |
| Como dono da plataforma, quero dificultar força bruta sem vazar contas. | Falhas repetidas de login, refresh e register. | Login aplica IP+conta hasheados; mensagens não distinguem conta existente; refresh não armazena token cru. |
| Como pentester, quero que DAST continue com sua fila/watchdog. | Muitas criações HTTP de scan. | `POST /api/dast/scans` recebe `429` após 2/min por usuário; `DAST_MAX_CONCURRENT_SCANS` não foi modificado. |
| Como equipe de qualidade, quero medir sem burlar produção por engano. | Rodar carga local e tentativa remota. | k6 bloqueia URL remota sem `ALLOW_REMOTE_LOAD_TEST=true`; capacity usa instância reiniciada com limiter explicitamente desligado. |

## Políticas e limites

Os valores padrão estão em `app/api/.env.example`. São configuração inicial,
não medição de capacidade. O limiter só escreve hashes de chaves sensíveis e
o estado é limitado por TTL e quantidade máxima de chaves.

## Execução reproduzível

Pré-requisito: stack local na porta 3001 e, nos cenários autenticados, token
fornecido apenas por variável de ambiente.

```powershell
$env:TOKEN = '<token temporário>'
k6 run --summary-export output/load/k6/steady.summary.json app/api/tests/load/k6/steady.js
k6 run app/api/tests/load/k6/smoke.js
k6 run -e MODE=above app/api/tests/load/k6/rate-limit.js
```

Para capacity, reinicie a API com `RATE_LIMIT_ENABLED=false`; não use essa
variável em produção. Multi-tenant requer `TENANT_A_TOKEN_1`,
`TENANT_A_TOKEN_2`, `TENANT_B_TOKEN` e `TENANT_C_TOKEN`.

```powershell
jmeter -n -t app/api/tests/load/jmeter/steady.jmx -Jprotocol=http -Jhost=localhost -Jport=3001 -Jtoken="$env:TOKEN" -l output/load/jmeter/steady.jtl -e -o output/load/jmeter/steady-report
jmeter -n -t app/api/tests/load/jmeter/over-limit.jmx -Jprotocol=http -Jhost=localhost -Jport=3001 -l output/load/jmeter/over-limit.jtl -e -o output/load/jmeter/over-limit-report
```

No JMeter multi-tenant, passar `-JtokenA1`, `-JtokenA2`, `-JtokenB` e
`-JtokenC`. `429` é comportamento esperado no over-limit e deve ser separado
de `5xx`; resultados não executados ficam marcados como `NOT RUN` no relatório.

## Metas iniciais

- abaixo do limite: `429` aproximadamente zero;
- acima do limite: `429` esperado e `5xx < 1%`;
- endpoints aceitos: p95 menor que 500 ms e p99 menor que 1 s;
- capacity com limiter desligado: `429 = 0`.

Resultados locais não representam capacidade do Render Free (CPU/memória e
instância são diferentes).
