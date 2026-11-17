# Evidências — caça de espaçamento (2026-11-13)

Branch `feat/sast-sca-ingestion`, 4ª rodada do PR #72.

## Como a caça foi feita

1. **Estática.** Todo token de classe de espaçamento/tamanho em `app/web/src` foi
   procurado no CSS gerado pelo build. Sem regra = classe "fantasma": o Tailwind
   do projeto substitui a escala (DESIGN_SYSTEM §2.6) e um valor fora dela, como
   `gap-1.5` ou `h-80`, não gera nada e não avisa.
   **Antes:** 102 ocorrências, 39 classes, 29 arquivos. **Depois:** 0.
2. **Visual.** Playwright com o Chrome do sistema em 90 combinações (ADMIN,
   PENTESTER, CLIENT e público × rotas × 1440 e 375 px), medindo no DOM real:
   irmãos que se sobrepõem, ícone/texto colados numa linha flex e elemento que
   passa da largura da tela. **Depois da correção:** 0 achados; a 375 px a
   página tem 365 px de largura.
3. **Guarda.** `app/web/src/test/escala-espacamento.test.ts` falha com arquivo e
   linha se uma classe nova sair da escala.

## Antes / depois

| Captura | O que mudou |
| --- | --- |
| `a-seletor-layout-*` | Botões de layout do Security Graph/CyberGraph colados (`gap-0.5`, `p-0.5`) → espaçados. |
| `b-topo-375-*` | Topo a 375 px passava 4 px da tela em todas as páginas → cabe. |
| `c-cybergraph-minimapa-*` | Minimapa sem posição (`right-14` não existe) caía à esquerda, sobre a legenda → canto superior direito. A legenda também quebra a linha de severidade: a 375 px passava por baixo do zoom. Medido nos três grafos (CyberGraph, Exposure Graph, Security Graph SAST/SCA) em 1440, 768 e 375 px: 0 sobreposições. |
| `d-dashboard-cliente-donut-*` | Donut de severidade do cliente com altura zero (só a legenda) → desenhado. |
| `e-maturidade-radar-*` | Radar de maturidade com altura zero → desenhado. |
| `f-planos-botoes-*` | "Começar comBASIC" (texto e expressão viravam dois itens do `inline-flex`) → "Começar com BASIC". |
