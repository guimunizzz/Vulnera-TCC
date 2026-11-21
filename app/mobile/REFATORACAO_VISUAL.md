# Refatoração visual do mobile

Este registro acompanha as decisões, entregas e verificações da refatoração na `feat/mobile-melhorias`.

## Plano

- [x] Direção visual. Roxo profundo como padrão, com Roxo escuro disponível em Aparência. Cores de apoio identificam ações, séries e estados específicos.
- [x] Base compartilhada no login e nas telas autenticadas. Cabeçalhos, superfícies, filtros, botões e estados usam a mesma paleta.
- [x] Barra compartilhada com Liquid Glass nativo quando o iOS e a build oferecem suporte. Superfície sólida nos demais casos e com redução de transparência.
- [x] Gráficos e detalhes do Painel, Segurança e Relatórios.
- [x] Validação automatizada de navegação, temas, login, movimento reduzido e empacotamento.
- [ ] Conferência física do Liquid Glass no iPhone e da superfície alternativa em aparelho Android.

## Histórico

- **2026-11-20** — Direção aprovada, base visual aplicada e barra preparada. O símbolo no login sobe com um halo dourado após a confirmação e oscila brevemente quando o acesso falha. A preferência de movimento reduzido mantém o retorno textual e tátil. Typecheck, lint e 9 testes do mobile aprovados nesta etapa. A aparência do vidro nativo precisa de conferência em iPhone compatível.
- **2026-11-20** — Painel concluído com séries de achados novos e resolvidos na mesma escala, leitura por dia e consulta reaproveitada ao voltar à aba. O Grafo de Exposição mostra uma legenda e destaca conexões selecionadas. Relatórios exibem barras de severidade e maturidade, e o PDF ganhou uma ação primária. Vuvu e Minha conta seguem a base compartilhada. Typecheck, lint, 10 testes e 9 verificações de navegador com o seed local aprovados. A sequência acelerada alcançou o limite temporário em leituras da API, com os fluxos verificados até o fim. Bundles do Expo gerados para iOS, Android e web, e autolink do vidro nativo confirmado para iOS.
- **2026-11-20** — Ajustes de feedback visual. A falha mantém a oscilação da marca e o aviso de erro, com o halo reservado à confirmação do acesso. A paleta usa roxos mais profundos, com azul na Vuvu e nas conexões selecionadas, menta nos achados resolvidos e dourado nos novos. No iOS compatível, o `GlassView` nativo contém os botões e reage ao toque conforme a preferência de movimento. A alternativa usa uma superfície sólida e conserva os controles. Removidos os reflexos e divisórias desenhados na barra. Typecheck, lint, 10 testes, exportações iOS/Android/web e verificação no navegador a 320 px concluídos. A aparência do material nativo em aparelho permanece pendente.
- **2026-11-20** — Paleta revisada após a avaliação da Home. O aplicativo oferece Roxo escuro e Roxo profundo, com fundos e cartões mais escuros. Preferências salvas no tema claro migram para Roxo profundo. A Vuvu, o halo de login, os controles e os gráficos passaram a usar a paleta roxa. Alertas e indicadores de severidade usam suas cores semânticas. Typecheck, lint, 10 testes, restauração das três preferências verificadas, contraste dos controles e das séries, troca de tema no navegador e exportações para iOS, Android e web aprovados.
- **2026-11-20** — Roxo profundo escolhido como padrão de primeiro acesso. Preferências existentes são respeitadas. Azul suave identifica o atalho da Vuvu, menta distingue os achados resolvidos e dourado sinaliza prazos próximos do vencimento. A mesma cor de prazo é aplicada no Painel, nas listas e no detalhe do achado. Typecheck, lint, 10 testes, preferência padrão e persistida, mapeamento dos estados de SLA, contraste, navegação no navegador e exportações para iOS, Android e web verificados.
