---
type: decisao
tags: [decision, sast, sca, sarif, cyclonedx, sbom, triagem, tenancy]
status: vigente
codigo: ADR-052
data: 2026-11-13
---

<!-- Registra por que o Vulnera importa relatórios SAST/SCA (SARIF e CycloneDX) em vez de executar as ferramentas, e as regras de fingerprint, herança de triagem, promoção e tenancy; consumido pelos mantenedores e pela banca. -->

# ADR-052 — Importação SAST e SCA por SARIF e CycloneDX

> [!info] Origem
> Branch `feat/sast-sca-ingestion` (2026-11-12 e 13). Uso, API e validação com
> ferramentas reais em `docs/SAST_SCA.md`; capturas em
> `docs/evidencias/sast-sca/`.

## Contexto

O Vulnera cobria a análise dinâmica (DAST, ADR-029/032 e o Security Graph) e
o registro manual. Faltava o que está no **código** e nas **dependências**, que
é onde os times encontram a maior parte dos problemas antes do deploy. Os
pontos de partida eram:

- o schema já previa `Project.analysisType = SAST`, mas nada o alimentava;
- o fluxo de **triagem → promoção com CVSS revisado → SLA/VRS** do DAST
  (ADR-032) já resolvia o problema difícil: achado automático só vira finding
  do produto depois que um humano decide;
- os times já rodam Semgrep, CodeQL e Trivy na pipeline, e todos exportam
  **SARIF 2.1.0** (padrão OASIS) ou **CycloneDX** (padrão OWASP).

## Decisão

### 1. Importar o relatório, não executar a ferramenta

O Vulnera recebe o arquivo que a pipeline do cliente já gera. Executar
scanners de código exigiria o **código-fonte** do cliente dentro da plataforma
(credenciais de repositório, armazenamento, isolamento de execução), um risco e
um custo desproporcionais ao TCC. Os dois formatos abertos cobrem as
ferramentas mais usadas sem um conector por fornecedor.

### 2. Silo próprio dentro da cadeia multi-tenant

`CodeScanImport` e `CodeFinding` pertencem a um **Project**; `companyId` é
herdado dele, nunca lido do request (SEC2). É a diferença para o DAST, cujo
silo é por usuário (ADR-029): aqui o achado já nasce no contexto do projeto. O
acesso é de ADMIN ou do PENTESTER **membro** do projeto, a mesma regra de
escrita de `Vulnerability`. CLIENT não vê achado não triado.

### 3. Fingerprint estável e herança de triagem

Cada achado tem um fingerprint (sha256) que sobrevive à reimportação. No SCA,
ele combina ferramenta, regra, arquivo e `pacote@versão`. No SAST, combina
ferramenta, regra, arquivo e o fingerprint da ferramenta **quando ele distingue
as ocorrências** (senão, a linha, e o número da ocorrência nas colisões). A
comparação usa a importação anterior do **mesmo projeto, formato e
ferramenta**. O achado que continua **herda a triagem**, para que o pentester
não retrie o mesmo falso-positivo a cada build.

### 4. Promoção igual à do DAST

O rascunho propõe e o humano dispõe (RN10). O vetor sugerido é o da ferramenta,
quando ela informa (NVD via Trivy), ou o típico da faixa de severidade. O
destino é o projeto da importação. A proveniência fica em
`sourceType = SAST_IMPORT | SCA_IMPORT` e `sourceCodeFindingId` (único,
`SetNull`). A dedup vale **entre importações**: o mesmo fingerprint já promovido
não vira uma segunda vulnerabilidade.

### 5. "Resolvido" não fecha vulnerabilidade

Sumir do relatório pode ser correção ou mudança de escopo. A comparação e o
PDF apontam a vulnerabilidade para **reteste**; mudar o status continua sendo
uma decisão humana (ADR-033).

### 6. Interface e relatório

Item **SAST/SCA** no menu (com o selo *new* fixo até ser removido no código),
página global, detalhe da importação e aba no projeto. O PDF segue o molde do
DAST, e **falso-positivo fica fora da lista e do gráfico, mas é contado**. As
decisões de interface foram tomadas pelo Rafael em 2026-11-13 (D17 em
`docs/DECISIONS.md`).

## Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Executar Semgrep/Trivy dentro do Vulnera | exige o código-fonte do cliente na plataforma; risco e custo maiores que o ganho |
| Gravar direto em `Vulnerability` | quebraria a RN10 e encheria a remediação de ruído não triado (a mesma objeção do ADR-029) |
| Reutilizar `DastFinding` | o silo do DAST é por usuário e sem projeto; misturar mudaria a tenancy dos dois |
| Fingerprint só pela linha | qualquer linha inserida acima faria tudo parecer "novo" e perderia a triagem |
| Truncar relatórios acima do teto | esconderia achados sem aviso; o teto (5.000) recusa com 422 |

## Consequências

- **+** Uma linha de cobertura nova (SAST + SCA + DAST) com o mesmo fluxo de
  gestão; o histórico entre builds vira dado ("o que a correção resolveu").
- **+** Sem dependência nova na API (o parser é TypeScript puro) e sem código
  do cliente armazenado.
- **−** A qualidade depende do relatório de origem; o Vulnera não confirma
  exploração nem alcance.
- **−** O enum de triagem é o do DAST (`DastTriageStatus`), reutilizado de
  propósito para manter a mesma semântica e o mesmo componente de tela; o nome
  ficou histórico.
- Trabalho futuro (backlog `CODE-FUT-*`): ingestão direta pela CI, consulta a
  OSV/NVD para SBOM sem CVEs e reabertura assistida da vulnerabilidade quando um
  achado resolvido volta a aparecer.
