<!-- Descreve as correções autorizadas para revisão no GitHub; consumido somente pela criação do PR para dev. -->
O update de Company repassava o JSON recebido ao Prisma, permitindo escrever em relações como User. O controller agora valida o objeto e os tipos, rejeita campos fora de `name/cnpj/planId` e monta um DTO novo; o repository repete a projeção desses três campos. A regressão reproduziu a escrita aninhada antes da correção (200) e confirma a recusa após ela (400), preservando atualizações legítimas e tenancy.

O onboarding agora consulta a empresa já salva, atualiza o perfil por `/users/me` e retoma apenas perfil/assinatura após falha. Isso libera as ações OWNER sem novo login e evita recriar Company, inclusive ao reabrir a página ou perder a resposta de sua criação. A atualização do store preserva tokens rotacionados e recusa respostas de outra sessão.

Na landing, o item passa a **“Sugestões por IA (em breve)”**. Escopo restrito a QA-01, QA-02, QA-03 e esse texto do QA-25; nenhum outro achado foi corrigido.

### Validação

- API: 648/648 testes em 43 suítes, incluindo 29/29 focais Company/Auth/Subscription; build e lint dos arquivos alterados aprovados.
- Web: `npm run check -- -- --maxWorkers=1 --silent` aprovado, 357/357 testes em 32 suítes, contraste 66/66, lint sem erros (9 avisos preexistentes); build TypeScript/Vite aprovado.
- Regressões novas reproduziram os defeitos na implementação anterior. Investigação e revisão independentes do QA-01 não encontraram bypass ou regressão acionável.
- Chrome no build de produção: 10/10 verificações com API real e falhas 503 controladas de perfil/assinatura; um único POST de Company, retomada após reentrada, OWNER/SLA sem relogin, 375 px sem overflow e aviso “em breve”.
- PRD, backlog e relatório de QA atualizados. Sem schema, migrations, dependências, lockfile ou AGENTS.md alterados; dados demo existentes preservados.

### Ressalvas

O `npm run check` global da API continua parando nos imports não usados `UserEntity` e `UserResponseDTO` em `vulnerability.service.ts:45`, anteriores a esta mudança e fora do escopo. A suíte completa e o build foram executados separadamente.

A API ainda não deduplica pedido de assinatura quando já persistiu PENDING e somente a resposta se perde. Esse limite preexistente foi registrado como trabalho futuro; não se alterou o contrato comercial nem se declarou garantia de exactly-once.
