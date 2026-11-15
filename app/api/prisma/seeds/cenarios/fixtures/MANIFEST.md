# Fixtures do seed de cenários

Relatórios **reais** usados por `prisma/seed-cenarios.ts`, gerados em 2026-11-15. O seed passa todos pelos mesmos parsers do upload e do scan de verdade.

| Arquivo | Ferramenta | Alvo | Ajuste feito |
|---|---|---|---|
| `nodegoat-semgrep.sarif` | Semgrep OSS 1.184.0, `p/default` (imagem oficial) | [OWASP NodeGoat](https://github.com/OWASP/NodeGoat) `c5cb68a` | Só ficaram as 18 regras citadas nos 35 resultados, e saiu o bloco `invocations` (avisos de sintaxe dos templates). O arquivo caiu de 2,1 MB para 63 KB. Resultados intactos. |
| `nodegoat-trivy.cdx.json` | Trivy `fs --format cyclonedx` (imagem oficial) | OWASP NodeGoat `c5cb68a` | Nenhum (381 componentes, 82 vulnerabilidades). |
| `vulnera-trivy.cdx.json` | Trivy `fs --format cyclonedx` | O próprio Vulnera (API + web) | Nenhum (391 componentes, 47 vulnerabilidades). No seed, faz o papel do SBOM do Internet Banking do Banco Aurora. |
| `zap-loja.json` / `zap-loja.html` | OWASP ZAP 2.17.0, `zap-baseline.py` | [OWASP Juice Shop](https://github.com/juice-shop/juice-shop) `v17.1.1`, em container local | O host `http://seed-juice:3000` virou `https://loja.technova.com.br`, para o scan cair na loja da TechNova. Alertas, URLs e evidências não mudaram. |

## Derivados gerados pelo seed (não versionados)

- **2ª importação SAST:** o mesmo SARIF sem as 6 regras `express-cookie-settings`. Simula a correção dos cookies e faz o `eval` continuar presente, para a tela mostrar "Correção não confirmada" (CODE-FUT-03).

NodeGoat e Juice Shop são projetos da OWASP feitos para serem vulneráveis, sob a licença Apache 2.0. Para regenerar, rode as mesmas ferramentas contra os mesmos commits e reaplique os ajustes acima.
