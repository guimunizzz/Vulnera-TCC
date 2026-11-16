<!-- Explica a configuração, a demonstração e os limites do Assistente Vulnera; existe para reproduzir a entrega com segurança e é consumido pelos mantenedores e pela banca. -->

# Assistente Vulnera

O assistente explica como usar o Vulnera em português brasileiro. Sua personagem é a **Vuvu**, companheira grafite com expressões violetas. Ela percorre lentamente as bordas da tela; clicar em **Ajuda** abre um painel estável. As sugestões apenas preenchem a pergunta: é preciso escolher **Enviar** para receber orientação. Somente esse envio pode chamar o Gemini.

O painel mostra **Gemini** ou **Ajuda local** em cada resposta. Os botões de navegação são definidos pela aplicação e exigem clique; o texto da resposta nunca executa operações. A conversa fica em memória na sessão da aba, sobrevive à navegação protegida e é limpa ao sair, entrar novamente ou trocar de usuário. Fechar o painel preserva a conversa; **Limpar conversa** a apaga e cancela o envio atual.

## Cobertura e permissões

### Vuvu — visual e personalidade

A arte original fornecida pelo responsável é reproduzida por um atlas PNG transparente local, com nove animações e 16 olhares. O player acompanha hover, cursor, deslocamento, digitação, envio, resposta e erro; os movimentos não fazem chamadas à API nem enviam coordenadas ao provedor. Quadros são atualizados no elemento gráfico sem renders React a cada quadro. ZIP, prompts de geração e demais arquivos de trabalho não entram no produto.

O painel usa a identidade visual da plataforma nos temas claro/escuro, com contexto da tela, mensagens, sugestões e origem Gemini/Ajuda local. O histórico pode receber foco para rolagem pelo teclado. Com texto ampliado a partir de 150%, o painel aproveita a altura da viewport e permite rolagem completa, preservando acesso ao envio e à limpeza.

A personalidade de `personalidade.md` foi aplicada ao Gemini por autorização explícita: fala próxima em PT-BR, curiosidade, gentileza, clareza e humor discreto, sem infantilização ou falsa afirmação de ações realizadas. “Quem é você?” e “Quem é a Vuvu?” também são reconhecidas pela ajuda local. A personalidade não amplia acesso a registros, permissões ou operações.

Plano e evidências: [ASSISTENTE_VISUAL_PLANO.md](ASSISTENTE_VISUAL_PLANO.md) e [QA_VUVU_UI_2026-11-15.md](QA_VUVU_UI_2026-11-15.md).

Disponível apenas na web autenticada, incluindo onboarding e visualizador de relatório DAST. Não aparece na landing, login, cadastro, planos, styleguide público ou aplicativo mobile. O assistente não é inserido no HTML original do ZAP e não participa dos PDFs/Excel exportados ou da impressão da página.

| Perfil | Orientação e atalhos |
| --- | --- |
| ADMIN | Dashboard, projetos, aplicações, solicitação de análise, findings, DAST, remediação, playbooks e SLA |
| CLIENT | Dashboard, projetos, aplicações, solicitação de análise, playbooks e SLA. Findings são consultados pelo projeto; não há atalho à listagem global. OWNER/MEMBER continuam sujeitos às regras da plataforma |
| PENTESTER | Dashboard, projetos atribuídos, findings, DAST, remediação e playbooks. Sem atalhos ao cadastro de aplicações, solicitação de análise ou configuração de SLA |

As ações são filtradas no backend e novamente na interface. As rotas e APIs mantêm seus guards e verificações de autorização. Maturidade depende da empresa, e relatórios do projeto: o assistente explica o caminho, sem inventar um destino genérico.

### Compatibilidade com a dev — 2026-11-15

O assistente também reconhece SAST/SCA, detalhe da importação, Threat Intel e Exposure Graph. A base passou de 14 para 17 tópicos e o catálogo de nove para 12 atalhos, preservando os anteriores. IDs de importação, empresa, parâmetros e query strings continuam fora do contexto enviado à API/provedor.

| Novo contexto/atalho | Permissões preservadas da plataforma |
| --- | --- |
| SAST/SCA e detalhe da importação | ADMIN/PENTESTER autorizado; CLIENT recebe explicação da restrição, sem atalho. O assistente não importa, tria ou promove achados. |
| Threat Intel | Os três perfis; a API determina empresas e ações. CLIENT OWNER edita inventário/tria, MEMBER consulta; PENTESTER só nos projetos/empresas autorizados. Sincronizar agora continua exclusivo de ADMIN. |
| Exposure Graph | ADMIN/CLIENT com empresa vinculada; ADMIN sem empresa não tem grafo próprio. PENTESTER não recebe atalho. O grafo usa os dados existentes e não comprova um caminho de ataque. |

O contêiner do assistente envolve todas as rotas protegidas, mantendo lazy loading, limites de carregamento/erro, acessibilidade, transições e guards da dev. Onboarding e relatório DAST continuam cobertos; o HTML original do ZAP permanece isolado. O menu de movimento reduzido e o sistema seguem usando o hook central.

A decisão atual é **ADR-054**, originalmente criada como ADR-048 na branch do assistente. A ADR-048 da dev pertence ao grafo DAST e foi preservada. Validação da integração: [relatório de 15/11/2026](INTEGRACAO_AGENT_AI_DEV_2026-11-15.md).

O contexto externo contém a pergunta, até seis mensagens anteriores, uma tela conhecida sem parâmetros/query string, o perfil autenticado e trechos da ajuda. Não consulta registros, formulários ou DOM para construir o prompt. Perguntas com padrões reconhecíveis de e-mail, URL, identificador ou credencial recebem orientação local, sem envio ao provedor. Isso não é um detector infalível de informação confidencial: use somente documentação e dados fictícios.

### Conteúdo ampliado na revisão do PR #77

O catálogo atual tem **29 tópicos**, com os 17 anteriores preservados e 12 aprofundamentos de domínio/produto: tipos/origens de achados, escopo e elegibilidade, ciclo de findings, OWASP, métricas CVSS, contexto/VRS, política/ciclo SLA, governança do aceite, buscas/watchlists, checklist de maturidade, papéis na empresa e notificações. As fontes e divergências históricas estão em [ASSISTENTE_CONTEUDO_PRODUTO.md](ASSISTENTE_CONTEUDO_PRODUTO.md).

A curadoria é versionada em linguagem de usuário e conferida no código; a documentação técnica, arquitetura e desenvolvimento não são carregados no prompt. O assistente recupera até três tópicos e 6.000 caracteres. Regras e atalhos continuam determinados pela aplicação, sem ler registros reais nem executar operações.

## Preparar o Free Tier

O responsável escolhe o modelo permitido no seu projeto e preenche seu identificador somente no ambiente privado. Consulte o [catálogo](https://ai.google.dev/gemini-api/docs/models), a [tabela de preços](https://ai.google.dev/gemini-api/docs/pricing) e o [ciclo de vida](https://ai.google.dev/gemini-api/docs/deprecations) antes de configurar; disponibilidade e cotas podem mudar. O identificador concreto foi omitido dos arquivos públicos atuais no atendimento ao PR #77, sem reescrever os commits históricos.

1. Entre no Google AI Studio com sua conta e selecione/crie um projeto elegível ao Free Tier.
2. Confira o tier do projeto e as cotas disponíveis no AI Studio. Mantenha-o em **Free**, sem vincular faturamento, habilitar trial pago, fazer pré-pagamento ou ativar serviços adicionais. Veja [faturamento](https://ai.google.dev/gemini-api/docs/billing) e [limites oficiais](https://ai.google.dev/gemini-api/docs/rate-limits).
3. Crie uma chave restrita à Gemini API conforme as [instruções oficiais](https://ai.google.dev/gemini-api/docs/api-key). Não cole a chave em conversas, código, frontend ou commits.
4. Configure-a privadamente no ambiente do backend. O aplicativo não consegue verificar o billing tier pela chave e **não garante custo zero pelo código**. Gratuidade depende da conta, modelo e recursos usados.

O Free Tier pode usar entradas e respostas para melhoria dos produtos Google, inclusive revisão humana. Leia os [termos](https://ai.google.dev/gemini-api/terms). Esta demonstração deve usar ajuda da plataforma e dados fictícios, sem informações confidenciais. A implementação não ativa busca Google, tools, execução de código, arquivos, embeddings ou outros serviços.

## Configuração

### Primeira configuração gratuita no Docker — conferida em 2026-11-15

Para o ensaio gratuito, confira na [tabela oficial](https://aistudio.google.com/docs/pricing) se o modelo escolhido tem texto disponível no Free Tier e use um projeto Free sem faturamento vinculado. O [faturamento pago](https://aistudio.google.com/docs/billing) é uma etapa separada. Não avance por Set up billing/Upgrade/compra de créditos para esse ensaio. Criar uma chave ou preencher o modelo não comprova gratuidade: confira o tier e as cotas do projeto.

Requisitos: conta Google com acesso ao AI Studio (18 anos ou mais), projeto Free, chave privada desse projeto, modelo disponível e internet na API. Docker/API/web já estão preparados no Vulnera. Alguns projetos/contas exigem [verificação por QR no celular](https://aistudio.google.com/docs/verification); ela é distinta de ativar o plano pago.

1. Abra [Google AI Studio](https://aistudio.google.com/) com sua conta e aceite os termos. Em Projects, use o projeto padrão gratuito ou crie um projeto para o Vulnera.
2. Confirme que o projeto está em Free Tier, sem cobrança vinculada. Se pedir verificação, siga o fluxo de Verify project pelo celular. Não ative faturamento para resolver essa etapa.
3. Em [API keys](https://aistudio.google.com/api-keys), escolha Create API key e o projeto gratuito. Guarde a chave somente na máquina/ambiente do backend; nunca em chat, screenshot, código, frontend ou commit.
4. Para o Compose, copie o [`.env.example` da raiz](../.env.example) para `.env` em uma instalação nova. Se já houver `.env`, preserve seu conteúdo e ajuste apenas as variáveis abaixo. Esse arquivo fica na **raiz**, ao lado de `docker-compose.yml`:

   ```dotenv
   ASSISTANT_MODE=gemini
   GEMINI_API_KEY=COLE_A_CHAVE_SOMENTE_NO_ARQUIVO_LOCAL
   GEMINI_MODEL=
   ```

   Preencha `GEMINI_MODEL` com o identificador autorizado somente no `.env` privado, junto da chave. O exemplo versionado deixa ambos vazios. Esse `.env` é ignorado pelo Git. O Compose lê essas variáveis e as encaminha à API. O arquivo `app/api/.env` sozinho não configura a interpolação do Compose. Não use prefixo `VITE_` para chave ou modelo. A alternativa de entrada oculta no PowerShell está abaixo.
5. Quando não houver scans em execução, aplique somente a configuração da API na raiz do repositório:

   ```powershell
   docker compose up -d --no-deps --force-recreate api
   ```

   Não exige rebuild por mudar apenas variáveis. Reinicia a API; dados/volumes são preservados. O watchdog de boot pode encerrar scans ativos como órfãos, por isso a condição de não haver scans em andamento. Não foi executado por esta orientação.
6. Entre em `http://localhost:8086`, abra Ajuda e envie “Como solicito uma análise?”. A resposta precisa mostrar **Gemini** para comprovar a chamada externa. **Ajuda local** continua disponível, mas não comprova que a chave/modelo/cota funcionaram. Consulte [Usage](https://aistudio.google.com/usage) e [Rate limits](https://aistudio.google.com/rate-limit) no AI Studio.

As [cotas](https://aistudio.google.com/docs/rate-limits) variam por modelo/projeto e não equivalem aos buckets do Vulnera. No Free Tier, exceder cota gera limitação; não é autorização para migrar ao pago. Se o projeto já estiver no plano pago, chamadas podem gerar cobranças. O Free Tier também permite uso do conteúdo para melhoria dos produtos Google: use documentação e dados fictícios, sem informações confidenciais.

**Estado histórico da orientação inicial:** nenhum `.env` real, cartão, projeto Google ou serviço havia sido configurado naquela etapa. A configuração e a chamada real com a chave do responsável estavam pendentes.

**Atualização operacional em 2026-11-15:** mediante solicitação explícita, chave cadastrada apenas no `.env` ignorado da raiz e API configurada em modo `gemini` com `modelo configurado privadamente`. Confirmados zero scans ativos; recriada somente a API, sem rebuild, mantendo imagem e volumes. Google respondeu HTTP 200/STOP; rota `/api/assistant/chat`, autenticada com token interno efêmero de 60 s, respondeu HTTP 200 com `source: gemini`. Health/Web HTTP 200 e banco/Web/Mailhog sem recriação. Nenhuma chave/token foi incluída em log ou commit. Esta prova técnica não verifica o tier de faturamento: o responsável ainda deve confirmá-lo no AI Studio. A credencial compartilhada em chat deve ser substituída por uma nova, inserida diretamente no arquivo privado; depois reaplique a API sem scans ativos.

Os placeholders estão em `app/api/.env.example`; arquivos `.env` reais são privados. A implementação inicial não os alterou; a ativação local posterior está registrada acima. Mantenha a configuração já necessária à API (banco, JWT, `PORT`, etc.). Variáveis do assistente são opcionais no boot e lidas por `EnvVar`/`EnvKeys`, exclusivamente no backend.

```dotenv
ASSISTANT_MODE=local
GEMINI_API_KEY=
GEMINI_MODEL=
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
$env:GEMINI_MODEL = Read-Host 'Identificador do modelo autorizado (somente local)'
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

O passeio pausa com hover, foco, conversa aberta, modal, aba oculta, alto contraste ou controle manual. Em tela estreita, a posição fica estável; as expressões ainda podem reagir à conversa. Movimento reduzido, alto contraste e pausa manual interrompem também os quadros animados. Sob modal ou em aba oculta, não há loop ativo. O painel tem Escape, retorno de foco, rolagem acessível e controles de 44px; a plataforma continua utilizável durante uma falha externa.

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

Os resultados da rodada final são registrados em `docs/VALIDACAO_ASSISTENTE_2026-10-23.md` e nos documentos vivos. Testes automatizados usam gateway simulado e nunca a API real do Google. Fixtures de navegador servem para isolar a interface e não são apresentadas como dados reais da plataforma ou validação Gemini ao vivo.

**Gemini ao vivo permanece pendente:** na validação de 23/10/2026, a configuração runtime da API indicou ausência de chave e modelo, sem revelar valores. A integração REST está implementada e testável por gateway; isso não comprova o acesso de uma conta específica. Não foi solicitada ou exposta chave em conversa.

Referências de implementação: [plano e investigação](ASSISTENTE_VULNERA_PLANO.md), [ADR-054](<Vulnera/07-Decisoes/ADR-054 - Assistente contextual com Gemini e ajuda local.md>). A decisão do corte de IA de 03/08/2026 permanece como histórico; sugestões de findings, leitura de registros reais, cálculo por IA, automação de dados e mobile continuam fora desta entrega.
