# Acesso web só com logo e campos — 2026-10-15

Login e cadastro apresentam a logo seguida diretamente pelos campos. Os títulos
visuais e os wrappers com suas margens foram removidos; não foi acrescentada
uma frase de apoio. Botões, dica de senha, mensagens e links permanecem.

Os h1 Entrar/Criar conta continuam no DOM com `sr-only`, IDs e `tabIndex=-1`.
Isso mantém o nome acessível de seção/formulário e o foco das transições sem
ocupar espaço visual. A implementação de animações permanece a mesma.

Alteração de aplicação restrita a `app/web/src/pages/auth/login-page.tsx` e
`app/web/src/pages/auth/register-page.tsx`. As mudanças anteriores do cadastro
e as demais edições da sessão foram preservadas.

O roteiro do navegador confere o recorte dos títulos em 1×1px fora do fluxo,
o respiro direto da logo aos campos, o nome acessível dos formulários e o Tab
do título para o primeiro campo. Também verifica o encaixe em 320×568,
controles de 44px, validação/erro, transições, cursor, fundo interativo,
decode/glitch e movimento reduzido. As capturas de login e cadastro foram
revisadas independentemente e não apresentam espaço residual ou corte.

O erro de cadastro 409 e o erro de login 401 são simulados apenas no roteiro.
Nenhuma conta foi criada; esta tarefa não comprova autenticação na API real.

Capturas: [login](login-320x568.png), [cadastro](register-320x568.png),
[login desktop](login-1440x900.png) e [cadastro desktop](register-1440x900.png).
Resultados e medidas: [smoke-results.json](smoke-results.json).

`npm run check --workspace=app/web -- -- --pool=threads --maxWorkers=1 --silent`
aprovado: **337/337 testes em 30 arquivos**, contraste 66/66 e lint com 0 erros/
9 avisos anteriores. Build TypeScript/Vite aprovado com o aviso anterior de
tamanho do bundle. Roteiro do Chrome: **13/13 verificações aprovadas**.
PRD e backlog atualizados, preservando o histórico das apresentações anteriores.
