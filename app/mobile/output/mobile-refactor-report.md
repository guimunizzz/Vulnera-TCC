# Refatoração da área autenticada do mobile — 2026-10-06

Branch: `mobile/api`. Implementação concluída em 100%; sem commit, push ou PR.

Home, ProjectDetail, FindingDetail, Minha conta e navegação receberam uma nova identidade visual, com superfícies liquid glass, violeta `#7c3aed`, títulos editoriais, reflexos discretos e estados próprios de consulta. A mudança visual livre foi explicitamente solicitada pelo usuário. `app/login.tsx`, `src/components/button.tsx` e `src/theme/tokens.ts` permanecem sem diferenças em relação ao estado inicial; a composição visual do login foi preservada.

## Integração e comportamento

- Projetos e resumo da Home são calculados de `GET /projects`; busca e filtro usam apenas a lista autorizada pela API.
- ProjectDetail consome `GET /projects/:id` e `GET /vulnerabilities?projectId=...`. A paginação usa páginas de 30, com carregamento explícito de outras páginas. O resumo por severidade e o total usam facetas/paginação do servidor, não a quantidade parcialmente carregada.
- FindingDetail recebe o DTO completo de `GET /vulnerabilities/:id`. CVSS, descrição, impacto, recomendação, OWASP, SLA/VRS e datas usam valores do servidor; valores ausentes não viram números fictícios.
- Evidências e comentários são carregados ao abrir a respectiva aba. Falhas são mostradas com nova tentativa, separadas dos estados vazios. Comentários também são paginados.
- Imagens usam autenticação em headers no Android/iOS. No preview web, Axios autentica o download e a imagem usa um blob temporário, revogado ao desmontar. Não há token em URL. PDF/TXT permanecem como metadados de arquivo para consulta no web.
- Nomes de autores são resolvidos somente entre os usuários que `GET /users` autoriza. Um autor externo à empresa é identificado como indisponível; nenhum nome fictício ou acesso adicional é criado.
- Minha conta atualiza o perfil por `GET /users/me`; o registro de push e seu status são compartilhados pelo layout. Retorno do app ao primeiro plano verifica novamente a permissão.
- Logout e troca de conta limpam/cancelam o cache. Refresh concorrente tem fila única; uma resposta de sessão antiga não sobrescreve nem encerra a conta nova. Uma falha de rede no refresh preserva a sessão; recusa 401/403 da sessão correspondente a encerra.
- Consultas têm timeout de 20 s, cache fresco de 30 s, uma retentativa transitória e respeito a `Retry-After` em 429. AppState atualiza dados vencidos ao retornar ao app.
- O escopo continua exclusivo do CLIENT e read-only: sem criação/edição, upload, envio de comentários, PDF, IA, chat ou funções administrativas.

## Validação

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado; 0 erros/avisos |
| `node output/api-smoke.mjs` | 10/10; API real, cinco projetos da TechNova |
| `node output/client-smoke.mjs` | 6/6; transporte controlado somente nos testes de concorrência/rede |
| `node output/ui-smoke.mjs` | 14/14; Chrome headless, 390×844 e 320×740 |
| `npx expo export --platform android --output-dir dist-android` | Aprovado |
| Export web para preview | Aprovado |
| Login/componentes originais e manifestos | Sem diferenças |

O smoke visual usa o servidor e os dados de demonstração reais do banco. Para verificar paginação com o cenário pequeno, a rota de teste solicita `pageSize=1` à API real; o app continua com 30. Uma resposta 503 é injetada somente para verificar recuperação da aba de evidências. O caminho normal usa a API real. Nenhuma exceção JavaScript foi encontrada. Os testes de API verificaram que os projetos/findings e os usuários retornados pertencem à empresa autenticada; não substituem a suíte completa de tenancy do backend contra duas empresas.

Evidências: [contratos](./api-smoke-results.json), [cliente HTTP](./client-smoke-results.json), [interface](./ui-smoke-results.json).

## Capturas revisadas

- [Home](./mobile-home-390.png)
- [Projeto](./mobile-project-390.png)
- [Vulnerabilidade](./mobile-finding-390.png)
- [Comentários](./mobile-comments-390.png)
- [Erro e recuperação de evidências](./mobile-evidence-error-390.png)
- [Conta](./mobile-account-390.png)
- [Conta em 320 px](./mobile-account-320.png)

## Ambiente e limites

- Não foi executado o app em Android/iOS físico nesta sessão. A compilação Android e o preview web não comprovam a aparência do blur nativo, Keychain/Keystore ou a chegada de push no aparelho. O código trata push no Expo Go Android/web como indisponível.
- O preview guarda a sessão somente em memória no web. Android/iOS continuam usando exclusivamente SecureStore.
- `react-native-web@~0.21.0` foi instalado temporariamente com `--no-save --package-lock=false`, só para o preview; nenhum manifesto ou lockfile foi alterado. O npm resolveu novamente dependências locais dentro das faixas declaradas (Expo local 57.0.26). Não foi realizada atualização de dependências versionadas.
- Metro recuperou seu cache incompatível por leitura completa e os exports terminaram com sucesso. Não foram apagados dados ou caches de outros trabalhos.
- O mobile não possui script `check` nem suíte Jest própria. Foram usados lint/typecheck, exports e os três scripts de QA acima; não é declarado `npm run check` do backend.
- API, schema, migrations, limites de requisição, AGENTS.md e tela de login não foram alterados. A exclusão preexistente de `.env.example` e as mudanças anteriores nos docs/web foram preservadas.
- Há duas ADRs preexistentes com código ADR-044; esta entrega não renumera documentos antigos. A nova decisão usa ADR-045.

Para conferir no aparelho, recarregue o aplicativo no Expo. Se o Metro ainda usar módulos anteriores à instalação local, reinicie com `npx expo start -c` dentro de `app/mobile`.
