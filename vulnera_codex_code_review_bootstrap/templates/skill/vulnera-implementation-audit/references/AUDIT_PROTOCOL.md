# Override operacional desta execução

Antes das regras abaixo, aplique estas restrições adicionais:

- revisão e mapeamento somente; não corrigir nada;
- toda escrita durante a auditoria deve ficar em `docs/code-review/**`;
- `docs/code-review/MASTER_CHECKLIST.md` é imutável e não deve ter checkboxes marcados;
- especialistas são read-only;
- execução mutável/runtime não autorizada deve virar `NOT_VALIDATED`;
- além do relatório principal, gerar `docs/code-review/RECOMMENDATIONS.md` com sugestões finais priorizadas, sem patches.

---

# Vulnera — Protocolo de Auditoria de Implementação

> Este arquivo preserva o protocolo de auditoria fornecido pelo responsável do projeto. As instruções de orquestração da Skill complementam este protocolo; não o substituem.

# Objetivo

Você já realizou anteriormente uma análise completa da documentação do projeto **Vulnera** e gerou uma **Checklist Mestre de Implementação**, cobrindo funcionalidades, regras de negócio, arquitetura, segurança, integrações, fluxos, design, infraestrutura e demais requisitos do sistema.

Agora quero executar a **segunda etapa da auditoria**: comparar essa especificação com o **estado real e atual do projeto**.

Vou fornecer:

* O link do repositório do projeto Vulnera, apontando para a branch **`dev`**, que deve ser considerada a versão mais atualizada do projeto.
* Um arquivo `.zip` contendo o código-fonte do projeto.
* A Checklist Mestre criada anteriormente.

Sua tarefa é analisar profundamente o código atual e usar a checklist como referência para produzir um **novo arquivo `.md` de auditoria**, mostrando com precisão:

* O que já foi implementado.
* O que foi parcialmente implementado.
* O que ainda não foi implementado.
* O que foi implementado de maneira diferente da especificação.
* O que existe no código mas não estava previsto na documentação.
* Quais regras de negócio estão corretamente implementadas.
* Quais regras estão incompletas ou incorretas.
* Quais problemas técnicos existem.
* Quais problemas de design/UX existem.
* Quais riscos precisam de atenção.
* Quais pendências devem ser priorizadas.

O objetivo não é apenas verificar se determinados arquivos ou componentes existem.

Quero descobrir o **estado funcional real do Vulnera**.

---

# Fonte de verdade

Utilize as fontes nesta ordem de finalidade:

1. **Checklist Mestre**

   * representa o comportamento esperado do projeto.

2. **Branch `dev` do repositório**

   * representa o estado atual esperado do código.

3. **Arquivo `.zip`**

   * deve ser utilizado como fonte adicional para inspeção integral do código e estrutura.

Caso existam diferenças entre o repositório e o `.zip`, registre explicitamente.

Não misture silenciosamente versões diferentes.

Utilize:

`⚠️ Divergência entre repositório e ZIP`

e explique o que foi encontrado.

---

# Regra fundamental da auditoria

Não considere um requisito implementado simplesmente porque existe:

* um arquivo;
* uma função;
* um componente;
* uma rota;
* uma migration;
* uma tela;
* um endpoint;
* um botão;
* um schema;
* um service.

Para marcar algo como implementado, verifique se o **fluxo completo realmente existe e está conectado**.

Exemplo:

Uma funcionalidade de exclusão não deve ser considerada implementada apenas porque existe:

`deleteProject()`

Verifique também, quando aplicável:

* Como ela é chamada.
* Se a rota existe.
* Se existe autorização.
* Se regras de negócio são validadas.
* Se o banco é atualizado corretamente.
* Se relacionamentos são tratados.
* Se o frontend utiliza a funcionalidade.
* Se erros são tratados.
* Se existe feedback ao usuário.
* Se os estados posteriores são atualizados.
* Se testes cobrem o comportamento.

A auditoria deve avaliar **comportamento real**, não apenas presença de código.

---

# Etapa 1 — Inspecione completamente o projeto

Antes de comparar com a checklist, faça uma análise estrutural completa.

Mapeie:

* Estrutura de diretórios.
* Stack utilizada.
* Frameworks.
* Dependências relevantes.
* Backend.
* Frontend.
* Banco de dados.
* ORM.
* APIs.
* Models.
* Schemas.
* Migrations.
* Services.
* Controllers.
* Repositories.
* Middlewares.
* Hooks.
* Contexts.
* Stores.
* Componentes.
* Pages/routes.
* Jobs.
* Workers.
* Filas.
* Integrações.
* Webhooks.
* Autenticação.
* Autorização.
* Permissões.
* Infraestrutura.
* Containers.
* CI/CD.
* Configurações.
* Variáveis de ambiente referenciadas.
* Testes.
* Seeds.
* Scripts.
* Logs.
* Observabilidade.
* Documentação interna.
* TODOs e FIXMEs existentes no código.

Não se limite a arquivos diretamente relacionados aos itens da checklist.

Primeiro compreenda a arquitetura real.

---

# Etapa 2 — Reconstrua a arquitetura implementada

Crie mentalmente um mapa do sistema atual.

Identifique:

## Backend

* Domínios.
* Entidades.
* Services.
* APIs.
* Autenticação.
* Autorização.
* Regras de negócio.
* Persistência.
* Integrações.
* Processamentos assíncronos.

## Frontend

* Rotas.
* Layouts.
* Páginas.
* Componentes.
* Estados globais.
* Estados locais.
* Hooks.
* Comunicação com APIs.
* Formulários.
* Validações.
* Fluxos de navegação.
* Feedbacks ao usuário.

## Dados

* Entidades.
* Campos.
* Relacionamentos.
* Constraints.
* Índices.
* Enums.
* Estados.
* Migrations.
* Seeds.

## Infraestrutura

* Serviços utilizados.
* Configurações.
* Variáveis de ambiente.
* Deploy.
* CI/CD.
* Containers.
* Serviços externos.

Use esse entendimento como contexto para toda a auditoria posterior.

---

# Etapa 3 — Compare TODO o projeto com a Checklist Mestre

Percorra a checklist item por item.

Para cada requisito, classifique o estado utilizando exclusivamente uma destas categorias:

### ✅ IMPLEMENTADO

Use somente quando o requisito estiver realmente funcional e consistente com a especificação.

### 🟡 PARCIALMENTE IMPLEMENTADO

Existe uma implementação relevante, mas falta alguma parte necessária para completar o comportamento esperado.

### ❌ NÃO IMPLEMENTADO

Não existe implementação funcional suficiente.

### 🔴 IMPLEMENTADO COM DIVERGÊNCIA

Existe implementação, mas ela contradiz ou se distancia de maneira relevante do requisito esperado.

### ⚠️ NÃO FOI POSSÍVEL VALIDAR

Utilize quando não houver evidência suficiente no material analisado para concluir o estado.

### 🔵 IMPLEMENTAÇÃO EXTRA

Para funcionalidades existentes no projeto que não aparecem na Checklist Mestre ou na documentação original.

---

# Evidências obrigatórias

Nunca atribua uma classificação sem evidência.

Para cada item relevante, informe:

* Status.
* Evidência.
* Caminho do arquivo.
* Função, classe, componente, rota ou módulo relacionado.
* Explicação curta do motivo da classificação.
* O que falta, caso esteja parcial.
* Divergência encontrada, quando aplicável.

Exemplo:

### 🟡 Recuperação de senha

**Status:** Parcialmente implementado

**Evidências:**

* `src/modules/auth/auth.service.ts`
* Função `requestPasswordReset()`
* `src/pages/forgot-password.tsx`

**Encontrado:**

* Solicitação de recuperação criada.
* Token gerado.
* Formulário frontend existente.

**Faltando:**

* Expiração do token não é validada.
* Token não é invalidado após utilização.
* Não existe rate limit.
* Fluxo de envio de e-mail não está conectado.

---

# Etapa 4 — Valide regras de negócio

Não avalie somente funcionalidades visíveis.

Compare cuidadosamente todas as regras de negócio da checklist com o código.

Para cada regra, procure:

* Onde ela está implementada.
* Em qual camada.
* Se pode ser contornada.
* Se frontend e backend aplicam a mesma regra.
* Se a validação acontece no servidor.
* Se existem edge cases.
* Se existem caminhos alternativos que ignoram a validação.

Uma regra não deve ser considerada corretamente implementada quando existe somente no frontend.

Exemplo:

Se determinada ação exige `admin`, mas o frontend apenas esconde o botão enquanto o endpoint continua acessível, classifique isso como:

`🔴 IMPLEMENTADO COM DIVERGÊNCIA — autorização somente na interface`

---

# Etapa 5 — Analise fluxos ponta a ponta

Para todas as funcionalidades principais, siga o fluxo completo.

Exemplo conceitual:

`UI → formulário → validação → API → autenticação → autorização → regra de negócio → service → banco → integração → retorno → atualização da UI`

Verifique se cada elo existe.

Procure especialmente por:

* componentes sem backend conectado;
* endpoints sem consumidores;
* serviços nunca utilizados;
* telas estáticas;
* botões sem ação;
* mocks;
* placeholders;
* hardcodes;
* dados fictícios;
* funções incompletas;
* TODOs;
* código comentado;
* branches temporárias;
* responses simuladas.

Diferencie claramente **interface pronta** de **funcionalidade funcional**.

---

# Etapa 6 — Auditoria de frontend e design

Além das funcionalidades, faça uma avaliação da implementação visual e de UX.

Analise:

## Consistência visual

* Cores.
* Tipografia.
* Espaçamentos.
* Border radius.
* Sombras.
* Componentes.
* Ícones.
* Layout.
* Padrões de interface.

## Componentização

* Componentes duplicados.
* Componentes muito grandes.
* Componentes reutilizáveis.
* Uso consistente do design system.
* Hardcodes visuais.

## UX

Verifique estados de:

* Loading.
* Empty state.
* Error state.
* Success.
* Disabled.
* Submitting.
* Confirmação.
* Cancelamento.
* Exclusão.
* Falta de permissão.

Analise também:

* Feedback das ações.
* Navegação.
* Fluxos interrompidos.
* Modais.
* Formulários.
* Validação.
* Mensagens de erro.
* Responsividade.
* Acessibilidade básica.

Quando não for possível validar visualmente determinada característica apenas pelo código, não invente conclusões.

Use:

`⚠️ Requer validação visual/manual`

---

# Etapa 7 — Auditoria de backend

Analise especialmente:

* Separação de responsabilidades.
* Validação de entrada.
* Autenticação.
* Autorização.
* Regras de negócio.
* Tratamento de erros.
* Transações.
* Idempotência.
* Concorrência.
* Queries.
* Performance.
* N+1.
* Paginação.
* Filtros.
* Segurança.
* Consistência dos responses.
* Acoplamento.
* Duplicação.
* Dead code.
* Código não utilizado.

Não faça apenas uma revisão estética.

Priorize problemas que possam causar:

* comportamento incorreto;
* perda de dados;
* acesso indevido;
* inconsistência de estado;
* vulnerabilidades;
* erros em produção.

---

# Etapa 8 — Banco de dados

Compare o modelo de dados esperado com o modelo implementado.

Analise:

* Tabelas.
* Entidades.
* Campos.
* Tipos.
* Nullability.
* Defaults.
* Primary keys.
* Foreign keys.
* Relacionamentos.
* Constraints.
* Índices.
* Enums.
* Timestamps.
* Soft delete.
* Cascade.
* Unique constraints.
* Migrations.

Procure inconsistências entre:

`Schema atual ↔ migrations ↔ models ↔ código ↔ regras de negócio`

Identifique também migrations potencialmente perigosas ou inconsistentes.

---

# Etapa 9 — Segurança

Faça uma seção específica de auditoria de segurança.

Verifique, quando aplicável:

* Autenticação.
* Autorização.
* IDOR.
* Isolamento entre tenants.
* Validação de ownership.
* Escalada de privilégio.
* Exposição de dados.
* Secrets.
* Tokens.
* Senhas.
* Sessões.
* Cookies.
* CORS.
* CSRF.
* XSS.
* SQL injection.
* Mass assignment.
* Uploads.
* Webhooks.
* Rate limiting.
* Brute force.
* Logs sensíveis.
* Variáveis de ambiente.
* Endpoints administrativos.

Não reporte vulnerabilidades apenas por possibilidade teórica.

Associe cada achado a evidências do código.

---

# Etapa 10 — Testes

Analise a cobertura lógica dos testes existentes.

Identifique:

* Unit tests.
* Integration tests.
* E2E.
* Testes de regras de negócio.
* Testes de autorização.
* Testes de edge cases.
* Fluxos críticos sem testes.

Não considere uma funcionalidade completa somente porque existe um teste.

Compare o teste com a implementação real.

---

# Etapa 11 — Código incompleto ou suspeito

Procure explicitamente por indicadores como:

* `TODO`
* `FIXME`
* `HACK`
* `XXX`
* `mock`
* `fake`
* `placeholder`
* `temporary`
* `not implemented`
* funções vazias;
* retornos hardcoded;
* arrays estáticos usados como dados reais;
* dados fictícios;
* feature flags temporárias;
* código comentado;
* endpoints stub;
* componentes não conectados.

Crie uma seção dedicada com esses achados.

---

# Etapa 12 — Funcionalidades órfãs

Identifique dois tipos de problema.

## Frontend sem backend

Exemplo:

Uma tela, botão ou formulário existe, mas não existe operação funcional correspondente.

## Backend sem frontend

Existe API ou funcionalidade implementada, mas nenhuma interface ou fluxo utiliza aquela capacidade quando deveria.

Liste ambos.

---

# Etapa 13 — Código morto e implementações abandonadas

Identifique, quando houver evidência suficiente:

* Componentes não utilizados.
* Rotas não utilizadas.
* Services sem referências.
* APIs abandonadas.
* Schemas antigos.
* Código legado.
* Dependências aparentemente não utilizadas.
* Implementações duplicadas da mesma funcionalidade.

Não classifique algo como dead code apenas por não encontrar rapidamente uma referência. Confirme o máximo possível.

---

# Etapa 14 — Divergências entre documentação e implementação

Crie uma seção dedicada chamada:

# Divergências entre especificação e implementação

Para cada divergência informe:

* Comportamento esperado.
* Comportamento implementado.
* Arquivos envolvidos.
* Impacto.
* Recomendação.

---

# Etapa 15 — Funcionalidades extras

Também quero saber se o código evoluiu além da documentação.

Crie:

# Implementações existentes não previstas na Checklist Mestre

Para cada item explique:

* O que foi implementado.
* Onde está.
* Qual parece ser seu objetivo.
* Se aparenta estar completo.
* Se deveria ser incorporado oficialmente à especificação.

---

# Etapa 16 — Dívida técnica

Crie uma análise objetiva de dívida técnica.

Classifique os problemas, quando possível, em:

### P0 — Crítico

Pode causar:

* vulnerabilidade grave;
* perda de dados;
* corrupção de dados;
* indisponibilidade;
* violação severa de regra de negócio.

### P1 — Alta prioridade

Bloqueia funcionalidade importante ou causa comportamento significativamente incorreto.

### P2 — Média prioridade

Problema relevante de manutenção, UX, arquitetura ou qualidade.

### P3 — Baixa prioridade

Melhorias, refactors ou refinamentos sem impacto funcional significativo.

Não infle artificialmente severidades.

---

# Formato do documento final

Crie um único arquivo Markdown chamado:

`docs/code-review/VULNERA_IMPLEMENTATION_AUDIT.md`

A estrutura deve ser aproximadamente:

# Vulnera — Auditoria do Estado Atual

## 1. Resumo executivo

Inclua métricas consolidadas como:

* Total de requisitos analisados.
* ✅ Implementados.
* 🟡 Parcialmente implementados.
* ❌ Não implementados.
* 🔴 Implementados com divergência.
* ⚠️ Não validados.
* 🔵 Funcionalidades extras.

Calcule também percentuais quando possível.

---

## 2. Estado geral do projeto

Explique:

* Grau de completude.
* Áreas mais maduras.
* Áreas mais incompletas.
* Maiores riscos.
* Principais bloqueadores.

---

## 3. Arquitetura encontrada

Descreva de maneira objetiva a arquitetura real identificada.

---

## 4. Matriz completa da Checklist Mestre

Para **cada item da checklist original**, preserve a rastreabilidade.

Formato recomendado:

### [ID ou nome do requisito]

**Status:** ✅ / 🟡 / ❌ / 🔴 / ⚠️

**Esperado:**
Descrição curta do requisito.

**Encontrado:**
Descrição objetiva da implementação real.

**Evidências:**

* `caminho/arquivo.ext`
* `Classe.função()`
* `rota`
* `componente`

**Faltando / divergências:**

* ...

**Ação recomendada:**

* ...

---

## 5. Regras de negócio

## 6. Backend

## 7. Frontend

## 8. Banco de dados

## 9. Autenticação e autorização

## 10. Segurança

## 11. Integrações

## 12. Jobs e processamento assíncrono

## 13. UX e design

## 14. Tratamento de erros

## 15. Testes

## 16. Infraestrutura e configuração

## 17. Código incompleto, mocks e placeholders

## 18. Funcionalidades órfãs

## 19. Código morto ou legado

## 20. Divergências entre especificação e implementação

## 21. Implementações extras

## 22. Dívida técnica

## 23. Pontos de atenção

## 24. Pendências priorizadas

---

# Checklist final de pendências

Ao final, produza uma nova checklist exclusivamente com **ações ainda necessárias**.

Organize por prioridade.

## P0 — Crítico

* [ ] ...

## P1 — Alta prioridade

* [ ] ...

## P2 — Média prioridade

* [ ] ...

## P3 — Melhorias

* [ ] ...

Cada item deve apontar, quando possível:

* módulo afetado;
* arquivos relevantes;
* requisito original;
* problema atual;
* resultado esperado após correção.

Essa seção deve poder ser utilizada diretamente como **backlog técnico do projeto**.

---

# Matriz de cobertura

Crie também uma tabela resumida por domínio.

Exemplo:

| Área             | Total | Implementado | Parcial | Ausente | Divergente | Cobertura |
| ---------------- | ----: | -----------: | ------: | ------: | ---------: | --------: |
| Autenticação     |     X |            X |       X |       X |          X |        X% |
| Usuários         |     X |            X |       X |       X |          X |        X% |
| Vulnerabilidades |     X |            X |       X |       X |          X |        X% |
| Frontend         |     X |            X |       X |       X |          X |        X% |

Calcule a cobertura a partir dos requisitos realmente avaliados.

Não invente precisão quando a classificação não permitir cálculo confiável.

---

# Regras contra falsos positivos

É extremamente importante:

1. Não marcar uma funcionalidade como implementada apenas pela existência de código relacionado.
2. Não assumir que um componente está sendo utilizado.
3. Não assumir que uma API funciona apenas porque a rota existe.
4. Não assumir que migrations foram aplicadas.
5. Não assumir que variáveis de ambiente estão configuradas.
6. Não assumir que uma integração externa funciona apenas porque existe código de integração.
7. Não assumir que autorização frontend representa segurança backend.
8. Não transformar comentários ou TODOs em funcionalidades existentes.
9. Não considerar mock como implementação real.
10. Não considerar tela visualmente pronta como funcionalidade completa.
11. Não inventar resultados de execução que você não conseguiu testar.
12. Não afirmar que algo funciona em runtime sem evidência suficiente.

Quando houver dúvida, utilize:

`⚠️ NÃO FOI POSSÍVEL VALIDAR`

e explique exatamente o que seria necessário validar.

---

# Evidência acima de opinião

Toda conclusão importante deve ser baseada em algum tipo de evidência.

Prefira:

`Conclusão → evidência → impacto → ação recomendada`

em vez de avaliações genéricas.

---

# Não modifique o código

Nesta etapa você deve apenas realizar a auditoria.

Não:

* corrija arquivos;
* faça refactors;
* altere arquitetura;
* implemente funcionalidades;
* crie migrations;
* modifique componentes.

Primeiro produza um diagnóstico completo e confiável.

---

# Revisão final obrigatória

Antes de entregar o documento, faça uma revisão interna verificando:

* Todos os itens da Checklist Mestre foram avaliados?
* Existem requisitos ignorados?
* As classificações possuem evidências?
* Algum item foi marcado como implementado apenas pela existência de arquivo?
* Fluxos ponta a ponta foram verificados?
* Frontend e backend foram correlacionados?
* Banco de dados foi correlacionado com regras de negócio?
* Permissões foram verificadas no backend?
* Há mocks ou placeholders sendo confundidos com implementação?
* Foram identificadas funcionalidades extras?
* Divergências foram documentadas?
* Riscos de segurança foram analisados?
* Dívida técnica foi priorizada?
* A checklist final contém apenas ações realmente pendentes?

Somente após essa revisão finalize o arquivo.

---

# Resultado esperado

Quero que esse documento responda claramente às seguintes perguntas:

**“Qual é o estado real do Vulnera hoje?”**

**“O que está realmente pronto?”**

**“O que parece pronto, mas ainda está incompleto?”**

**“O que ainda não existe?”**

**“O que foi implementado diferente do planejado?”**

**“Quais regras de negócio estão corretas ou incorretas?”**

**“Onde existem problemas de frontend, backend, banco, segurança, design ou arquitetura?”**

**“Quais são os maiores riscos atuais?”**

**“O que deve ser feito a seguir e em qual ordem?”**

O resultado deve ser suficientemente detalhado para funcionar simultaneamente como:

* auditoria técnica;
* auditoria funcional;
* análise de aderência à especificação;
* levantamento de dívida técnica;
* revisão de regras de negócio;
* avaliação de UX/design;
* mapa de riscos;
* backlog priorizado para conclusão do Vulnera.
