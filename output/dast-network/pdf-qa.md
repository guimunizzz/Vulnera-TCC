<!-- Registro de QA dos PDFs baixados pela interface. Preserva evidências e limitações para o relatório da apresentação; consumido por Rafael e pela revisão do projeto. -->

# QA dos PDFs DAST — 2026-10-09

## Relatório real

- Fonte: PDF baixado pela UI; cópia preservada em `real-report.pdf`.
- SHA256 da fonte e da cópia: `3E3027454B95D502559C6F8E403196BC9C2BD0E2CBEEFD8279D1CFE3FDF2FDAF`.
- Cinco páginas extraídas e renderizadas. Todas as páginas foram inspecionadas visualmente.
- Alvo: `http://10.87.169.107:5173/`.
- Resultado: cinco achados, com zero altos, três médios, um baixo e um informativo.
- Capa e apêndice descrevem análise passiva de respostas HTTP e GET limitado. Não prometem testes ativos de SQL injection ou XSS.
- Sem cortes, sobreposições ou glifos ilegíveis observados nas imagens renderizadas.

### Polimento pendente

- A página 4, no achado informativo `Modern Web Application`, apresenta os rótulos `CWE--1` e `WASC--1`. O valor sentinela `-1` fornecido pelo ZAP é exibido como identificador de classificação. Tratar essa ausência de classificação como campo não informado é um polimento futuro; não bloqueia iniciar, acompanhar, visualizar ou promover resultados. Nenhuma correção aplicada nesta revisão.

## Relatório de demonstração

- Primeira versão: sete páginas; capa identificava demonstração, achados fictícios e ausência de acesso ao alvo; capa/apêndice renderizados sem cortes ou sobreposições.
- A primeira inspeção textual encontrou no apêndice a afirmação de que triagem, promoção e comparação ficavam indisponíveis. A revisão independente posterior confirmou que a triagem é permitida na API/UI. A aprovação dessa afirmação na primeira inspeção foi substituída: somente promoção e comparação são bloqueadas no modo simulado.
- Root corrigiu o texto e reconstruiu o web. **Revalidação concluída em 2026-10-09** com novo PDF baixado pela UI após a atualização da stack, capa gerada às 08:54.
- Fonte atual: `Downloads/dast-vulnera-dast-ui-fixture-8080-2026-10-09 (1).pdf`; cópia preservada em `demo-report.pdf`. SHA256 da fonte e da cópia: `DAAF8397A98941A92F26C14E0922B6A7E30832130489A049C74430ABE4BFABA9`.
- Sete páginas extraídas. Capa e apêndice renderizados novamente e inspecionados visualmente: sem cortes, sobreposições ou glifos ilegíveis.
- A capa mantém as identificações de demonstração, achados fictícios e ausência de acesso ao alvo. O apêndice confirma que os achados fictícios permitem apresentar a triagem; somente promoção para vulnerabilidades e comparação operacional ficam indisponíveis no modo de demonstração. A metodologia informa que o ZAP não foi executado e nenhuma requisição foi enviada ao alvo.

## Evidências

- Texto real: `real-report-text.txt`.
- Renderizações reais: `real-page-1.png` a `real-page-5.png`.
- Texto e renderizações da versão demo atual revalidada: `demo-report-text.txt`, `demo-page-1.png` e `demo-page-7.png`.

Esta revisão não executou testes de banco, scans, alterações de produto ou alterações de documentação viva.
