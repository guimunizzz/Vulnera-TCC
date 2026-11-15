<!-- Evidências do `npm run db:seed:all` (2026-11-15); consumido pelo PR e pela banca. -->

# Seed completo (`db:seed:all`)

O banco foi gerado **dentro do container da API** com `npm run db:seed:all`,
num banco novo (`vulnera_seed_docker`). As telas foram capturadas no Chrome
(Playwright) contra a API e o web locais apontando para esse banco, com
**0 erros de console**.

| # | Captura | O que mostra |
|---|---|---|
| 01 | `01-admin-assinatura-pendente` | Mercado Verde na fila de aprovação do admin |
| 02 | `02-admin-achados-todas-as-empresas` | Achados das 4 empresas na mesma listagem (ADMIN) |
| 03 | `03-aurora-dashboard` | Dashboard da owner do Banco Aurora: 221 achados, taxa de remediação e críticos em aberto |
| 04 | `04-aurora-internet-banking-por-origem` | Painel da aplicação com contexto de risco (crítica, produção, exposta, restrito) e idade dos achados |
| 05 | `05-admin-quadro-de-remediacao` | Quadro de remediação com SLA vencido e a vencer, VRS e responsáveis |
| 06 | `06-aurora-threat-intel` | Threat Intel do banco: Spring4Shell e Jackson no inventário, sugestões vindas do SBOM |
| 07 | `07-technova-exposure-graph` | Exposure Graph com as cinco origens (DAST, SAST, SCA, Threat Intel e Manual) |
| 08 | `08-technova-threat-intel-kev` | CVEs do KEV contra Log4j e nginx da TechNova, com EPSS e triagem |
| 09 | `09-sast-correcao-nao-confirmada` | 2ª importação do Semgrep: 6 resolvidos e o `eval` marcado como corrigido ainda presente (CODE-FUT-03) |
| 10 | `10-dast-scan-real-zap-triado` | Scan real do ZAP na loja, com 43 alertas, triagem e promoções |
| 11 | `11-vida-maturidade` | Avaliação de maturidade da Clínica Vida+ (BÁSICO, 2,46) |

## Validação

| Verificação | Resultado |
|---|---|
| `db:seed:all` em banco novo (local) | OK em ~2 min. Saída: 580 achados manuais (599 com o curado e as promoções), 13 aceites de risco, 16 buscas salvas, 4 importações SAST/SCA, 2 scans DAST e 9 promoções |
| Segunda execução no mesmo banco | 17 tabelas com contagens **idênticas** antes e depois (idempotente) |
| `db:seed:all` dentro da imagem Docker da API | OK, como o usuário não-root `vulnera` |
| Threat Intel | 263 casamentos, 11 deles no KEV. O NVD falhou em duas das quatro execuções (503/timeout); o seed avisou e seguiu, e o OSV e o KEV cobriram os casamentos |
| SLA depois do backfill | ~100 achados ativos, ~55% vencidos |
