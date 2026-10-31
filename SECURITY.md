<!--
  O que faz: política de segurança do Vulnera e mapa dos controles implementados.
  Por que existe: quem avalia (banca, revisor, pentester) precisa saber como reportar
  uma falha e onde cada controle mora no código, sem ler o projeto inteiro.
  Quem consome: avaliadores, equipe do TCC e agentes de código.
-->

# Política de segurança — Vulnera

> **Estado em 2026-10-31.** Este documento descreve o que está **implementado e verificável no
> código**. Onde algo é plano e não realidade, está marcado como 🚧. Detalhes de arquitetura em
> [`docs/architecture.md`](docs/architecture.md) e no Vault (`docs/Vulnera/05-Infra-DevSecOps/`).

## Versões suportadas

O Vulnera é um projeto acadêmico (TCC SENAI) sem releases versionadas. Só a branch `main` recebe
correções de segurança; branches de feature são corrigidas antes do merge.

| Versão | Suporte |
| --- | --- |
| `main` | ✅ |
| branches de feature | corrigidas antes do merge |
| tags/forks antigos | ❌ |

## Como reportar uma vulnerabilidade

1. **Não abra issue pública** com detalhes de exploração.
2. Use o **GitHub Security Advisories** do repositório (*Security → Report a vulnerability*) ou escreva
   para a equipe pelo contato do repositório.
3. Inclua: versão/commit, passos para reproduzir, impacto esperado e, se tiver, prova de conceito.
4. Resposta inicial em até **5 dias úteis**; correção priorizada pela severidade (CVSS 3.1, a mesma
   régua que o produto usa para findings).

Testes de segurança contra instâncias que **não são suas** não são autorizados por este documento.

## Controles implementados

### Autenticação e sessão

| Controle | Onde | Detalhe |
| --- | --- | --- |
| Senha com bcrypt | `app/api/src/utils/hash.util.ts` | custo padrão 12 (`BCRYPT_COST`) |
| JWT de acesso curto | `app/api/src/utils/jwt.util.ts` | 15 min por padrão (`JWT_ACCESS_TTL`) |
| Refresh token rotativo | `app/api/src/services/auth.service.ts` | 7 dias, segredo próprio (`JWT_REFRESH_SECRET`) |
| Refresh centralizado no front | `app/web/src/lib/api/` | fila de requisições durante a renovação; sair limpa o cache da sessão |

### Autorização, tenancy e ownership

- **RBAC por middleware** (`require-role.middleware.ts`): CLIENT, PENTESTER e ADMIN. O módulo DAST
  inteiro é só PENTESTER/ADMIN; um CLIENT recebe 403 em **todas** as rotas DAST (teste
  `DAST-RBAC-01..09`).
- **Ownership no service, não no middleware** (regra SEC3 do `CLAUDE.md`): um PENTESTER só lê os
  próprios scans, findings e sensores (`getOwnedScan`); ADMIN lê todos. Coberto por testes negativos
  (`DAST-RBAC-08`, `DAST-SENS-02`).
- **Tenant derivado do usuário autenticado**, nunca aceito do corpo da requisição (regra SEC2).

### Entrada, saída e transporte

| Controle | Onde |
| --- | --- |
| Rate limiting global, por usuário e por endpoint (429 com `Retry-After`) | `rate-limit.middleware.ts`, [`docs/RATE_LIMITING.md`](docs/RATE_LIMITING.md) |
| CORS restrito à origem do front | `app/api/src/app.ts` |
| Upload de evidência: limite de tamanho no middleware e tipo real pelo *magic number* + lista de MIME permitidos | `upload.middleware.ts`, `evidence.service.ts` |
| Report HTML do ZAP servido com `Content-Security-Policy: sandbox` e `nosniff` | `dast-scan.controller.ts` |
| Front com CSP sem `unsafe-eval`, script inline só por hash, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` | `app/web/config/csp.ts` (conferido com `curl -I http://localhost:8086/`) |
| Links vindos de ferramentas externas (referências do ZAP) só viram `<a>` se forem `http(s)` | `cyber-graph-detalhes.tsx` |

### Segredos e configuração

- Segredos só por variável de ambiente, lidos via `EnvVar` + `EnvKeys`; `.env` nunca é versionado nem
  lido por agentes (regra E1). O modelo é `app/api/.env.example`.
- Lockfiles nunca são editados à mão (regra E4).

### Módulo DAST: o próprio scanner como superfície de ataque

O Vulnera dispara tráfego contra alvos. Por isso o scanner tem regras próprias:

- **Alvo validado**: só `http(s)`, sem credenciais embutidas na URL (`validateTargetUrl`). Alvos
  internos são permitidos por decisão de produto (o pentester testa redes autorizadas).
- **Escaneamento real exige confirmação explícita** (`confirmedRealScan: true`) e fica auditado
  (`AuditLog` com `CREATE`/`STATUS_CHANGE`). Na tela, a autorização é um checkbox no mesmo passo do
  alvo, e **trocar o alvo desmarca a autorização** (coberto por teste).
- **Só passivo**: ZAP limitado a Spider + varredura passiva; nada de active scan, Nuclei, Nmap,
  formulário ou login no alvo.
- **ZAP isolado em container por scan**, com limite de memória/CPU, executado com `execFile` (nunca
  shell) e derrubado no cancelamento ou no timeout do watchdog.
- **Sensor de headers** (`services/sensors/headers.sensor.ts`): **um** GET, corpo descartado sem ler,
  timeout de 10 s, redirects seguidos só dentro da **mesma origem** do alvo autorizado (no máximo 3).
  Um redirect para outro host não é seguido — evita SSRF por redirecionamento. A evidência de cookie
  guarda nome e atributos, **nunca o valor** (pode ser uma sessão real).
- **Sensor de certificado SSL/TLS** (`services/sensors/ssl.sensor.ts`): **um** handshake com o host e a
  porta do endereço autorizado, sem requisição HTTP e sem enviar dado; não tenta outras portas. Usa
  `rejectUnauthorized: false` **de propósito** — o sensor precisa enxergar o certificado ruim para
  relatá-lo — e lê a validade da cadeia de `socket.authorized`. Não há tráfego de aplicação nessa
  conexão, então aceitar o certificado não expõe dado nenhum.
- **Sensores de descoberta com fonte externa** (`internetdb.sensor.ts`, `nvd-cve.service.ts`,
  `crtsh.sensor.ts`): falam só com hosts **fixos no código** (`internetdb.shodan.io`,
  `services.nvd.nist.gov`, `crt.sh`), nunca com uma URL vinda do usuário ou de resposta de terceiro —
  não há SSRF por ali. O que sai do Vulnera: o **IP público** do alvo (para a Shodan), **IDs de CVE e
  CPEs** (para o NVD) e o **domínio** do alvo (para o crt.sh). Alvo que só resolve para IP privado ou
  nome interno vira `NOT_APPLICABLE` **sem** requisição externa (só a resolução de DNS). O ID de CVE é
  validado (`CVE-AAAA-NNNN…`) antes de entrar na URL do NVD. Respostas grandes têm teto de leitura
  (crt.sh 8 MB, HTML do fingerprint 64 KB). Subdomínios e portas descobertos **nunca** são acessados.
- **Chave do NVD** (`NVD_API_KEY`, opcional): lida por `EnvVar`, enviada só no header `apiKey` ao NVD,
  nunca logada nem devolvida pela API.
- **Falha não vira dado falso**: sensor que não consegue medir fica `UNAVAILABLE`/`ERROR` na tela, o
  scan conclui com aviso, e o modo real nunca cai em resultado simulado.
- **Achado automatizado não vira vulnerabilidade sozinho**: todo `DastFinding` nasce `NEW` e só vira
  `Vulnerability` por promoção humana, com vetor CVSS revisado (ADR-029/ADR-032).

### Cadeia de entrega

- CI no GitHub Actions (`.github/workflows/build.yml`) com testes, cobertura e SonarQube.
  `actions/checkout` e a action do SonarQube estão fixadas por SHA; `actions/setup-node@v4` ainda usa
  tag móvel 🚧.
- Migrations versionadas (`prisma migrate deploy` no boot da API), sem alteração manual de banco.

## O que ainda não está coberto 🚧

- Sem MFA nem bloqueio progressivo de conta além do rate limiting.
- `prefers-reduced-motion`/acessibilidade e desempenho não são controles de segurança, mas a
  visualização 3D ainda não foi medida em GPU fraca (SG-FUT-02).
- CVE da InternetDB é **potencial**: deduzida pela versão anunciada, sem validação no alvo. Entra
  com confiança baixa e rótulo "potencial · não validado"; confirmar é trabalho humano na triagem —
  ver [`DISCOVERY.md`](DISCOVERY.md).
- A InternetDB é gratuita só para uso não comercial; uso comercial do Vulnera exige licença.
- Sem pentest externo independente do próprio Vulnera.

## Referências

[`CLAUDE.md`](CLAUDE.md) §5 (regras SEC1–SEC5) · [`docs/DAST.md`](docs/DAST.md) ·
[`docs/RATE_LIMITING.md`](docs/RATE_LIMITING.md) · [`DISCOVERY.md`](DISCOVERY.md) ·
ADR-029, ADR-032, ADR-048 em `docs/Vulnera/07-Decisoes/`.
