<!-- Explica a Threat Intel do Vulnera: inventário, fontes (NVD, OSV, KEV, EPSS), sincronização, notificações, API, segurança, limites e a validação com fontes reais; consumido pelo time, pela banca e por quem for manter o módulo. -->

# Threat Intel — CVEs que afetam o que a empresa usa

> **ADR:** [ADR-053](Vulnera/07-Decisoes/ADR-053%20-%20Threat%20Intel%20com%20inventario%20de%20tecnologias%20e%20sincronizacao%20agendada.md) ·
> **Decisões:** D19 em [`DECISIONS.md`](DECISIONS.md) ·
> **Evidências:** [`docs/evidencias/threat-intel/`](evidencias/threat-intel/README.md) ·
> **Branch:** `feat/threat-intel` (2026-11-15)

O DAST, o SAST/SCA e o pentester encontram falhas **dentro** das aplicações. A
Threat Intel traz o que vem de **fora**: a CVE publicada hoje para a biblioteca
ou o servidor que a empresa usa. A empresa mapeia as tecnologias (ou confirma
as que o Vulnera já viu), e o Vulnera acompanha quatro fontes públicas, mostra
o que afeta e avisa no sino quando sai algo novo e grave.

## Como usar

1. **Threat Intel** no menu (selo *new*, para os três papéis).
2. Aba **Inventário**: confirme as **sugestões** (vindas de um SBOM importado no
   SAST/SCA ou do fingerprint de um scan DAST) ou **Adicionar tecnologia**:
   - **Pacote** — ecossistema (npm, PyPI, Maven, Go, NuGet, RubyGems,
     crates.io, Packagist), nome e versão. Casado pelo OSV.
   - **Produto** — fabricante e produto do dicionário CPE (busca no NVD; se o
     NVD não responder, digite à mão) e versão. Casado pelo NVD.
   - Sem versão, toda CVE casa e aparece **"versão não confirmada"**.
3. Ao confirmar, o Vulnera consulta as fontes **na hora** por aquela
   tecnologia: o que já existia aparece como **"já existia ao mapear"**, sem
   notificação.
4. Aba **Afeta você**: as CVEs que casaram, KEV e mais graves primeiro, com
   EPSS, versão corrigida, triagem e **Promover para vulnerabilidade**.
5. O **sino** no topo avisa CVE nova com CVSS ≥ 7 ou KEV, e CVE antiga que
   passou a ser explorada (KEV). Clicar leva à CVE, já aberta.
6. Aba **Feed de CVEs**: o que foi publicado nos últimos dias, com "Afeta
   você" quando casa. Aba **Fontes**: o resultado de cada fonte em cada
   execução (fonte fora do ar aparece com o motivo).

## Fontes

| Fonte | O que traz | Observação |
|---|---|---|
| NVD (API 2.0) | CVEs publicadas; CVEs por produto (`virtualMatchString`); dicionário CPE | 5 consultas/30 s sem `NVD_API_KEY` (50 com) |
| OSV | avisos por pacote e versão (`querybatch` + detalhe) | traz CVE em `aliases`, vetor CVSS e versão corrigida por faixa |
| CISA KEV | CVEs exploradas ativamente (data de entrada, prazo, ransomware) | catálogo inteiro a cada execução |
| FIRST EPSS | probabilidade de exploração em 30 dias e percentil | só das CVEs que afetam alguém |

O id do aviso é a **CVE** quando existe (para o mesmo problema não aparecer duas
vezes entre NVD e OSV); a nota do NVD prevalece sobre a do OSV para a mesma CVE.

## Sincronização

- Agendada dentro da API: 1 min após o boot e a cada
  `THREAT_INTEL_SYNC_INTERVAL_MIN` (padrão 360). `THREAT_INTEL_SYNC_ENABLED=false`
  desliga o agendador (o botão do ADMIN continua).
- Ordem: KEV → feed do NVD (desde a execução anterior; 2 dias na primeira, teto
  de 7) → NVD por produto (só o modificado desde a última consulta) → OSV → EPSS
  → notificações. Tecnologia igual em várias empresas é consultada uma vez.
- Resultado por execução em `ThreatSyncRun`: `OK`, `PARTIAL` (alguma fonte
  falhou, com o motivo) ou `FAILED`. Execução órfã (servidor reiniciado no
  meio) vira `FAILED` na seguinte.

## Notificações

| Evento | Notifica? |
|---|---|
| CVE publicada **depois** do mapeamento, CVSS ≥ 7 ou KEV | sim (`THREAT_MATCH`) |
| CVE publicada **depois** do mapeamento, CVSS < 7 | não |
| CVE nova ainda **sem nota** | espera o NVD pontuar |
| CVE que **já existia** ao mapear | não (aparece com o selo) |
| CVE conhecida que **entra no KEV** depois do mapeamento | sim (`THREAT_KEV`) |
| Mais de 3 eventos da empresa numa execução | um resumo por pessoa (`THREAT_DIGEST`) |

Destinatários: os ADMIN, os CLIENT da empresa e os PENTESTER membros de algum
projeto dela. Cada evento uma vez.

## API

Todas autenticadas. `companyId` na query (ou no body) para ADMIN e PENTESTER;
o CLIENT usa sempre a própria empresa.

| Método | Rota | Quem |
|---|---|---|
| GET | `/threat-intel/companies` | empresas que o ator enxerga |
| GET | `/threat-intel/overview` | resumo + permissões do ator |
| GET/POST | `/threat-intel/assets` | ver / adicionar (ADMIN, CLIENT OWNER) |
| GET | `/threat-intel/assets/search-products?q=` | busca CPE no NVD (quem edita) |
| POST | `/threat-intel/assets/:id/confirm` · `/dismiss` · `/assets/confirm-all` | quem edita |
| DELETE | `/threat-intel/assets/:id` | quem edita |
| GET | `/threat-intel/matches?triage=&kev=&severity=&preexisting=` | quem vê |
| PATCH | `/threat-intel/matches/:id/triage` | ADMIN, CLIENT OWNER, PENTESTER membro |
| GET/POST | `/threat-intel/matches/:id/promotion-draft` · `/promote` | ADMIN, PENTESTER membro do projeto |
| GET | `/threat-intel/feed?days=&kev=&severity=` | quem vê |
| GET/POST | `/threat-intel/sync` | ver execuções / disparar (ADMIN) |
| GET | `/notifications` · `/notifications/unread-count` | as do próprio usuário |
| POST | `/notifications/:id/read` · `/notifications/read-all` | as do próprio usuário |

## Segurança

- **Tenancy:** a empresa do CLIENT vem do banco; a do ADMIN/PENTESTER é
  validada. Tecnologia, CVE ou notificação de outra empresa/pessoa pedida por id
  é **404**. Testes nos dois sentidos (`TI-TEN-01`, `TI-NOT-01`).
- **Entrada:** ecossistema de lista fechada; nome de pacote, fabricante,
  produto e versão por regex; tamanho limitado. Nada vira consulta crua.
- **Saída de fonte externa:** descrição e títulos sempre como texto; referência
  só vira link se for `http(s)`. O sino só navega para rota interna (`/x`,
  nunca `//host`).
- **Rede:** só as quatro URLs públicas fixas, com timeout de 30 s; nenhuma URL
  vem do usuário.
- **Auditoria:** inventário, triagem e promoção geram `AuditLog`.

## Validação com fontes reais (2026-11-15)

Stack local da branch (API `:3101`, web `:5174`, banco próprio), fontes reais:

| Passo | Resultado |
|---|---|
| Sincronização completa | KEV 1.781 · feed do NVD 811 CVEs (2 dias) · OSV · EPSS — **OK** em 25 s |
| SBOM real do NodeGoat (Trivy) | 381 componentes → sugestões; confirmadas → backfill com **90 CVEs** (OSV 91 avisos, EPSS 77) |
| Scan DAST real (ZAP) contra nginx 1.27.5 | fingerprint → sugestão `f5 nginx 1.27.5`; o NVD não tem CVE para essa versão (0, sem versão seriam 41) |
| NVD fora do ar durante uma execução | **PARTIAL** com "NVD: HTTP 503"; KEV e OSV seguiram |
| Busca CPE "tomcat" | resultados reais do dicionário do NVD |
| Promoção de CVE-2021-23337 (lodash) | vulnerabilidade `THREAT_INTEL` no projeto, visível em Achados pela origem |
| Notificação | **simulação controlada e rotulada** (ver evidências): o caminho é o real, só a fonte "publicou" um aviso fictício |

Testes: API (unit `threat-intel.util.test.ts` com amostras reais das fontes;
integração `threat-intel.test.ts` com as fontes em memória), web
(`threat-intel-page.test.tsx`, `notification-bell.test.tsx`).

## Limites

- Uma instância da API (o agendador e a flag de execução são por processo).
- Casamento por produto depende de o NVD ter analisado a CVE (`configurations`);
  CVE nova pode levar dias para casar por CPE. Pacotes (OSV) costumam ser mais
  rápidos.
- O fingerprint só sugere tecnologias de uma lista com correspondência
  inequívoca, e só para a empresa cuja aplicação tem o mesmo host do alvo.
- Notificação só no app (sino). E-mail e push ficaram de fora desta versão.
