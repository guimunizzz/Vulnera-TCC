<!-- Apresenta o produto, sua execução local e as evidências verificadas; consumido pela banca e pelos colaboradores. -->

<div align="center" style="padding: 24px; border-radius: 16px; border: 1px solid #7c3aed;">
  <h1>Vulnera</h1>
  <p><strong>Da descoberta ao acompanhamento da correção.</strong></p>
  <p>Plataforma de gestão de vulnerabilidades, análises DAST, importação SAST/SCA e remediação com isolamento por empresa.</p>
  <p>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" />
    <img alt="OWASP ZAP" src="https://img.shields.io/badge/OWASP-ZAP-00549E?style=flat-square" />
    <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
  </p>
  <p><a href="#executar-localmente">Executar</a> · <a href="#fluxo-do-produto">Funcionalidades</a> · <a href="#dast-e-descoberta-de-endpoints">DAST</a> · <a href="#fila-e-agendamentos">Fila</a> · <a href="#sastsca-relatórios-de-código-e-dependências">SAST/SCA</a> · <a href="#evidências-da-interface">Evidências</a> · <a href="#documentação">Documentação</a></p>
</div>

Projeto de TCC. O Vulnera reúne inventário de aplicações, projetos de análise,
findings revisados por profissionais e acompanhamento da remediação. O ZAP
automatiza a descoberta e a análise passiva, e relatórios de Semgrep, CodeQL e
Trivy (SARIF e CycloneDX) trazem o que está no código e nas dependências; a
triagem e a classificação CVSS continuam exigindo revisão humana.

> O GitHub sanitiza o HTML dos READMEs e pode remover atributos `style`. Os
> blocos abaixo usam também estrutura semântica, alinhamento e tabelas para
> permanecerem legíveis sem CSS inline. [Referência do GitHub](https://github.com/github/markup#github-markup).

## Fluxo do produto

```mermaid
flowchart LR
    A[Empresa e assinatura] --> B[Aplicação]
    B --> C[Projeto e equipe]
    C --> D[Scan DAST autorizado]
    C --> S[Importação SAST/SCA]
    D --> E[Triagem dos achados]
    S --> E
    E --> F[Promoção manual + revisão CVSS]
    F --> G[SLA, prioridade e remediação]
    G --> H[Relatórios e acompanhamento]
```

<table>
  <thead><tr><th>Área</th><th>O que o produto oferece</th></tr></thead>
  <tbody>
    <tr><td><strong>Inventário e projetos</strong></td><td>Aplicações por empresa, limites de plano, wizard de criação de projeto e equipe de pentesters.</td></tr>
    <tr><td><strong>Findings</strong></td><td>Busca global, filtros e consultas salvas; exportação em CSV e em <strong>Excel formatado</strong> (dashboard, acompanhamento); CVSS 3.1, severidade calculada e override justificado com auditoria.</td></tr>
    <tr><td><strong>DAST</strong></td><td>Modo Real explícito, Spider tradicional do ZAP, análise passiva, progresso, fila, cancelamento, HTML original e PDF.</td></tr>
    <tr><td><strong>SAST/SCA</strong> <sub>new</sub></td><td>Importação de SARIF 2.1.0 (Semgrep, CodeQL, Trivy...) e SBOM CycloneDX por projeto; comparação com a importação anterior, triagem herdada, promoção com CVSS revisado e PDF próprio.</td></tr>
    <tr><td><strong>Gestão dos achados</strong></td><td>Triagem com nota, promoção manual para vulnerabilidade de um projeto e comparação entre execuções reais do mesmo alvo.</td></tr>
    <tr><td><strong>Remediação</strong></td><td>Responsável, comentários e evidências; quadro de correção, SLA por severidade e Vulnera Risk Score com contexto da aplicação.</td></tr>
    <tr><td><strong>Aceite e playbooks</strong></td><td>Aceite formal de risco com revisão e validade; catálogo OWASP Top 10 e playbooks personalizados por empresa.</td></tr>
    <tr><td><strong>Relatórios e maturidade</strong></td><td>PDFs executivo, técnico e DAST gerados no navegador; avaliação de maturidade por domínio.</td></tr>
    <tr><td><strong>Mobile</strong></td><td>Aplicativo Expo de consulta para CLIENT e infraestrutura de notificações push. Celular físico não foi validado nesta rodada.</td></tr>
  </tbody>
</table>

<table>
  <thead><tr><th>Perfil</th><th>Atuação principal</th></tr></thead>
  <tbody>
    <tr><td>ADMIN</td><td>Gestão administrativa, aprovação de assinaturas e acesso global aos scans.</td></tr>
    <tr><td>PENTESTER</td><td>Execução e triagem dos próprios scans; importação SAST/SCA, triagem e promoção nos projetos dos quais é membro.</td></tr>
    <tr><td>CLIENT</td><td>Acompanhamento e operações autorizadas dentro da própria empresa; sem acesso aos módulos DAST e SAST/SCA (achado de ferramenta não triado).</td></tr>
  </tbody>
</table>

## Evidências da interface

Capturas de **09/10/2026**, na stack Docker real. O scan com Spider usa uma
fixture local controlada para comprovar descoberta; seus achados não descrevem
a aplicação do colega. O cenário LAN anterior foi preservado e está no
[relatório da primeira validação](docs/DAST-REDE-VALIDACAO-2026-10-09.md).

<div align="center" style="margin: 16px 0; padding: 12px; border-radius: 12px;">
  <a href="docs/evidencias/screenshots/2026-10-09-dast-spider-result.jpg"><img src="docs/evidencias/screenshots/2026-10-09-dast-spider-result.jpg" alt="Execução real do Spider concluída, com contadores e URLs nos achados" width="100%" /></a>
  <p><strong>Spider real + análise passiva.</strong> Resultado observado, sem fallback para demonstração.</p>
</div>

<table>
  <thead><tr><th>Relatório original do ZAP</th><th>Vulnerabilidade promovida e em correção</th></tr></thead>
  <tbody><tr>
    <td><a href="docs/evidencias/screenshots/2026-10-09-dast-spider-zap.jpg"><img src="docs/evidencias/screenshots/2026-10-09-dast-spider-zap.jpg" alt="Relatório HTML original gerado pelo ZAP no scan da fixture" width="600" /></a></td>
    <td><a href="docs/evidencias/screenshots/2026-10-09-dast-vulnerability.jpg"><img src="docs/evidencias/screenshots/2026-10-09-dast-vulnerability.jpg" alt="Vulnerabilidade de origem DAST com comentário e status em correção no cenário LAN" width="600" /></a></td>
  </tr></tbody>
</table>

<details>
<summary>Galeria histórica — agosto de 2026</summary>

Capturas da TechNova usadas na apresentação original; não representam o visual mais recente.

<table>
  <tr><th>Login</th><th>Dashboard ADMIN</th></tr>
  <tr><td><img src="docs/evidencias/screenshots/01-login.png" alt="Login histórico" width="600" /></td><td><img src="docs/evidencias/screenshots/03-dashboard-admin.png" alt="Dashboard histórico" width="600" /></td></tr>
  <tr><th>Projetos</th><th>Maturidade</th></tr>
  <tr><td><img src="docs/evidencias/screenshots/05-projects.png" alt="Projetos históricos" width="600" /></td><td><img src="docs/evidencias/screenshots/04-maturidade.png" alt="Avaliação de maturidade histórica" width="600" /></td></tr>
</table>

</details>

## Executar localmente

Docker Desktop com Docker Compose é o caminho usado na validação. As imagens
do projeto usam Node 22; a primeira execução DAST também precisa baixar a
imagem do ZAP e pode demorar mais.

```bash
git clone --branch main https://github.com/guimunizzz/Vulnera-TCC.git
cd Vulnera-TCC
docker compose up -d --build
docker compose ps
```

O assistente inicia com ajuda local. Para habilitar Gemini no Docker, copie
[`.env.example`](.env.example) para `.env` **na raiz**, ao lado de
`docker-compose.yml`, e preencha a chave somente nesse arquivo privado:

```dotenv
ASSISTANT_MODE=gemini
GEMINI_API_KEY=COLE_SUA_CHAVE_SOMENTE_NO_ENV_LOCAL
GEMINI_MODEL=
```

Preencha `GEMINI_MODEL` com o identificador permitido no seu projeto somente no
`.env` privado; o exemplo público deixa esse valor vazio.
Se já existir `.env`, acrescente ou ajuste apenas essas variáveis, preservando
as demais. O `.env` é ignorado pelo Git; o exemplo versionado mantém a chave
vazia. Cada instalação precisa receber sua credencial privadamente; clonar ou
fazer pull não baixa segredos. `app/api/.env` é usado na execução pelo host e
não substitui o `.env` da raiz para o Compose. Confira o Free Tier no AI Studio
antes de usar. Para aplicar mudanças nas variáveis de uma stack existente,
recrie somente a API **sem scans ativos**, conforme o
[guia do assistente](docs/ASSISTENTE_VULNERA.md#configuração).

Quando a API estiver saudável, prepare os dados de demonstração em uma
instalação nova:

```bash
docker compose exec api npm run db:seed
docker compose exec api npm run db:seed:playbooks
```

Migrations pendentes são aplicadas no início da API. Os seeds são manuais;
não é necessário repeti-los para testar o Spider em uma instalação existente.
O catálogo OWASP usa um snapshot versionado e funciona sem acesso à Internet.

<table>
  <thead><tr><th>Serviço</th><th>Endereço no host</th><th>Uso</th></tr></thead>
  <tbody>
    <tr><td>Web</td><td><a href="http://localhost:8086">localhost:8086</a></td><td>Entrada do produto</td></tr>
    <tr><td>API</td><td><a href="http://localhost:3001/api/health">localhost:3001/api</a></td><td>Express e healthcheck</td></tr>
    <tr><td>MySQL</td><td>localhost:3307</td><td>Porta externa; a API em Docker usa db:3306</td></tr>
    <tr><td>Mailhog</td><td><a href="http://localhost:8025">localhost:8025</a></td><td>Caixa local para desenvolvimento</td></tr>
  </tbody>
</table>

Credenciais e roteiro: [DEMO.md](docs/DEMO.md). Para acompanhar problemas:
`docker compose logs --tail=100 api web`. A stack e o socket Docker são
destinados ao desenvolvimento e à demonstração; não constituem um deploy
de produção.

<details>
<summary>Desenvolvimento no host com hot reload</summary>

```bash
docker compose up -d db mailhog
npm install
```

Copie `app/api/.env.example` para `app/api/.env`. Para usar o banco do Compose
e o servidor atual, ajuste explicitamente:

```dotenv
PORT=3001
DATABASE_URL=mysql://vulnera:vulnera@localhost:3307/vulnera
CORS_ORIGIN=http://localhost:3000
DAST_ZAP_NETWORK=
```

A API lê `PORT` (o `.env.example` já usa esse nome). Configure os segredos
JWT locais e não versione o `.env`.

```bash
cd app/api
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:seed:playbooks
npm run dev
```

Em outro terminal, `cd app/web` e `npm run dev` (porta 3000).
Para mobile, instale as dependências em `app/mobile`, configure o IP da API
na rede local e execute `npx expo start`; consulte o roteiro antes de usar
um dispositivo físico.

</details>

## DAST e descoberta de endpoints

1. Cadastre a aplicação e o projeto para depois gerenciar os achados.
2. Entre como ADMIN/PENTESTER, abra **DAST → Novo scan** e informe o alvo autorizado.
3. Escolha **Real — análise passiva**, confira a URL e marque a autorização.
4. Acompanhe **início → Spider → análise passiva → relatórios**.
5. Revise os achados, registre a triagem e promova manualmente os relevantes;
   revise o CVSS antes de salvar. Continue pelo fluxo de remediação.

<table>
  <thead><tr><th>Real</th><th>Simulado</th></tr></thead>
  <tbody><tr>
    <td>Container ZAP por execução; Spider tradicional descobre links, recursos, robots.txt e sitemap; regras passivas analisam as respostas. Falha termina FAILED.</td>
    <td>Gera achados fictícios sem executar ZAP ou enviar tráfego ao alvo. Permite demonstrar triagem; promoção e comparação operacional ficam bloqueadas.</td>
  </tr></tbody>
</table>

Alvos HTTP/HTTPS internos e públicos são aceitos sem flag de rede privada.
Credenciais embutidas e outros protocolos são recusados. O alvo precisa ser
alcançável **do ZAP**, não apenas do navegador do usuário.

<table>
  <tr><th>Onde roda o alvo</th><th>Endereço a informar</th></tr>
  <tr><td>Outra máquina na LAN</td><td>http://&lt;ip-da-máquina&gt;:&lt;porta&gt;/ — Vite precisa escutar na rede e o firewall permitir a porta</td></tr>
  <tr><td>Host do Docker Desktop</td><td>http://host.docker.internal:&lt;porta&gt;/</td></tr>
  <tr><td>Container na vulnera-net</td><td>http://&lt;nome-do-container&gt;:&lt;porta-interna&gt;/</td></tr>
</table>

`localhost` dentro do ZAP aponta para o próprio container. O Spider fica na
origem e subárvore informadas, exclui queries e caminhos sensíveis e não
processa/envia formulários. Ele não executa JavaScript: rotas exclusivamente
dinâmicas de uma SPA podem permanecer fora da descoberta. Não há active scan.

<table>
  <tr><th>Limite padrão</th><th>Valor</th></tr>
  <tr><td>Scans concorrentes / recursos por ZAP</td><td>1 / 2 GiB / 2 CPUs</td></tr>
  <tr><td>Spider</td><td>1 minuto; profundidade 2; 30 filhos por nó; 1 thread; parsing até 1 MB</td></tr>
  <tr><td>Prazo global do scan</td><td>30 minutos; watchdog e cancelamento cooperativo</td></tr>
</table>

30 filhos por nó não é um teto global de 30 páginas. O tempo do Spider pode
ser configurado por `DAST_ZAP_SPIDER_MAX_DURATION_MIN` (1–10 min).
Zero achados ou conclusão do Spider não comprovam ausência de vulnerabilidades
nem cobertura completa. O PDF identifica o perfil registrado por execução;
scans históricos sem metadados não recebem a metodologia nova retroativamente.

## Fila e agendamentos

A fila de jobs tem dois motores, escolhidos por `QUEUE_DRIVER`
([ADR-056](docs/Vulnera/07-Decisoes/ADR-056%20-%20Fila%20BullMQ%20com%20worker%20desacoplavel%20e%20scans%20DAST%20agendados.md),
status **proposta**):

<table>
  <thead><tr><th><code>memory</code> (padrão)</th><th><code>bullmq</code></th></tr></thead>
  <tbody><tr>
    <td>Comportamento de sempre: fila DAST no watchdog em memória e <code>setInterval</code> da Threat Intel. Num restart, scans na fila viram FAILED. Não há scan agendado.</td>
    <td>Fila persistente no Redis. Scan na fila sobrevive a restart; Threat Intel vira job scheduler <code>threat-intel-sync</code>; scans DAST agendados por aplicação disparam pelo worker.</td>
  </tr></tbody>
</table>

```mermaid
flowchart LR
  API["API Express<br/>POST /dast/scans · sync manual<br/>CRUD de agendamentos"] -- "job { scanId } / { scheduleId }" --> R[("Redis 8.8<br/>só rede interna, com senha")]
  DB[("MySQL<br/>ScanSchedule = fonte da verdade")] -- "reconciliador<br/>dast-schedule:&lt;id&gt;" --> R
  R --> W["worker.ts<br/>(no processo da API por padrão)"]
  W -- "recarrega tudo pelo id<br/>e reconfere a autorização" --> DB
  W -- "docker run (DooD)" --> Z["ZAP por scan"]
```

- **DAST:** `jobId = scanId`, concorrência `DAST_MAX_CONCURRENT_SCANS`, sem retry
  automático contra o alvo. O worker só roda scan ainda `QUEUED` (tomada
  atômica), então job repetido ou scan cancelado não executa. Redis fora do ar:
  `POST /dast/scans` responde **503 `QUEUE_UNAVAILABLE`** em até 5 s e o scan
  fica guardado no banco para voltar à fila.
- **Threat Intel:** agendamento de id fixo (piso de 15 min), concorrência 1,
  retry com backoff só para falha transitória; "Sincronizar agora" vira job
  `MANUAL`.
- **Scans agendados:** diário ou semanal, modo REAL ou SIMULADO fixo, só com
  autorização do alvo registrada na aplicação (quem, até quando, host). A
  autorização, a empresa, o criador e o alvo livre são conferidos **na hora de
  rodar**; se algo falhar, o scan não roda e o motivo fica em `lastOutcome`.
  API: `/api/applications/:id/dast-authorization` e
  `/api/applications/:id/dast-schedules` (ADMIN e PENTESTER membro escrevem;
  CLIENT da empresa só lê). A tela web ainda não existe.

> [!IMPORTANT]
> **O Redis não é exposto.** O serviço `redis` do compose não publica porta no
> host, só a rede `vulnera-net` o alcança, e toda conexão exige senha. O payload
> dos jobs leva apenas ids; o worker recarrega e reconfere tudo no banco.

> [!TIP]
> **Voltar para `QUEUE_DRIVER=memory`:** defina `QUEUE_DRIVER=memory` (ou
> remova a variável) e rode `docker compose up -d api`. Não há migration a
> desfazer. Com `memory`, o cadastro de agendamentos continua funcionando, mas
> nada dispara.

> [!WARNING]
> Pendente: o scan **REAL** pela fila `bullmq` ainda não foi validado e a troca
> do padrão para `bullmq` não foi decidida. Até lá, o padrão segue `memory`.

<details>
<summary>Variáveis de ambiente e worker separado</summary>

| Variável | Padrão | Uso |
|---|---|---|
| `QUEUE_DRIVER` | `memory` | `memory` ou `bullmq` |
| `REDIS_URL` | (compose monta a partir da senha) | `redis://:<senha>@redis:6379`; obrigatória só com `bullmq` |
| `REDIS_PASSWORD` | default de dev no compose | senha do Redis; troque fora da máquina local |
| `WORKER_IN_PROCESS` | `true` | `false` tira os workers da API |
| `THREAT_INTEL_SYNC_ENABLED` | `true` | `false` remove o agendamento da Threat Intel |
| `THREAT_INTEL_SYNC_INTERVAL_MIN` | `360` | intervalo em minutos, mínimo 15 |
| `DAST_MAX_CONCURRENT_SCANS` | `1` | scans simultâneos (= concorrência do worker DAST) |

Para rodar o worker como processo próprio: `WORKER_IN_PROCESS=false` na API e
um processo com `npm run worker` (na imagem da API, `node dist/worker.js`), com
as mesmas variáveis. Fora do Docker, o Redis do compose não é alcançável
porque não publica porta.

</details>

## SAST/SCA: relatórios de código e dependências

O Vulnera **não executa** os scanners de código: ele importa o relatório que a
pipeline já gera e aplica a ele o fluxo de gestão do produto
([ADR-052](docs/Vulnera/07-Decisoes/ADR-052%20-%20Importacao%20SAST%20e%20SCA%20por%20SARIF%20e%20CycloneDX.md),
[guia completo](docs/SAST_SCA.md)).

1. Gere o relatório, por exemplo `semgrep scan --config p/default --sarif --output semgrep.sarif`
   ou `trivy fs --scanners vuln --format cyclonedx --output sbom.cdx.json .`.
2. Abra **SAST/SCA** no menu (ou a aba do projeto), clique em **Importar
   relatório**, escolha o projeto e solte o arquivo. O botão **?** ao lado
   explica o fluxo e traz os comandos prontos para copiar.
3. Trie os achados (confirmado, falso-positivo, risco aceito) e promova os
   relevantes, revisando o vetor CVSS.
4. Importe a próxima versão: a aba **Comparação** mostra o que é novo, o que
   continua (com a triagem preservada) e o que foi resolvido. Os resolvidos que
   já eram vulnerabilidades ficam marcados para reteste.
5. A aba **Security Graph** mostra onde estão os problemas: aplicação →
   código (pasta, arquivo) e dependências (pacote) → achados, com os mesmos
   layouts, zoom e exportação do CyberGraph.
6. **Baixar PDF** gera o relatório da importação.

Na primeira visita, um **tour guiado** apresenta o módulo (com **Pular tour**;
**Ver tour** repete).

<table>
  <tr><th>Ponto</th><th>Como funciona</th></tr>
  <tr><td>Formatos</td><td>SARIF 2.1.0 e CycloneDX ≥ 1.4 com <code>vulnerabilities</code>; até 10 MB e 5.000 achados (acima disso é recusado, nunca truncado).</td></tr>
  <tr><td>Reimportação</td><td>Fingerprint estável por ferramenta, regra, arquivo e fingerprint da ferramenta (ou pacote@versão); compara com a importação anterior do mesmo projeto e ferramenta.</td></tr>
  <tr><td>Promoção</td><td>Destino é o projeto da importação; score calculado do vetor confirmado (RN10); vetor do NVD sugerido quando o SBOM traz; sem duplicar entre importações.</td></tr>
  <tr><td>Acesso</td><td>ADMIN e PENTESTER membro do projeto; <code>companyId</code> herdado do projeto; CLIENT recebe 403.</td></tr>
</table>

<div align="center" style="margin: 16px 0; padding: 12px; border-radius: 12px;">
  <a href="docs/evidencias/sast-sca/08-comparacao-resolvidos-com-vulnerabilidade-para-retestar.jpg"><img src="docs/evidencias/sast-sca/06-reimportacao-novos-resolvidos-triagem-herdada.jpg" alt="Reimportação do relatório Semgrep do NodeGoat depois da correção: 29 achados, 0 novos e 6 resolvidos, com a triagem preservada" width="100%" /></a>
  <p><strong>Semgrep real no OWASP NodeGoat, antes e depois de corrigir os <code>eval</code>.</strong> 6 achados resolvidos e a triagem anterior preservada.</p>
</div>

<table>
  <thead><tr><th>SBOM do Trivy: promoção com o vetor do NVD</th><th>Página global SAST/SCA</th></tr></thead>
  <tbody><tr>
    <td><a href="docs/evidencias/sast-sca/10-promover-sca-vetor-da-ferramenta.jpg"><img src="docs/evidencias/sast-sca/10-promover-sca-vetor-da-ferramenta.jpg" alt="Promoção de uma CVE do SBOM do Trivy com vetor CVSS informado pela ferramenta e categoria A06" width="600" /></a></td>
    <td><a href="docs/evidencias/sast-sca/12-pagina-global-sast-sca.jpg"><img src="docs/evidencias/sast-sca/12-pagina-global-sast-sca.jpg" alt="Página SAST/SCA com números das últimas importações e a lista por projeto" width="600" /></a></td>
  </tr></tbody>
</table>

## Stack e arquitetura

<table>
  <tr><th>Camada</th><th>Tecnologias e organização</th></tr>
  <tr><td>API</td><td>Node.js, Express 5, TypeScript; controllers, services e repositories montados por Factory Method</td></tr>
  <tr><td>Banco</td><td>Prisma ORM e MySQL 8</td></tr>
  <tr><td>Web</td><td>React, Vite, TanStack Query, Zustand, Tailwind e design system próprio</td></tr>
  <tr><td>PDF</td><td>pdf-lib no navegador; apenas metadados persistidos na API</td></tr>
  <tr><td>Mobile</td><td>Expo / React Native / Expo Notifications</td></tr>
  <tr><td>DAST</td><td>ZAP daemon efêmero, Spider tradicional e scanner passivo</td></tr>
  <tr><td>Testes</td><td>Jest + Supertest na API; Vitest + Testing Library + axe-core no web; cenários Playwright disponíveis</td></tr>
  <tr><td>CI atual</td><td>GitHub Actions: testes/cobertura API e SonarQube em pushes/PRs para main; não executa o check web completo</td></tr>
</table>

```mermaid
flowchart TB
    Browser[Navegador] --> Web[Web :8086]
    Browser --> API[API :3001]
    Mobile[Mobile CLIENT] --> API
    API --> DB[(MySQL)]
    API --> Files[(Evidências e relatórios)]
    API -->|Docker socket / rede vulnera-net| ZAP[ZAP por scan]
    ZAP -->|Spider autorizado| Target[Alvo HTTP/HTTPS]
    ZAP --> Passive[Análise passiva]
    Passive -->|JSON e HTML| API
    Browser --> PDF[PDF gerado no cliente]
```

Autenticação JWT com access de 15 minutos e refresh rotativo de 7 dias,
senhas bcrypt, ownership no service e isolamento por empresa. Uploads passam
por validação de conteúdo; relatórios HTML do ZAP recebem CSP sandbox.
O rate limiting usa Token Bucket em memória com camadas global, tenant,
usuário, escrita e endpoints específicos.

## Validação atual

**13/11/2026 — SAST/SCA (branch `feat/sast-sca-ingestion`).**

<table>
  <tr><th>Verificação</th><th>Resultado</th></tr>
  <tr><td>API</td><td>818/819 testes em 55 suítes, já com a `dev` do PR #71 (32 novos: 17 do parser e 15 de integração, com tenancy negativa); tsc limpo. A falha é o FX-I-01 da exportação Excel, que não foi alterada: numa instalação limpa entra o <code>content-disposition</code> 2.x, que tira as aspas do <code>filename</code> (pendência API-FUT-02).</td></tr>
  <tr><td>Web</td><td>594/594 testes em 68 arquivos (35 novos, com Security Graph, tour e o guia de importação); build aprovado; lint 0 erros/9 avisos anteriores; contraste 132 pares, 0 falhas.</td></tr>
  <tr><td>Ferramentas reais</td><td>Semgrep 1.184.0 e Trivy 0.76.2 contra OWASP NodeGoat e Juice Shop; reimportação depois de uma correção real (6 resolvidos); fluxo completo pela interface com 0 erros de console. Ver <a href="docs/evidencias/sast-sca/README.md">evidências</a>.</td></tr>
</table>

**09/10/2026 — Spider, relatórios e documentação conferidos na stack Docker.**

<table>
  <tr><th>Verificação</th><th>Resultado desta entrega</th></tr>
  <tr><td>API</td><td>642/642 testes em 43 suítes; focal DAST 104/104; build e lint dos fontes alterados aprovados.</td></tr>
  <tr><td>Web</td><td>338/338 testes em 30 suítes; lint 0 erros/9 avisos anteriores; contraste 66/66; build Docker aprovado.</td></tr>
  <tr><td>Docker e scan real</td><td>ZAP 2.17.0; scan real concluído em 26,641 s, 9 URLs descobertas e 14 findings (0H/9M/5L/0I). Tráfego da fixture: 10 GETs, sem query, formulários ou outra origem.</td></tr>
  <tr><td>Interface e PDF</td><td>Formulário, confirmação, acompanhamento, resultados e HTML original conferidos. PDFs novo (9 páginas) e histórico (5 páginas) exportados e inspecionados. Vulnerabilidade promovida no cenário LAN com status em andamento, comentário, VRS e SLA.</td></tr>
</table>

O `npm run check` global da API permanece bloqueado por dois imports não
usados preexistentes em `vulnerability.service.ts:45`; testes são executados
separadamente e o lint dos fontes alterados é conferido. A evidência atual
não substitui testes manuais de mobile nem uma reanálise dos alertas SAST.

```bash
# Em app/api — exige o banco de teste separado configurado em .env.test
npm run check
npm run test -- --silent
npm run build

# Em app/web
npm run check -- -- --maxWorkers=1
npm run build
```

Evidências históricas de [ZAP](docs/evidencias/zap/README.md),
[SonarQube](docs/evidencias/sonarqube/) e [remediação](docs/EXPOSURE_REMEDIATION.md)
mantêm suas próprias datas e limites. Relatório desta atualização:
[Spider e README](docs/DAST-SPIDER-VALIDACAO-2026-10-09.md).

## Limites e próximos passos

<table>
  <tr><th>Área</th><th>Limite atual</th></tr>
  <tr><td>SAST/SCA</td><td>Importa relatórios, não executa scanners nem confirma exploração; sem ingestão direta pela CI nem consulta própria a OSV/NVD para SBOM sem CVEs.</td></tr>
  <tr><td>DAST</td><td>Sem autenticação no alvo, execução JavaScript/AJAX ou exploração ativa. Queries e caminhos sensíveis são excluídos; não garante descoberta completa.</td></tr>
  <tr><td>Rede e execução</td><td>Sem bloqueio SSRF por faixa de endereço, conforme ADR-045. Contas de scan alcançam serviços HTTP acessíveis ao ZAP. Socket Docker é adequado à demonstração local.</td></tr>
  <tr><td>Fila e rate limiting</td><td>Padrão <code>memory</code>: fila em memória por instância, sem retomada após restart. Com <code>QUEUE_DRIVER=bullmq</code> a fila persiste no Redis (ADR-056), mas o scan REAL por ela ainda não foi validado. Rate limiting segue em memória, sem cotas distribuídas.</td></tr>
  <tr><td>Builds</td><td>Dockerfiles resolvem ranges com npm install; a árvore não é totalmente fixada pelo lockfile do workspace. Split web é parcial e o bundle principal ainda é grande.</td></tr>
  <tr><td>Qualidade</td><td>Lint API preexistente pendente, alertas SAST em revisão e revisão de dependências no backlog. CWE/WASC -1 ainda aparecem como sentinelas no PDF.</td></tr>
  <tr><td>Produto</td><td>Sem exclusão de Evidence; pagamento e aprovação comercial não integram cobrança real; push em celular físico não validado nesta rodada.</td></tr>
</table>

<details>
<summary>Fora do MVP / trabalho futuro</summary>

Geração de findings ou cálculo de severidade por IA, chat em tempo real, tickets de suporte, e-mail transacional, pagamento
real, reset de senha, i18n, filas distribuídas e deploy de produção ficam
fora do MVP. Exposure Graph e pesos de VRS por empresa permanecem planejados.
Consulte o [backlog](docs/BACKLOG.md) antes de iniciar novas features.

</details>

O **Assistente Vulnera**, introduzido em 23/10/2026, oferece orientação nas
telas protegidas da web, com mascote, atalhos permitidos, Gemini opcional e
ajuda local identificada. Não consulta registros nem executa alterações.
Configuração segura, condições do Free Tier e roteiro de três minutos em
[ASSISTENTE_VULNERA.md](docs/ASSISTENTE_VULNERA.md). A integração ao vivo com
Gemini ainda depende de chave/modelo e validação no projeto da demonstração.

## Documentação

<table>
  <tr><th>Documento</th><th>Conteúdo</th></tr>
  <tr><td><a href="AGENTS.md">AGENTS.md</a> / <a href="PRD_VIVO.md">PRD_VIVO.md</a></td><td>Convenções e estado de implementação</td></tr>
  <tr><td><a href="docs/DEMO.md">Demo</a></td><td>Credenciais e roteiro de apresentação</td></tr>
  <tr><td><a href="docs/ASSISTENTE_VULNERA.md">Assistente Vulnera</a></td><td>Orientação contextual, Gemini/local, limites e roteiro de três minutos</td></tr>
  <tr><td><a href="docs/DAST.md">DAST</a></td><td>Modos, execução, configuração e diagnóstico</td></tr>
  <tr><td><a href="docs/SAST_SCA.md">SAST/SCA</a></td><td>Importação de SARIF e CycloneDX, regras de reimportação, API, segurança e validação com Semgrep/Trivy reais</td></tr>
  <tr><td><a href="docs/EXPOSURE_REMEDIATION.md">Exposure &amp; Remediation</a></td><td>SLA, VRS, aceite de risco, playbooks e quadro</td></tr>
  <tr><td><a href="docs/FINDINGS_QUERY.md">Findings query</a> / <a href="docs/DESIGN_SYSTEM.md">Design system</a></td><td>Busca, componentes e acessibilidade</td></tr>
  <tr><td><a href="docs/FINDINGS_EXCEL_EXPORT.md">Exportação Excel</a></td><td>Como usar, limites, segurança, decisões e validação</td></tr>
  <tr><td><a href="docs/Vulnera/07-Decisoes/">ADRs</a></td><td>Contexto, decisões arquiteturais e consequências</td></tr>
  <tr><td><a href="docs/BACKLOG.md">Backlog</a> / <a href="docs/ROADMAP_PROMPTS.md">Roadmap</a></td><td>Planejamento e histórico de entregas</td></tr>
</table>

```text
app/api/       Backend, Prisma, seeds e testes
app/web/       Produto web e PDFs
app/mobile/    Aplicativo Expo
docs/          Operação, evidências, roteiro e vault do domínio
AGENTS.md      Guia de implementação
PRD_VIVO.md    Memória viva do projeto
```

<details>
<summary>Contribuidores — registro histórico de agosto</summary>
<img width="100%" alt="Registro dos contribuidores em agosto" src="https://github.com/user-attachments/assets/a2c3002f-edd4-4eaf-8ce3-53eabf4c66fb" />
</details>

Vulnera — projeto de TCC. A documentação descreve o comportamento
implementado e mantém separados os resultados atuais e as evidências históricas.
