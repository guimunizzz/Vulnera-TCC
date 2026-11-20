# Refatoração visual do mobile

Este registro acompanha as decisões, entregas e verificações da refatoração na `feat/mobile-melhorias`.

## Plano

- [x] Direção visual. Roxo para marca, ações e navegação. Dourado em detalhes de apoio. Superfícies neutras nos temas claro e escuro.
- [x] Base compartilhada no login e nas telas autenticadas. Cabeçalhos, superfícies, filtros, botões e estados usam a mesma paleta.
- [x] Barra compartilhada com Liquid Glass nativo quando o iOS e a build oferecem suporte. Superfície sólida nos demais casos e com redução de transparência.
- [ ] Gráficos e detalhes do Painel, Segurança e Relatórios.
- [ ] Validação de navegação, temas, login, acessibilidade e empacotamento.

## Histórico

- **2026-11-20** — Direção aprovada, base visual aplicada e barra preparada. O símbolo no login sobe com um halo dourado após a confirmação e oscila brevemente quando o acesso falha. A preferência de movimento reduzido mantém o retorno textual e tátil. Typecheck, lint e 9 testes do mobile aprovados nesta etapa. A aparência do vidro nativo precisa de conferência em iPhone compatível.
