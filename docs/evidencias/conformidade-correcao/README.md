# Evidências — conformidade e correção sugerida (ADR-063)

Capturas de 25/11/2026 na stack Docker (:8086) com o código da branch
`feat/conformidade-correcao` (inclui grafo, produtividade e a `dev` com #83).
Chrome a 1440×900.

| Arquivo | O que mostra | Quem |
|---|---|---|
| `01-conformidade-lgpd.jpg` | LGPD: 6 de 6 requisitos com vulnerabilidade aberta relacionada, pior severidade e categorias OWASP por requisito | CLIENT (TechNova Owner) |
| `02-conformidade-iso27001.jpg` | ISO/IEC 27001:2022: 15 de 17; os 2 sem achado aparecem como "sem vulnerabilidade aberta relacionada", nunca "conforme" | CLIENT |
| `03-correcao-no-detalhe-npm.jpg` | Detalhe da vulnerabilidade promovida do SCA: `npm install bson@^1.1.4` e o trecho do `package.json` | ADMIN |
| `04-correcao-na-importacao-sca.jpg` | Achado SCA `minimist@0.0.10` com corrigidas "1.2.6, 0.2.4": sugere `0.2.4`, a menor na mesma major | ADMIN |
| `05-correcao-no-threat-intel-maven.jpg` | Casamento do Threat Intel (log4j-core 2.14.1): comando `mvn versions:use-dep-version` e o trecho do `pom.xml` | CLIENT |
