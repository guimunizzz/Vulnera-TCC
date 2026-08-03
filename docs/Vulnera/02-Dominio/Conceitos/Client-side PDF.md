---
type: conceito
tags: [domain, arquitetura]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Client-side PDF

## Definição
Abordagem de geração de relatórios PDF diretamente no navegador do usuário, sem envolver o servidor na renderização. Usada pelo Vulnera para relatórios técnico e executivo.

## Tecnologia
`pdf-lib` — biblioteca React que renderiza componentes como documento PDF no browser usando PDF.js e pdfkit.

## Por que client-side

1. **Segurança**: elimina o risco de DDoS via geração pesada no servidor — um atacante não pode sobrecarregar a API gerando PDFs
2. **Custo**: sem processamento de servidor para geração de documentos
3. **Simplicidade**: sem fila de jobs, sem storage temporário de PDFs no servidor
4. **Autonomia**: o cliente pode baixar o PDF sem depender de disponibilidade do servidor

Decisão formal documentada em [[ADR-003 - PDF gerado no cliente]].

## Trade-offs

- PDFs muito extensos (20+ páginas com muitas imagens) podem consumir memória no browser
- mitigação: evidências como thumbnails; paginação controlada entre seções

## Uso no Vulnera

Dois tipos de relatório:
- **Executivo** (3–5 páginas): sumário, radar de maturidade, top 5 riscos
- **Técnico** (20+ páginas): findings completos com CVSS, OWASP, evidências, recomendações

## Links relacionados
[[Report]]
[[Relatorios]]
[[ADR-003 - PDF gerado no cliente]]
[[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]]
