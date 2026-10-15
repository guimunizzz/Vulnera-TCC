# Cadastro web compacto — 2026-10-15

O cadastro segue o visual do login na branch `refactor/web`: card central de
até 400px, logo dentro do card, título centralizado de 24px e apresentação
curta. Os quatro campos continuam em uma coluna e preservam rótulos, ícones,
autocomplete, dica de senha e validação existentes.

Em telas com até 700px de altura, apenas o cadastro reduz padding e espaços
entre blocos. O card cabe inteiro em 320×568, mantendo inputs, botão e link com
áreas de toque de pelo menos 44px. Mensagens de erro podem ampliar o conteúdo
e permitir rolagem. A forma `/register/` e a variação em maiúsculas recebem o
mesmo layout e direção da transição.

Arquivos de aplicação alterados: `app/web/src/pages/auth/register-page.tsx`,
`app/web/src/pages/auth/login-page.css` e
`app/web/src/pages/auth/auth-layout.tsx`.

O cenário, o cursor, as animações de texto, o foco no título e as transições
permanecem no layout compartilhado. O login mantém suas dimensões e estilos.

**12/12 verificações no Chrome local aprovadas**, incluindo geometria do
cadastro em 1440×900, 1366×768, 390×844, 320×640, 320×568 e 568×320, onde a
orientação horizontal baixa permite rolagem. Inclui senha divergente sem POST,
correção do erro, erro da API, tamanhos dos controles, URLs alternativas,
regressão de login, fundo interativo, decode/glitch, foco e movimento reduzido.

O POST de cadastro recebeu uma resposta 409 simulada somente no roteiro de QA,
com conferência do payload. Nenhuma conta foi criada. O navegador integrado
estava desconectado na sessão; a inspeção usou Chrome headless local. As duas
capturas principais também passaram por revisão visual independente.

Capturas: [desktop](register-1440x900.png), [celular](register-390x844.png),
[320×568](register-320x568.png), [senha divergente](register-password-error-320x568.png)
e [erro da API](register-api-error-320x568.png). Medidas e verificações estão em
[smoke-results.json](smoke-results.json).

`npm run check --workspace=app/web -- -- --pool=threads --maxWorkers=1 --silent`
aprovado: **337/337 testes em 30 arquivos**, lint com 0 erros/9 avisos
anteriores e contraste 66/66. Build final TypeScript/Vite aprovado, com o aviso
anterior de tamanho do bundle. A suíte e o build não tiveram falhas nesta tarefa.

Sem mudanças de API, schema, dependências ou lockfiles nesta tarefa.
PRD e backlog atualizados, preservando os registros existentes.
