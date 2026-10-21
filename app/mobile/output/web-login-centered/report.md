# Login web centralizado — 2026-10-15

Na branch `refactor/web`, a marca VULNERA SECURITY aparece dentro do card,
acima dos campos. O card tem até 400px de largura, com margens e controles mais
compactos. O rodapé foi removido e o login cabe inteiro em 320×568, sem rolagem.
A marca usa o wordmark da web e seu cursor existente.

Os arquivos de aplicação alterados são `app/web/src/pages/auth/auth-layout.tsx`,
`app/web/src/pages/auth/login-page.css` e `app/web/src/pages/auth/login-page.tsx`.
A marca permanece montada durante a
troca entre login e cadastro, assim como o cenário e o estado do ponteiro.
O cadastro acompanha a nova posição da marca por compartilhar o layout. O login
mantém o título e os rótulos; a apresentação longa foi reduzida para dar espaço
aos campos e a chamada de cadastro foi encurtada para caber em uma linha.

O fundo interativo, a deriva dos circuitos, os três sinais/pulsos, o cursor,
os efeitos de foco/hover, o decode/glitch e a transição dos formulários mantêm
as implementações, durações e preferências de movimento da web.

Validação no Chrome local: **9/9 verificações aprovadas**. Inclui geometria em
1440×900, 1366×768, 390×844, 320×568 e 568×320; navegação por teclado; mostrar/
ocultar senha; persistência da marca/cenário; deslize e foco ao alternar rotas;
erro de autenticação; movimento reduzido e ausência de exceções JavaScript.
A faixa de 10px reservada globalmente para a rolagem foi considerada na medida
do centro horizontal. As quatro telas com altura de 568px ou mais não têm
rolagem no login. A orientação horizontal de 568×320 permite rolagem sem cortar
o formulário; o cadastro longo e o estado de erro também podem rolar.

O erro 401 foi simulado somente no roteiro do navegador para verificar o estado
visual. Esta tarefa não valida autenticação contra a API real. O navegador
integrado estava desconectado, por isso a inspeção usou Chrome headless local.

Lint: **0 erros e 9 avisos preexistentes**, em arquivos fora desta alteração.
Contraste do projeto: **66/66 pares aprovados**. Build TypeScript/Vite aprovado,
com o aviso anterior de tamanho do bundle.

A primeira execução de `npm run check --workspace=app/web -- -- --maxWorkers=1
--silent` aprovou **322 testes em 29 suítes**, mas encerrou com código 1 porque
o worker de `src/lib/query-client.test.ts` não iniciou dentro do prazo. O erro
ocorreu na inicialização do worker, antes da execução dessa suíte. A repetição
da suíte completa com `--pool=threads --maxWorkers=1 --silent` passou:
**337/337 testes em 30 suítes**. Após a compactação final, o teste das rotas
foi repetido para conferir o layout compartilhado e as transições: **5/5**.
Lint e build também foram repetidos e aprovados na versão compacta final.

Capturas conferidas: [desktop](login-1440x900.png), [celular](login-390x844.png),
[320px](login-320x568.png), [cadastro](register-320x568.png) e
[erro de login](login-error-320x568.png). Medidas e verificações em
[smoke-results.json](smoke-results.json).

Sem alterações de API, schema, dependências ou lockfiles nesta tarefa.
As mudanças anteriores presentes no mobile e na documentação foram preservadas.
