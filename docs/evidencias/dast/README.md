# Evidências do módulo DAST (OWASP ZAP) — Fase 9

> ⚠️ **Não confundir com `docs/evidencias/zap/`.** Aquela pasta é o baseline de
> segurança rodado MANUALMENTE contra a própria stack do Vulnera (Fase 8,
> Checkpoint 4 — prova de que o produto em si é seguro). **Esta pasta** é a
> saída real de dois scans disparados **através do módulo DAST construído na
> Fase 9** — ou seja, prova de que a *feature* funciona, escaneando alvos
> externos, não a aplicação Vulnera.

Gerados em 2026-09-05, durante a validação end-to-end da Fase 9
(`docs/DAST.md` §9, `PRD_VIVO.md` §6). Copiados de `app/api/dast-reports/`
(que fica fora do git, mesmo tratamento de `uploads/`) para cá em 2026-09-06,
a pedido do Rafael, pra virarem material permanente de evidência do TCC.

## Como foram gerados

Não é um `docker run` manual — são a saída exata do fluxo real do produto:
login como `PENTESTER`/`ADMIN` na UI → **DAST** → **Novo scan** → URL do alvo
→ o próprio `zap-runner.service.ts` sobe o container, roda
`zap-full-scan.py -t <url> -J report.json -r report.html`, e o resultado é
persistido em `DastScan`/`DastFinding` (ver `docs/DAST.md` §4 para o comando
exato e §6 para o modelo de dados).

## Os dois scans

| Arquivo | Alvo | Por quê este alvo |
|---|---|---|
| `dast-scan-example-com.*` | `https://example.com` | Site estático simples — o "controle negativo": mostra o que o scanner reporta contra algo deliberadamente limpo, sem lógica de aplicação nenhuma. |
| `dast-scan-juice-shop.*` | `http://host.docker.internal:3500` (OWASP Juice Shop) | Aplicação **propositalmente vulnerável** da própria OWASP (`docs/DAST.md` §8) — o "controle positivo": prova que o scanner acha problemas de verdade quando eles existem, não só roda e devolve zero. |

O contraste entre os dois é a evidência mais forte: o mesmo pipeline, a
mesma configuração, alvos diferentes, resultados coerentes com a natureza
de cada alvo.

## Resumo dos achados

Nenhum dos dois scans encontrou alerta de risco **HIGH** (3) — esperado
num scan sem autenticação prévia contra ambos os alvos; o Juice Shop
tem vulnerabilidades mais profundas atrás de login que um `zap-full-scan.py`
padrão, sem sessão configurada, não alcança.

### `example.com` — 13 alertas, todos MEDIUM/LOW/INFO

| Risco | Alerta | Instâncias |
|---|---|---|
| MEDIUM | Content Security Policy (CSP) Header Not Set | 3 |
| MEDIUM | Missing Anti-clickjacking Header | 1 |
| MEDIUM | Relative Path Confusion | 2 |
| LOW | Strict-Transport-Security Header Not Set | 3 |
| LOW | Permissions Policy Header Not Set | 3 |
| LOW | HTTPS Content Available via HTTP | 2 |
| LOW | Cross-Origin-Embedder/Opener/Resource-Policy Missing | 1 cada |
| LOW | X-Content-Type-Options Header Missing | 1 |
| INFO | Retrieved from Cache / Storable and Cacheable / Re-examine Cache-control | 1–4 cada |

Perfil típico de site estático sem lógica de servidor: só cabeçalhos de
segurança ausentes, nada estrutural.

### Juice Shop — 16 alertas, com concentração de MEDIUM e uma instância notável

| Risco | Alerta | Instâncias |
|---|---|---|
| **MEDIUM** | **Backup File Disclosure** | **31** |
| MEDIUM | Bypassing 403 | 6 |
| MEDIUM | Cross-Domain Misconfiguration | 5 |
| MEDIUM | CORS Misconfiguration | 5 |
| MEDIUM | Content Security Policy (CSP) Header Not Set | 5 |
| MEDIUM | HTTP Only Site | 1 |
| LOW | Cross-Origin-Embedder/Opener-Policy Missing | 5 cada |
| LOW | Deprecated Feature Policy Header Set | 5 |
| LOW | Timestamp Disclosure - Unix | 5 |
| LOW | Dangerous JS Functions | 1 |
| INFO | Modern Web Application / Non-Storable / Storable / User Agent Fuzzer | 1–5 cada |

**Backup File Disclosure com 31 instâncias** é o achado que mais separa este
scan do controle negativo — típico do Juice Shop, que propositalmente expõe
arquivos de backup/configuração (`.bak`, `.old`, `.orig` etc.) em vários
caminhos como um dos desafios OWASP do próprio app. É exatamente o tipo de
achado que demonstra o scanner funcionando contra uma superfície real, não
um resultado genérico.

## Reproduzir

```bash
# alvo controle negativo — qualquer site estático serve
# (não precisa DAST_ALLOW_PRIVATE_TARGETS)

# alvo controle positivo — Juice Shop local
docker run -d --rm -p 3500:3000 --name juice-shop bkimminich/juice-shop
# no .env da API: DAST_ALLOW_PRIVATE_TARGETS=true (loopback/rede local)
```

Depois, pela UI: **DAST → Novo scan → `http://host.docker.internal:3500`**
(se a API roda em container) ou `http://localhost:3500` (API rodando local).
Ver `docs/DAST.md` §8 para outros alvos de laboratório (DVWA, Mutillidae II,
bWAPP).

## Arquivos

- `dast-scan-example-com.html` / `.json` — relatório completo do ZAP contra `example.com`
- `dast-scan-juice-shop.html` / `.json` — relatório completo do ZAP contra o Juice Shop

Os `.html` são o relatório original do ZAP (o mesmo que a UI do Vulnera serve
em `<iframe sandbox>` a partir de `/dast/scans/:id/report`); os `.json` são a
saída estruturada que `dast-findings.service.ts` consome para persistir os
`DastFinding` normalizados.

## Relacionado

- `docs/DAST.md` — documentação técnica completa do módulo
- `docs/Vulnera/07-Decisoes/ADR-028 - Execucao do ZAP via Docker spawn.md`
- `docs/Vulnera/07-Decisoes/ADR-029 - DAST como silo.md`
- `docs/evidencias/zap/README.md` — baseline de segurança da própria stack Vulnera (não confundir, ver aviso no topo)

---

## Medição de recursos — 2026-09-09 (Fase 9.2)

Evidência do que motivou os limites por container documentados em
[[ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST]] §4.
Coletada com `docker stats --no-stream` durante **dois scans reais
simultâneos**, na stack completa (`docker compose up`, entrada em :8086),
numa máquina com 12 CPUs lógicas e ~7.7GiB alocados à VM do Docker.

**Antes** (watchdog limitando 2 scans, sem limite de recurso por container):

```
NAME                                    MEM USAGE / LIMIT     CPU %
vulnera-zap-cmtumyyib0007rq01sq6wk8e0   936.8MiB / 7.7GiB     398.83%
vulnera-zap-cmtumyyg30003rq01zxtp8189   1.39GiB  / 7.7GiB     564.60%
```

O `LIMIT` de 7.7GiB é a RAM inteira da VM — ou seja, **nenhum teto**: o
número que aparece ali é o total disponível, não um limite aplicado. Somados,
os dois containers ocupavam ~960% de 1200% de CPU.

**Depois** (`DAST_ZAP_MEMORY=2g`, `DAST_ZAP_CPUS=4`, `-Xmx` derivado):

```
NAME                                    MEM USAGE / LIMIT     CPU %
vulnera-zap-cmtuowzka0045lp01tlvgsddr   912.3MiB / 2GiB       64.22%
vulnera-zap-cmtuovyjj003mlp01hh4b2bn0   599.6MiB / 2GiB        4.27%
```

Confirmação de que os limites chegam ao container (`docker inspect`):

```
Memory=2147483648  MemorySwap=2147483648  NanoCpus=4000000000
Cmd=["zap.sh","-Xmx1331m","-daemon","-host","0.0.0.0","-port","8080", ...]
```

O `-Xmx1331m` (65% de 2048MB) é o que impede a JVM de pedir heap com base na
RAM do **host** e morrer por OOM do cgroup — ver o aviso em `docs/DAST.md` §7.

### Verificação do limite de concorrência

Três scans disparados na mesma janela, com `DAST_MAX_CONCURRENT_SCANS=2`:

```
$ docker ps --filter "name=vulnera-zap" --format "{{.Names}}"
vulnera-zap-cmtumyyib0007rq01sq6wk8e0
vulnera-zap-cmtumyyg30003rq01zxtp8189      <- exatamente 2, nunca 3

$ GET /api/dast/scans/status
running: 2 / 2 | queued: 1
NA FILA: 1º https://example.net/
ALERTAS: "Limite de 2 scans simultâneos atingido — este entrou na fila (posição 1)."
```

O terceiro entrou em execução sozinho quando a primeira vaga liberou (FIFO),
sem intervenção. Os três concluíram com `simulated: false` em 39-52s.
