<!-- Explica a configuração, a demonstração e os limites do Assistente Vulnera; existe para reproduzir a entrega com segurança e é consumido pelos mantenedores e pela banca. -->

# Assistente Vulnera

O assistente explica como usar o Vulnera em português brasileiro. A sentinela percorre lentamente as bordas da tela; clicar em **Ajuda** abre um painel estável. As sugestões apenas preenchem a pergunta: é preciso escolher **Enviar** para receber orientação. Somente esse envio pode chamar o Gemini.

O painel mostra **Gemini** ou **Ajuda local** em cada resposta. Os botões de navegação são definidos pela aplicação e exigem clique; o texto da resposta nunca executa operações. A conversa fica em memória na sessão da aba, sobrevive à navegação protegida e é limpa ao sair, entrar novamente ou trocar de usuário. Fechar o painel preserva a conversa; **Limpar conversa** a apaga e cancela o envio atual.

## Cobertura e permissões

Disponível apenas na web autenticada, incluindo onboarding e visualizador de relatório DAST. Não aparece na landing, login, cadastro, planos, styleguide público ou aplicativo mobile. O assistente não é inserido no HTML original do ZAP e não participa dos PDFs/Excel exportados ou da impressão da página.

| Perfil | Orientação e atalhos |
| --- | --- |
| ADMIN | Dashboard, projetos, aplicações, solicitação de análise, findings, DAST, remediação, playbooks e SLA |
| CLIENT | Dashboard, projetos, aplicações, solicitação de análise, playbooks e SLA. Findings são consultados pelo projeto; não há atalho à listagem global. OWNER/MEMBER continuam sujeitos às regras da plataforma |
| PENTESTER | Dashboard, projetos atribuídos, findings, DAST, remediação e playbooks. Sem atalhos ao cadastro de aplicações, solicitação de análise ou configuração de SLA |

As ações são filtradas no backend e novamente na interface. As rotas e APIs mantêm seus guards e verificações de autorização. Maturidade depende da empresa, e relatórios do projeto: o assistente explica o caminho, sem inventar um destino genérico.

O contexto externo contém a pergunta, até seis mensagens anteriores, uma tela conhecida sem parâmetros/query string, o perfil autenticado e trechos da ajuda. Não consulta registros, formulários ou DOM para construir o prompt. Perguntas com padrões reconhecíveis de e-mail, URL, identificador ou credencial recebem orientação local, sem envio ao provedor. Isso não é um detector infalível de informação confidencial: use somente documentação e dados fictícios.

## Preparar o Free Tier

Escolha conferida em **23/10/2026**: `gemini-3.5-flash-lite`, [estável](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), com texto disponível no [Free Tier](https://ai.google.dev/gemini-api/docs/pricing) e sem desligamento anunciado no [ciclo de vida](https://ai.google.dev/gemini-api/docs/deprecations). Confira novamente antes da apresentação; disponibilidade e cotas podem mudar.

1. Entre no Google AI Studio com sua conta e selecione/crie um projeto elegível ao Free Tier.
2. Confira o tier do projeto e as cotas disponíveis no AI Studio. Mantenha-o em **Free**, sem vincular faturamento, habilitar trial pago, fazer pré-pagamento ou ativar serviços adicionais. Veja [faturamento](https://ai.google.dev/gemini-api/docs/billing) e [limites oficiais](https://ai.google.dev/gemini-api/docs/rate-limits).
3. Crie uma chave restrita à Gemini API conforme as [instruções oficiais](https://ai.google.dev/gemini-api/docs/api-key). Não cole a chave em conversas, código, frontend ou commits.
4. Configure-a privadamente no ambiente do backend. O aplicativo não consegue verificar o billing tier pela chave e **não garante custo zero pelo código**. Gratuidade depende da conta, modelo e recursos usados.

O Free Tier pode usar entradas e respostas para melhoria dos produtos Google, inclusive revisão humana. Leia os [termos](https://ai.google.dev/gemini-api/terms). Esta demonstração deve usar ajuda da plataforma e dados fictícios, sem informações confidenciais. A implementação não ativa busca Google, tools, execução de código, arquivos, embeddings ou outros serviços.

## Configuração

Os placeholders estão em `app/api/.env.example`; arquivos `.env` reais são privados e não foram editados pela entrega. Mantenha a configuração já necessária à API (banco, JWT, `PORT`, etc.). Variáveis do assistente são opcionais no boot e lidas por `EnvVar`/`EnvKeys`, exclusivamente no backend.

```dotenv
ASSISTANT_MODE=local
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
ASSISTANT_TIMEOUT_MS=15000
ASSISTANT_MAX_OUTPUT_TOKENS=500
RATE_LIMIT_ASSISTANT_USER_PER_HOUR=10
RATE_LIMIT_ASSISTANT_USER_BURST=5
RATE_LIMIT_ASSISTANT_GLOBAL_PER_HOUR=30
RATE_LIMIT_ASSISTANT_GLOBAL_BURST=10
```

Para ensaiar sem chamadas externas, use `ASSISTANT_MODE=local`. Para Gemini, use `ASSISTANT_MODE=gemini` com chave e modelo preenchidos no ambiente privado. Chave/modelo ausentes, modo inválido, falha externa ou resposta inválida preservam a ajuda local; não impedem a API de iniciar.

O gateway chama somente `generativelanguage.googleapis.com`, por `fetch`, sem seguir redirecionamentos, em uma tentativa por pergunta. Para o modelo recomendado, usa saída limitada e thinking mínimo, sem parâmetros de amostragem incompatíveis. `store:false` não altera os termos de uso de dados do Free Tier.

### Docker

O Compose encaminha as variáveis explicitamente em `services.api.environment`. Nenhuma delas usa prefixo `VITE_*`; a chave não entra no bundle web. Alterar o modo no host exige recriar o container API. Para aplicar também a interface modificada, reconstrua os dois serviços:

```powershell
$env:ASSISTANT_MODE = 'local'
docker compose up -d --build --no-deps api web
```

Para fornecer a chave sem digitá-la como literal no histórico do PowerShell, use uma entrada oculta na máquina da demonstração:

```powershell
$assistantSecret = Read-Host 'GEMINI_API_KEY (entrada oculta)' -AsSecureString
$env:GEMINI_API_KEY = [System.Net.NetworkCredential]::new('', $assistantSecret).Password
$env:GEMINI_MODEL = 'gemini-3.5-flash-lite'
$env:ASSISTANT_MODE = 'gemini'
docker compose up -d --build --no-deps api web
Remove-Item Env:\GEMINI_API_KEY
$assistantSecret.Dispose()
```

A chave continua necessária no ambiente privado do container da API. Não publique dumps de suas variáveis. Para voltar ao ensaio local, configure `ASSISTANT_MODE=local` e recrie a API. A entrada habitual do produto é `http://localhost:8086`.

### Desenvolvimento sem containers da aplicação

Use o gerenciador do repositório para instalar as dependências (este checkout não possui lockfile raiz), gere o Prisma Client conforme o fluxo já existente e inicie API/web com a configuração local de banco/JWT. Por exemplo, com o ambiente privado já preparado:

```powershell
npm install --package-lock=false
npm run prisma:generate --workspace=app/api
$env:ASSISTANT_MODE = 'local'
npm run dev --workspace=app/api
# Em outro terminal, com VITE_API_URL apontando para sua API:
npm run dev --workspace=app/web
```

## Limites e falhas

| Controle | Comportamento |
| --- | --- |
| Pergunta | Até 1.000 caracteres, sem texto vazio |
| Histórico transmitido | Até seis mensagens `user/assistant`, 1.000 caracteres cada e 4.000 no total |
| Ajuda recuperada | Até três tópicos e 6.000 caracteres |
| Saída externa | Até 500 tokens; resposta aceita até 4.000 caracteres |
| Timeout | 15 segundos por padrão; configuração de 100 a 15.000 ms |
| Tokens de saída configuráveis | 64 a 500; valor inválido volta ao padrão |
| Cota pessoal da aplicação | Bucket com rajada de cinco e reposição de 10 tokens/hora |
| Cota global do assistente | Bucket com rajada de dez e reposição de 30 tokens/hora |

Os buckets repõem continuamente: não são limites de uma janela civil exata. São controles da aplicação, separados das cotas Google e dos limitadores gerais HTTP já existentes. Tentativas negadas pela cota global não consomem a reserva pessoal. Os budgets do assistente não são descartados antes do tempo necessário à reposição nem expulsos para abrir espaço a novas chaves.

Quando a própria aplicação limita uma requisição, preserva HTTP 429, `code: RATE_LIMITED`, mensagem existente, `retryAfterSeconds` e `Retry-After`. A interface informa a espera e não repete automaticamente. Timeout, indisponibilidade, cota do Google ou resposta vazia/bloqueada/inválida resultam em ajuda local quando houver tópico. Fora da ajuda documentada, explica o limite e oferece assuntos relacionados.

Os contadores reiniciam com o processo e não são coordenados entre várias instâncias. Fechar a aba ou recarregar termina a conversa; outra aba possui memória própria. Sem internet externa, a demonstração pressupõe que a **API local continue funcionando**. Ajuda local não equivale a Gemini ao vivo.

O mascote pausa com hover, foco, conversa aberta, modal, aba oculta ou controle manual. Em tela estreita e `prefers-reduced-motion`, fica estático em posição previsível. O painel tem Escape, retorno de foco, rolagem interna e controles de 44px; a plataforma continua utilizável durante uma falha externa.

## Preparar a apresentação

Use contas fictícias de ADMIN, CLIENT e PENTESTER do ambiente de demonstração. Antes da banca, confira login, uma aplicação ativa e uma assinatura ativa com capacidade para análise. Caso queira mostrar relatórios, prepare um projeto fictício em revisão/concluído. O assistente não cria esses dados; use os fluxos/seeds de demonstração já existentes, sem resetar o banco que contém trabalho a preservar.

Para a pergunta de solicitação, prefira CLIENT ou ADMIN. Confirme o modo e faça poucos envios manuais antes da apresentação, respeitando a cota da aplicação. Não gaste chamadas abrindo/fechando o painel ou navegando: essas ações são locais.

### Roteiro de aproximadamente três minutos

1. **0:00–0:25:** entrar como CLIENT e observar a sentinela nas bordas; demonstrar pausa por hover ou botão.
2. **0:25–1:05:** abrir Ajuda, perguntar **“Como solicito uma análise?”**, enviar e apontar a origem real da resposta.
3. **1:05–1:30:** clicar no atalho **Solicitar análise**. Explicar que a navegação é permitida pelo perfil e acionada pela pessoa; o assistente não envia formulários.
4. **1:30–2:00:** perguntar **“O que posso fazer nesta tela?”**. Mostrar que a conversa permaneceu e o contexto acompanha a tela.
5. **2:00–2:30:** perguntar **“Qual a diferença entre CVSS e VRS?”** ou **“Como funciona o SLA?”**. Explicar que os conceitos são orientados, sem recalcular valores.
6. **2:30–3:00:** mostrar o modo local previamente preparado, com **Ajuda local** visível. Explicar a alternativa para indisponibilidade externa. Trocar o modo exige recriar a API; evite reiniciar a stack durante os três minutos.

## Validação e limites da entrega

Em 23/10/2026, a entrega foi aplicada à stack local em
`http://localhost:8086`, com `ASSISTANT_MODE=local`. Login real dos três
perfis na API e fluxo CLIENT completo no navegador foram exercitados, sem
criar ou alterar registros de negócio. Builds host/Docker, web 400/400,
API focal 47/47 e QA do build servido 12/12 aprovados. O check geral API
mantém dois imports antigos de lint e uma assertion anterior de header
Excel; essas ressalvas estão separadas das provas do assistente no relatório.

Os resultados da rodada final são registrados em `output/assistant/VALIDACAO.md` e nos documentos vivos. Testes automatizados usam gateway simulado e nunca a API real do Google. Fixtures de navegador servem para isolar a interface e não são apresentadas como dados reais da plataforma ou validação Gemini ao vivo.

**Gemini ao vivo permanece pendente:** na validação de 23/10/2026, a configuração runtime da API indicou ausência de chave e modelo, sem revelar valores. A integração REST está implementada e testável por gateway; isso não comprova o acesso de uma conta específica. Não foi solicitada ou exposta chave em conversa.

Referências de implementação: [plano e investigação](ASSISTENTE_VULNERA_PLANO.md), [ADR-048](<Vulnera/07-Decisoes/ADR-048 - Assistente contextual com Gemini e ajuda local.md>). A decisão do corte de IA de 03/08/2026 permanece como histórico; sugestões de findings, leitura de registros reais, cálculo por IA, automação de dados e mobile continuam fora desta entrega.
