<!-- Evidências da importação SAST/SCA (ADR-052) com relatórios reais de Semgrep e Trivy e da checagem passiva de headers contra sites públicos de teste; consumido pela banca e pela revisão do PR. -->

# Evidências — SAST/SCA (2026-11-13)

Tudo aqui foi produzido **com ferramentas e alvos reais**, nenhum relatório foi
escrito à mão:

- **Semgrep 1.184.0** e **Trivy 0.76.2**, pelas imagens Docker oficiais
  (`semgrep/semgrep`, `aquasec/trivy`), contra os projetos vulneráveis de
  propósito **OWASP NodeGoat** (`c5cb68a`) e **OWASP Juice Shop** (`266448a`).
- A 2ª versão do relatório do NodeGoat saiu de uma **correção real no código**:
  os três `eval(req.body.*)` de `app/routes/contributions.js` trocados por
  `parseInt(..., 10)`, e o Semgrep rodado de novo.
- O fluxo foi feito **pela interface** (Chrome, via Playwright), logado como o
  PENTESTER da seed (`bruno.pentester@vulnera.local`), na API e na web desta
  branch, sobre um banco de demonstração próprio. Resultado: **0 erros de
  console** (`fluxo-real.txt`).

## Capturas

| # | Arquivo | O que mostra |
|---|---|---|
| 01 | `01-menu-sast-sca-new-e-estado-vazio.jpg` | item **SAST/SCA** com o selo *new* no menu; estado vazio explicando o que fazer |
| 02 | `02-dialogo-importar-sarif.jpg` | diálogo de importação com projeto, arquivo e comandos de exemplo |
| 03 | `03-detalhe-importacao-semgrep-nodegoat.jpg` | 1ª importação: 35 achados, distribuição, filtros e tabela |
| 04 | `04-achado-expandido-triagem-e-detalhe.jpg` | achado expandido: triagem, promoção, regra, CWE, trecho e descrição |
| 05 | `05-promover-sast-vetor-revisado.jpg` | promoção SAST com o vetor revisado e o score calculado na hora |
| 06 | `06-reimportacao-novos-resolvidos-triagem-herdada.jpg` | 2ª importação, depois da correção: 29 achados, 0 novos, **6 resolvidos** |
| 07 | `07-triagem-herdada-na-reimportacao.jpg` | o "risco aceito" da 1ª importação aparece **herdado** |
| 08 | `08-comparacao-resolvidos-com-vulnerabilidade-para-retestar.jpg` | aba Comparação: o `eval` promovido aparece como resolvido com o link da vulnerabilidade para reteste |
| 09 | `09-detalhe-sbom-cyclonedx-trivy.jpg` | SBOM CycloneDX do Trivy: 93 CVEs em 381 componentes |
| 10 | `10-promover-sca-vetor-da-ferramenta.jpg` | promoção SCA com o vetor do NVD (3.0 → 3.1), OWASP A06 e versão corrigida |
| 11 | `11-sbom-vazio-aviso-sem-lockfile.jpg` | SBOM do Juice Shop sem componentes (o repositório não versiona lockfile): aviso em vez de "nada vulnerável" |
| 12 | `12-pagina-global-sast-sca.jpg` | página global: números das últimas importações por fonte e a lista |
| 13 | `13-aba-sast-sca-no-projeto.jpg` | aba SAST/SCA dentro do projeto |
| 14 | `14-detalhe-tema-claro.jpg` | tema claro |
| 15 | `15-detalhe-375px.jpg` | 375 px |
| 16 | `16-pdf-pagina-{1,2,3}.jpg` + `relatorio-sast-sca-nodegoat-semgrep.pdf` | PDF da 2ª importação (16 páginas): capa, sumário com comparação e "retestar", achados |
| 18–19 | `18-tour-lista-passo-1-menu.jpg`, `19-tour-lista-passo-2-importar.jpg` | **tour** na primeira visita à lista: holofote no item do menu e no botão de importar, "1 de 5", Pular tour / Voltar / Próximo |
| 20 | `20-tour-detalhe-abas-com-security-graph.jpg` | tour da importação, passo 2 de 7: as abas Achados, Comparação e **Security Graph**. Depois de pular, o tour não reabre ao recarregar |
| 21 | `21-security-graph-sast-semgrep.jpg` | **Security Graph** do Semgrep real (NodeGoat, 2ª versão): aplicação → código → pastas → arquivos → achados, 50 nós |
| 22 | `22-security-graph-no-selecionado.jpg` | nó selecionado: caminho destacado e painel com local, regra, triagem e **Ver na lista para triar**, que leva à aba Achados com a linha aberta |
| 23 | `23-security-graph-layout-radial.jpg` | o mesmo grafo no layout radial |
| 24 | `24-security-graph-sca-sbom-trivy.jpg` | grafo do SBOM do Trivy: pacote `bson@1.0.9` aberto com as 2 CVEs (crítica e média) e "corrige em 1.1.4" |
| 25 | `25-security-graph-375px.jpg` | 375 px |
| 17 | `17-pos-merge-admin-menu-exposure-graph-e-sast-sca.jpg` | depois do merge da `dev` com o PR #71: o ADMIN vê **Exposure Graph** e **SAST/SCA** no menu e as importações de todos os projetos. O PENTESTER vê SAST/SCA e não vê o Exposure Graph (que é de ADMIN e CLIENT) |

## Relatórios reais passados pelo parser

| Relatório | Achados | Fingerprints únicos | Severidade | Origem | Componentes | Com CWE | Com versão corrigida | Com vetor CVSS |
|---|---|---|---|---|---|---|---|---|
| NodeGoat · Semgrep SARIF | 35 | 35 | 7 altas · 27 médias · 1 baixa | 35 SAST | — | 35 | — | — |
| NodeGoat · Semgrep SARIF (depois da correção) | 29 | 29 | 4 · 24 · 1 | 29 SAST | — | 29 | — | — |
| NodeGoat · Trivy CycloneDX | 93 | 93 | 16 críticas · 59 altas · 15 médias · 3 baixas | 93 SCA | 381 | 88 | 90 | 89 |
| NodeGoat · Trivy SARIF | 93 | 93 | 11 · 47 · 26 · 9 | 93 SCA | — | 0 (o Trivy não põe CWE no SARIF) | 93 | — |
| Juice Shop · Semgrep SARIF | 71 | 71 | 20 altas · 48 médias · 3 baixas | 71 SAST | — | 71 | — | — |
| Juice Shop · Trivy CycloneDX | 0 | — | — | — | 0 | — | — | — |

Antes das correções motivadas por estes arquivos, o NodeGoat/Semgrep saía com
**22** achados e o Juice Shop com **55**: as ocorrências com o fingerprint
`"requires login"` do Semgrep OSS estavam sendo fundidas. Detalhes em
[`docs/SAST_SCA.md`](../../SAST_SCA.md#o-que-a-validação-real-encontrou-e-corrigiu).

## Checagem passiva de headers contra sites públicos de teste

O sensor `headers` do DAST (já na `dev`) faz uma única requisição GET e avalia
os cabeçalhos. Ele foi rodado contra alvos publicados para teste de segurança:

| Alvo | Status | Resposta | Achados |
|---|---|---|---|
| `http://scanme.nmap.org/` (Nmap, autorizado para scans) | OK | HTTP 200 | 4 — CSP ausente (média), anti-clickjacking ausente (média), nosniff ausente (baixa), Referrer-Policy ausente (info) |
| `https://badssl.com/` | OK | HTTP 200 | 5 — CSP, HSTS, anti-clickjacking, nosniff, Referrer-Policy |
| `https://demo.owasp-juice.shop/` (demo oficial OWASP) | OK | HTTP 200 | 3 — CSP ausente, HSTS ausente, Referrer-Policy ausente |
| `http://testphp.vulnweb.com/` (Acunetix) | UNAVAILABLE | falha de rede | 0 — o site não respondeu; `curl` deu timeout de conexão no mesmo momento |
| `http://testhtml5.vulnweb.com/` (Acunetix) | UNAVAILABLE | falha de rede | 0 — idem |

Os dois `UNAVAILABLE` são do alvo, não do sensor: ele registrou a
indisponibilidade em vez de inventar um resultado. A mensagem mostra o código
cru da falha ("(23)"), o que é pouco legível. Isso é anterior a esta branch e
ficou no backlog.
