<!-- Evidências da Threat Intel (ADR-053) com fontes reais, e o que foi simulado; consumido pelo PR e pela banca. -->

# Threat Intel — evidências (2026-11-15)

Validação no navegador (Chrome via Playwright) contra a stack local da branch
`feat/threat-intel`: API `:3101` e web `:5174` sobre um banco próprio
(`vulnera_ti_dev`). Log em [`fluxo-real.txt`](fluxo-real.txt). **0 erros de
console.**

## O que é real e o que foi simulado

**Real (fontes públicas, na hora):**

| Passo | Resultado |
|---|---|
| Sincronização completa | CISA KEV 1.781 entradas · NVD 811 CVEs publicadas em 2 dias · OSV · EPSS — **OK** em 25 s |
| SBOM do OWASP NodeGoat `c5cb68a` (Trivy, imagem oficial) importado no SAST/SCA | 381 componentes → 381 **sugestões**; a dona da TechNova confirmou → backfill: OSV 91 avisos, EPSS 77 notas, **90 CVEs** casadas |
| Scan DAST **real** (ZAP) contra `nginx:1.27.5` descartável, com a aplicação apontando para o mesmo host | fingerprint → sugestão `f5 nginx 1.27.5`; o NVD não tem CVE para essa versão (0; sem versão seriam 41) |
| NVD fora do ar numa das execuções | **PARTIAL** com "NVD: HTTP 503"; KEV e OSV seguiram; a execução seguinte voltou OK |
| Busca "tomcat" no dicionário CPE | resultados reais do NVD |
| SBOM do próprio Vulnera (Trivy sobre o `package-lock.json` local) importado no Portal E-commerce | 391 componentes → 369 sugestões novas, pendentes na captura 08 (os outros 22 já estavam no inventário); o Trivy aponta 47 vulnerabilidades: TI-FUT-05 |
| Promoção de CVE-2021-23337 (lodash 4.17.15) | vulnerabilidade `THREAT_INTEL` no projeto B2B, filtrável por origem em Achados |

**Simulado (rotulado):** nenhuma CVE nova é publicada sob demanda. Para
mostrar o sino, `ti-simulacao.ts` (fora do repositório) rodou o
`ThreatIntelSyncService` **real**, com os repositories e o banco reais, trocando
só a fonte por uma que "publicou agora" o aviso fictício
**`SIMULACAO-2026-0001`** ("[Simulação] Execução remota de código no template
do lodash", CVSS 9.8) para o lodash do inventário. A execução falsa foi
apagada de `ThreatSyncRun`, para a aba Fontes mostrar só execuções reais. Gerou
5 notificações: o ADMIN, os dois CLIENT da TechNova e os PENTESTER membros.

## Capturas

01–05, 08 e 10–14 foram refeitas depois do polimento visual (boletim no
cabeçalho, EPSS como medidor, menu sem quebra). Para refazer o sino, a
notificação da simulação do ADMIN foi marcada de novo como não lida no banco.
06, 07 e 09 não mudaram de layout e são da primeira rodada.

| # | Arquivo | O que prova |
|---|---|---|
| 01 | `01-menu-threat-intel-new-e-sino-com-contagem` | Item **Threat Intel** com selo *new* e o sino com a contagem |
| 02 | `02-sino-aberto-notificacao-da-simulacao` | O painel do sino com a notificação (simulação rotulada) |
| 03 | `03-notificacao-leva-a-cve-aberta` | Clicar leva à aba "Afeta você" com a CVE já aberta |
| 04 | `04-afeta-voce-cves-reais-do-nodegoat` | O cabeçalho como boletim: "62 CVEs críticas ou altas afetam 42 tecnologias da TechNova", a distribuição por severidade, a saúde das fontes (NVD em vermelho: a última execução completa pegou o 503) e as CVEs reais. O "1 foi publicada nos últimos 7 dias" é o aviso da simulação |
| 05 | `05-detalhe-cve-real-epss-versao-corrigida` | CVE-2021-23337: CVSS, EPSS 20% (percentil 98), versão corrigida 4.17.21, CWE, aliases, referências e triagem |
| 06 | `06-promover-cve-para-vulnerabilidade` | Rascunho: projeto, título, vetor do aviso com score calculado, A06 |
| 07 | `07-achados-com-origem-threat-intel` | A vulnerabilidade promovida em Achados, origem **Threat Intel** (visão unificada D18) |
| 08 | `08-inventario-sugestoes-do-sbom-e-confirmados` | Sugestões pendentes (SBOM) e as confirmadas, com origem (SBOM, Fingerprint DAST, Manual) e nº de CVEs |
| 09 | `09-adicionar-produto-busca-no-dicionario-cpe` | Adicionar produto com busca real no dicionário CPE |
| 10 | `10-feed-cves-publicadas-no-nvd` | Feed de CVEs publicadas (NVD) com severidade e EPSS |
| 11 | `11-fontes-execucoes-reais-com-nvd-503` | Execuções reais por fonte, inclusive a PARTIAL com o NVD em 503 |
| 12 | `12-cliente-membro-somente-leitura` | CLIENT MEMBER vê tudo e não tria, não promove, não edita |
| 13 | `13-threat-intel-375px` | 375 px sem rolagem horizontal (a 1ª medição deu 401 px por causa do sino no topo; corrigido tirando a marca do topo abaixo de `sm`) |
| 14 | `14-tema-claro-dona-da-empresa` | Tema claro, como a dona da empresa (CLIENT OWNER) |

## Testes

- API `npm test` **847/847** (57 suítes): `tests/unit/threat-intel.util.test.ts`
  (amostras reais das fontes) e `tests/integration/threat-intel.test.ts` (14
  casos: inventário e RBAC, SBOM e fingerprint, tenancy nos dois sentidos,
  backfill sem notificar, notificação só para quem deve e uma vez, KEV depois do
  mapeamento, fonte fora do ar, resumo acima de 3, triagem, promoção, notificações
  e feed).
- Web **614/614**, lint 0 erros, contraste 132 pares.
