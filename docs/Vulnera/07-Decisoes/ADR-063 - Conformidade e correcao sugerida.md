---
type: decisao
tags: [decision, frontend, backend, conformidade, remediacao]
status: vigente
codigo: ADR-063
data: 2026-11-23
---

# ADR-063 - Conformidade e correção sugerida

> Branch irmã de `feat/grafo-postura` (ADR-061) e de `feat/produtividade`
> (ADR-062). Respostas em `docs/DECISIONS.md` D22.

## Contexto

Duas funcionalidades pedidas para a mesma branch:

- **Conformidade**, à moda do Vanta e do Drata: mostrar quais requisitos da
  LGPD, da ISO/IEC 27001:2022 e do NIST CSF 2.0 estão em risco pelas
  vulnerabilidades abertas. PCI ficou fora (D22.5).
- **Correção sugerida**, à moda do Snyk e do Dependabot: dizer como corrigir
  uma dependência vulnerável ou um achado de código.

O ADR-017 continua valendo: **sem IA**. O SCA (Trivy, Grype, OSV) já informa
a versão corrigida, e o SAST traz a recomendação e a referência da regra; o
Vulnera só não mostrava isso de forma acionável.

## Decisão

1. **O mapeamento é um arquivo versionado no código**
   (`app/web/src/lib/conformidade/catalogo.ts`), não uma tabela. Liga cada
   categoria OWASP Top 10 (2021) aos requisitos que ela costuma afetar:
   - LGPD: Art. 6º VII e VIII, 46, 46 §2º, 48 e 49;
   - ISO/IEC 27001:2022, Anexo A: 5.15, 5.17, 5.21 e 8.x;
   - NIST CSF 2.0: ID.RA, PR.AA, PR.DS, PR.PS, PR.IR e DE.CM.

   Toda categoria aparece em pelo menos um requisito de cada referência
   (teste CNF). Os resumos são paráfrases; o texto oficial é o da norma.
   Mudar o mapeamento é um diff revisável, não um dado que alguém muda em
   produção.

2. **A avaliação roda no front, sem endpoint novo.** Reaproveita as abertas
   por aplicação e categoria do `GET /companies/me/exposure-graph`, com a
   mesma tenancy e o mesmo cache. A tela `/conformidade` é para ADMIN e
   CLIENT, os papéis do Exposure Graph. Para cada requisito mostra:
   - quantas vulnerabilidades abertas ele tem;
   - a pior severidade;
   - as categorias, que levam a Achados (ADMIN) ou ao Exposure Graph
     (CLIENT, que não abre `/findings`);
   - as aplicações.

3. **Nunca dizer "conforme".** O estado bom é "sem vulnerabilidade aberta
   relacionada": a falta de achado não prova conformidade. A página diz que é
   referência de apoio, não auditoria nem parecer jurídico.

4. **Correção sugerida, montada no front** a partir do que a origem trouxe.
   O detalhe da vulnerabilidade (`GET /vulnerabilities/:id`) ganha
   `origemDaCorrecao`, lida só nessa rota pelo include `ORIGEM_DA_CORRECAO`:
   - **SCA**, do `CodeFinding`: pacote, versão, purl, versão corrigida e
     advisory;
   - **SAST**: arquivo, linha, trecho, recomendação e `helpUri`;
   - **Threat Intel**, do `ThreatMatch`: ecossistema e pacote do inventário,
     mais a versão corrigida do casamento.

   O casamento do Threat Intel também passa a expor `ecosystem` e
   `packageName` do ativo. Em `lib/correcao-sugerida.ts`, testado em COR-01
   a 04:
   - **versão sugerida**: a menor versão corrigida na mesma major da atual;
     sem nenhuma, a menor acima da atual;
   - **comando e manifesto**: no formato de npm, PyPI, Maven, Go, NuGet,
     RubyGems, Cargo ou Composer;
   - **links**: só formatos conhecidos viram link de advisory (NVD, GitHub
     Advisory); a referência do relatório só vira link se for `http(s)`.

   A correção aparece em três lugares: no detalhe da vulnerabilidade, no
   achado SCA da importação e no casamento do Threat Intel.

## Alternativas descartadas

- **Mapeamento em tabela editável**: sem caso de uso para editar em
  produção, e perderia o histórico do diff.
- **Endpoint de conformidade**: só repetiria a consulta do Exposure Graph.
- **Gerar o patch ou abrir PR automático**: exige acesso ao repositório,
  que o Vulnera não tem. O comando é para a pessoa copiar e revisar.
- **Sugestão por IA**: contradiz o ADR-017.

## Consequências

- Nenhuma migration. Dois contratos crescem só com campos novos:
  `origemDaCorrecao` no detalhe e `ecosystem`/`packageName` no ativo do
  casamento.
- Limites:
  - a comparação de versões é numérica e simples: pré-release e esquemas
    exóticos, como datas, podem sair na ordem errada;
  - o mapeamento é por categoria OWASP, então uma vulnerabilidade sem
    categoria certa não entra;
  - vulnerabilidade manual e DAST não têm correção sugerida, só a
    recomendação escrita.

## Relacionado

[[Adr 017 ia cortada do escopo do mvp]] · [[ADR-052 - Importacao SAST e SCA por SARIF e CycloneDX]] ·
[[ADR-053 - Threat Intel com inventario de tecnologias e sincronizacao agendada]] ·
[[ADR-061 - Analises do Exposure Graph e comentarios no grafo]] · `docs/DECISIONS.md` D22
