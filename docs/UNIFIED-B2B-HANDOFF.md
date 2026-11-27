# Checkpoint de continuidade — Wave B2B unificada

Atualizado em 2026-11-27 para transferir o estado da Issue #84 sem iniciar nova implementação.

## Repositório e Git

- Branch de trabalho: `feat/unified-onboarding-tenant-security`.
- Worktree: `output/wave-unified-onboarding`.
- HEAD de partida desta preservação: `8c8a9b86589ae86322ac481f1c154a6499cdee18` (`docs: registra refinamentos finais da wave B2B`).
- Base usada pela wave: `db91b70e37ab121dc1d87c071e95620d38bb8bd9`.
- `origin/dev` observado nesta sessão: `54c6f3613420163c9d95bc23cd4f5413d7cb17d7`. A wave ainda não foi integrada à `dev` atual; nenhuma integração foi feita nesta sessão.
- A branch remota `feat/unified-onboarding-tenant-security` não existia no GitHub durante a inspeção e foi criada por push normal, sem force, merge ou rebase. O upstream local foi corrigido para rastrear `origin/feat/unified-onboarding-tenant-security`; a antiga contagem contra `origin/dev` não estimava a divergência da feature.
- Commits de preservação: `0fabfd6b028cc42932891ff0f0cf50e44790fd3f` (API/equipe MEMBER), `12e6e7f68319dfc4715a5af51402937dfc908d96` (VUL-QA-01), `289a1ce05c509e455c8f47d91791f11149983ada` (VUL-QA-02), `563c8a2b507412c2d6118bf7153179d502e32ff8` (VUL-QA-03) e `ba5b1c04b2bcf2f475c97f8fa94ef39b0183839c` (primeiro commit do handoff/PRD/backlog). Esse primeiro push foi verificado com SHA local e remoto iguais; esta atualização documental posterior também será enviada por fast-forward normal.
- Nenhum agente estava ativo durante o inventário.

## Trabalho preservado

Os commits já presentes no HEAD contêm onboarding B2B unificado, gestão de equipe OWNER/MEMBER, convites, segurança multi-tenant, revogação de sessões, central administrativa e proteção de rotas/dados por sessão. O relatório técnico da wave está em `docs/UNIFIED-B2B-TENANT-SECURITY.md`.

As alterações locais posteriores ao HEAD foram separadas em commits por comportamento:

1. **VUL-QA-01 — pluralização:** rótulos de aplicação/projeto e solicitação nos planos, onboarding, solicitação de acesso e detalhes administrativos; testes de singular/plural/zero.
2. **VUL-QA-02 — leitura de equipe por MEMBER:** novo endpoint `GET /api/companies/me/team`, projeção mínima sem dados de gestão, autorização derivada da identidade, cache `no-store`, tela somente leitura e testes de tenant/role/desativação.
3. **VUL-QA-03 — atalhos Findings:** CLIENT deixa de receber atalhos para Findings sem autorização apropriada e o CTA do dashboard do CLIENT leva a projetos; testes focais de navegação.
4. **Checkpoint documental:** handoff, PRD e backlog atualizados sem declarar integração com `dev`, PR aberta ou Issue encerrada.

O commit de API e o commit VUL-QA-02 são partes complementares da mudança MEMBER: o primeiro oferece a leitura autorizada no backend; o segundo a consome como tela somente leitura.

As mudanças de VUL-QA-01/02/03 não foram reimplementadas nesta sessão; foram revisadas e preservadas como estavam no worktree. Não foram executadas suítes nesta sessão.

## Evidências já registradas (não reexecutadas)

Conforme `docs/UNIFIED-B2B-TENANT-SECURITY.md` e `PRD_VIVO.md`:

- Jest focal da wave: 26/26 em três suítes; reteste da regressão de leituras: 18/18, 62 GETs.
- Vitest focal: 128 cenários distintos; lint focal sem erros; checagem TypeScript focal aprovada com tipos Web explícitos; contraste 132/132.
- Vitest integral: 782/783 em 93/94 arquivos; a falha de nome acessível no Security Graph foi reproduzida em `db91b70`. Rodada anterior com forks teve timeouts de inicialização. Estes são resultados anteriores, não validação das três correções QA.
- API: evidências anteriores incluem Jest verde distinto nas 85 suítes após retestes; lint global mantém dois parâmetros sem uso em `memory-job-queue.ts`.
- Docker: build Web registrado com Rollup 4.68.5. Na última observação desta sessão, o daemon Docker não estava disponível; nenhum container ou dado foi alterado.
- A validação manual real relatada em 2026-11-27 confirmou adesão, Turnstile, ativação, convites, associação de membros e separação visual de aplicações. Retestes Chrome das três correções QA permanecem pendentes.

Não somar retestes a totais históricos nem afirmar que os resultados acima cobrem os diffs QA deste checkpoint.

## Pendências de continuidade

Em ordem recomendada:

1. Em ambiente novo, regenerar Prisma Client antes das validações de API e confirmar o schema descartável selecionado.
2. Recuperar e revisar o resultado do runner `vulnera-qa-api-runner.cjs`; a evidência final não foi consolidada neste checkpoint.
3. Investigar a falha da suíte integral do Vitest e preservar a reprodução no baseline `db91b70` antes de classificá-la como regressão.
4. Obter o parecer definitivo de segurança de Luna 3; o gate independente anterior não encontrou achados altos ou críticos confirmados no recorte, mas isso não substitui o parecer pendente.
5. Integrar a `dev` atual em uma etapa separada, com plano e revisão de conflitos; não foi feito aqui.
6. Retestar VUL-QA-01, VUL-QA-02 e VUL-QA-03 no Chrome real.
7. Fazer validação técnica final focal e registrar evidências; não repetir suítes integrais por rotina.
8. Abrir PR da Issue #84 após revisão e autorização apropriada. Nenhum PR foi aberto por este checkpoint.

## Ambiente local e dados

URLs habituais: Web `http://localhost:8086`, API `http://localhost:3001`, MailHog `http://localhost:8025`. Serviços existentes: `vulnera-web`, `vulnera-api`, `vulnera-db`, `vulnera-redis` e `vulnera-mail`.

A execução mais recente documentada reutilizou a stack `vulnera-tcc`, MySQL/Redis/MailHog existentes e o schema manual `vulnera_wave_20261127`. A contagem lida então era 3 empresas, 8 usuários, 6 aplicações e 3 assinaturas. São dados fictícios de QA, mantidos exclusivamente no banco local; não exportar nem copiar esse banco. Não executar seed sobre esse schema existente.

No computador de origem, as configurações locais identificadas para transferência segura e separada do Git são:

- `%LOCALAPPDATA%\Vulnera\wave-20261127.env`;
- `%LOCALAPPDATA%\Vulnera\wave-20261127.compose.yml`;
- `%LOCALAPPDATA%\Vulnera\wave-20261127-web-7240030.compose.yml`;
- `.env.turnstile-real.local` na raiz do repositório (arquivo ignorado, com credenciais reais).

Não incluir, imprimir ou enviar essas credenciais em commits, logs, chat ou relatório. No novo computador, configurar credenciais próprias do Turnstile e verificar que a secret fica apenas na API e a site key pública apenas no build Web. Confirmar `hostname=localhost` e `action=access-request` antes do teste manual. Não sobrescrever o banco local atual nem executar comandos de reset/remoção de volumes.

Para uma base de QA nova, confirmar primeiro que a conexão aponta a um schema descartável exclusivo; então usar `npx prisma migrate deploy`. Executar seed apenas nesse schema descartável e após conferir o script e as variáveis efetivas. A aplicação atual já tinha 25 migrations na validação reportada. A stack de desenvolvimento e seus dados existentes não precisam de reseed.

## Continuidade no outro computador

```powershell
git clone --branch feat/unified-onboarding-tenant-security https://github.com/guimunizzz/Vulnera-TCC.git
Set-Location Vulnera-TCC
git status --short --branch
git rev-parse HEAD
```

Transferir as configurações locais citadas acima por canal seguro e recriar os arquivos nos mesmos locais relativos ao novo usuário. Antes de iniciar Docker, conferir as portas 8086, 3001 e 8025 e os nomes de serviços existentes. Verificar a configuração sem imprimir os valores secretos. Para continuar QA, regenerar Prisma Client, consultar migrations e utilizar o schema de validação acordado; não rodar reset nem seed no schema manual existente.

## Arquivos locais deliberadamente fora dos commits

- `output/issue51-stage6/`: screenshots, traces e contextos de Playwright de uma fase anterior da Issue #51; preservados localmente para não misturar outra wave.
- `output/wave-validation/`: baseline de comparação, tar de fontes e JSON bruto de Vitest; artefatos gerados, não necessários para reconstruir a implementação e não incluídos no Git.
- No checkout raiz `dev`, outputs locais de Issues #19/#20, worktree da Issue #51 e diretório de testes da Etapa 7 permanecem inalterados.
- Há um stash em `fix/fase-6.8-findings-p1` (`fase-6.8-cp1-INFRA-002-deferred`); pertence a outra branch e não foi tocado.
- O worktree `output/issue51-integration-worktree` continua separado, com apenas artefatos untracked de validação; não foi modificado.

Nenhum desses itens foi apagado. Arquivos ignorados com segredos permanecem fora do Git.
