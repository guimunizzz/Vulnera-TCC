<!-- Evidencias da UI do assistente, consumidas por Rafael e revisores. -->
# Assistente Vulnera — QA visual

Fixtures sinteticas interceptadas somente no navegador; sem Gemini real ou escrita no banco.

Origem: `http://localhost:8086`.

- PASS: ADMIN: envio explicito, acoes filtradas, navegacao e origem
- PASS: CLIENT: envio explicito, acoes filtradas, navegacao e origem
- PASS: PENTESTER: envio explicito, acoes filtradas, navegacao e origem
- PASS: Sugestoes/refoco sem chamadas; trava duplicada e contexto capturado no envio
- PASS: Movimento autonomo, pausa por hover/foco/manual e resize
- PASS: Modal existente bloqueia assistente e preserva foco
- PASS: Painel 320px, rolagem, alvos, reduced motion e print: dark
- PASS: Painel 320px, rolagem, alvos, reduced motion e print: light
- PASS: Onboarding e relatorio DAST cobertos, HTML original preservado
- PASS: Ausente em paginas publicas e privado sem sessao
- PASS: Logout cancela e descarta resposta tardia
- PASS: Resposta exibida como texto seguro e fonte Gemini distinta

Erros de pagina: []

Violacoes CSP: []

Assets servidos: ["/assets/index-BM7VkbDc.js"]

Limitacoes anteriores: [{"theme":"dark","viewport":320,"before":335,"after":335,"finding":"Cabecalho Conta preexistente excede largura320; assistente nao aumenta esse overflow."},{"theme":"light","viewport":320,"before":335,"after":335,"finding":"Cabecalho Conta preexistente excede largura320; assistente nao aumenta esse overflow."}]
