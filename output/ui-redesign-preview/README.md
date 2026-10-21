<!-- Registra a origem e os limites das prévias; consumido pela revisão visual. -->
# Prévias visuais — 2026-10-16

Três comparativos desktop de Dashboard, Aplicações e Projetos.

- Antes: captura do código atual em 1440×1000, tema escuro, Chrome headless e dados de demonstração interceptados somente no navegador.
- Depois: estudo HTML/CSS independente, com os mesmos dados. Não implementado no aplicativo.
- Nenhuma consulta à API real ou gravação no banco.
- Geração de imagens por IA indisponível por erro 401 de sessão expirada; imagens finais renderizadas localmente.
- Fontes e dependências locais existentes. Nenhuma instalação.
- 3/3 propostas sem corte ou overflow horizontal. Zero erros de página e zero endpoints sem fixture.

Arquivos por tela: *-antes.png, *-depois.png, *-antes-depois.png e *-proposta.html.

Brief visual: grafite e violeta discreto; superfícies mais sólidas; cabeçalhos compactos; melhor hierarquia de dados; ações de tabela organizadas; sidebar agrupada.

Reproduzir: servidor Vite em http://127.0.0.1:5173 e node output/ui-redesign-preview/render-comparisons.mjs.
