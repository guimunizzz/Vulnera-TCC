---
type: guia-operacional
tags: [core, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Claude - Guia Operacional

## Missão
Usar este vault como memória externa oficial do projeto Vulnera para compreender, consultar, expandir e manter a consistência do projeto ao longo do tempo.

## Objetivo principal
Antes de responder, propor, alterar ou documentar qualquer parte do projeto:
1. localizar a nota canônica
2. localizar as regras de negócio relacionadas
3. localizar permissões e estados envolvidos
4. localizar impactos arquiteturais e operacionais

## Fonte de verdade atual

**[[Contexto Mestre v4]]** (2026-07-26) é a nota de maior autoridade. Consultar SEMPRE antes de qualquer outra.

Em caso de conflito entre o Contexto Mestre e qualquer outra nota, **o Contexto Mestre vence** — a outra nota é que está desatualizada e deve ser corrigida.

## Fonte original do MVP (histórico)

A nota `[[Fonte Original - MVP Vulnera]]` e o arquivo `[[vulnera]]` representam a definição original do MVP: NestJS, PostgreSQL, Socket.IO, prazo de 7 meses. **Nada disso vale mais.**

Uso esperado: material histórico para a monografia contar a evolução do projeto. **Não usar para orientar implementação.**

Uso esperado:
- consultar antes de expandir notas novas
- validar escopo, regras, módulos e arquitetura original
- usar como base para preenchimento inicial do vault

Regra:
As notas do vault podem detalhar e evoluir o projeto, mas qualquer divergência em relação ao MVP original deve ser tratada como evolução documentada, não como substituição silenciosa.

## Ordem de leitura obrigatória
0. **[[Contexto Mestre v4]]** ← fonte de maior autoridade; em conflito, esta vence
1. [[MOC - Vulnera]]
2. [[MOC - Dominio]]
3. [[MOC - Produto]]
4. [[MOC - Arquitetura]]
5. [[MOC - Operacao]]
6. notas específicas do tema em questão

## Hierarquia de verdade documental

### Fonte original do projeto
- `Vault_TCC/vulnera.md`
- papel: documento-base original do MVP

### Fonte de verdade atual por tipo de conhecimento
- contexto geral: `Vault_TCC/01-Contexto/`
- domínio, regras, estados e permissões: `Vault_TCC/02-Dominio/`
- módulos, fluxos, jornadas e plataformas: `Vault_TCC/03-Produto/`
- arquitetura técnica: `Vault_TCC/04-Arquitetura/`
- infraestrutura, segurança e DevSecOps: `Vault_TCC/05-Infra-DevSecOps/`
- dados, enums e modelagem: `Vault_TCC/06-Dados/`
- decisões estruturais: `Vault_TCC/07-Decisoes/`
- mudanças, backlog e evolução: `Vault_TCC/08-Operacao/`
- material acadêmico: `Vault_TCC/09-TCC/`
- dúvidas e rascunhos: `Vault_TCC/99-Inbox/`

## Precedência documental
- `[[vulnera]]` representa o MVP original
- as notas canônicas do vault representam o estado atual estruturado
- quando houver diferença entre o original e o atual, registrar a evolução em changelog e, se necessário, em ADR

## Regras de escrita
- não duplicar uma regra já existente em outra nota
- não criar nova nota para conceito já existente
- preferir atualizar nota canônica e adicionar links
- toda mudança relevante deve aparecer em [[Changelog do Projeto]]
- toda decisão estrutural deve gerar ADR

## Como criar novas notas
Criar nova nota apenas quando houver:
- novo conceito estável
- nova regra de negócio
- novo módulo
- nova decisão arquitetural
- nova integração
- nova tarefa rastreável
## Estrutura-alvo do projeto de código

Antes de gerar ou alterar código, consultar:

- [[Estrutura Geral do Monorepo]]
- [[Estrutura - API Express]]
- [[Estrutura - Web React]]
- [[Estrutura - Mobile Expo]]
- [[Estrutura - Packages Compartilhados]]
- [[Estrutura - Infraestrutura]]
- [[Estrutura - Docs do Projeto]]
- [[Regras para o Claude ao Gerar Codigo]]
- [[Escopo Realista para o TCC]]

Regra:
A estrutura completa serve como referência de organização, mas a implementação deve seguir ondas pequenas e realistas para o TCC.

## Como evitar inconsistência
Sempre verificar:
- se existe regra de negócio associada
- se existe restrição de role ou ownership
- se existe máquina de estados envolvida
- se existe decisão arquitetural que limite a solução
- se o item está no escopo ou fora do escopo

## Como lidar com dúvida
Se algo estiver indefinido:
- registrar em [[Duvidas em Aberto]]
- marcar com `#open-question`
- não transformar hipótese em regra

## Como manter contexto
Toda resposta ou proposta deve conectar:
- entidade principal
- módulo funcional
- regra de negócio
- papel do usuário
- estado atual
- decisão arquitetural relevante

## Regras fundamentais do projeto
- Vulnera é plataforma de gestão, não de ataque real
- Project é 1 para 1 com Application
- criação de Project exige Subscription ativa
- severidade vem de CVSS com possibilidade de override justificado
- transições obedecem máquinas de estado
- cliente só vê dados da própria Company
- pentester só vê Projects atribuídos
- PDF é gerado client-side
- mobile cliente é read-mostly
- Gemini é assistivo, não autônomo

## Regra adicional de desenvolvimento seguro

Ao preencher ou evoluir qualquer nota técnica, o Claude deve sempre verificar:
- validação de entrada
- autenticação e autorização
- ownership
- prevenção de injection
- prevenção de XSS
- proteção de segredos
- exposição de dados sensíveis
- uso de bibliotecas oficiais ou consolidadas

Sempre que uma nota tratar de implementação, incluir considerações de segurança quando aplicável.

Notas obrigatórias de referência:
- [[Politica de Desenvolvimento Seguro]]
- [[Checklist de Seguranca por Feature]]
- [[Padrao - Autenticacao e JWT]]
- [[Padrao - Validacao de Entradas]]
- [[Padrao - Prevencao de Injection]]
- [[Padrao - Prevencao de XSS]]
- [[Padrao - Segredos e Variaveis Sensiveis]]
- [[Padrao - Logs e Dados Sensiveis]]
- [[Padrao - Dependencias e Bibliotecas]]
- [[Padrao - Upload Seguro]]

## Referências de estilo de código

Antes de implementar código, consultar:
- [[Guia de Estilo de Codigo]]
- [[Referencia - Estrutura Backend Simples]]
- [[Referencia - Controller]]
- [[Referencia - Service]]
- [[Referencia - Repository]]

Essas notas servem como referência de simplicidade, organização e estilo do autor.

Regra:
- seguir o estilo dos exemplos quando fizer sentido
- adaptar para a stack oficial do Vulnera
- não copiar literalmente código de domínio de outros projetos
- não introduzir complexidade desnecessária

## Uso de códigos legados do autor

O vault pode conter exemplos criados originalmente em TypeScript, Express e MySQL/MySQL2.

Esses exemplos devem ser usados como referência de estilo e organização, não como definição de stack.

Ao implementar o Vulnera, o Claude deve adaptar os exemplos para:

- Express
- Prisma
- MySQL
- DTOs
- Guards
- Pipes
- Interceptors
- arquitetura modular

Regra:
seguir o jeito de organizar e pensar do autor, mas respeitar a stack oficial do Vulnera.

Consultar sempre:

- [[Guia de Estilo de Codigo]]
- [[Referencia - Adaptacao para Prisma]]
- [[Back-end Express]]
- [[Politica de Desenvolvimento Seguro]]

## Política de evolução
Mudança correta:
1. atualizar nota canônica
2. registrar em [[Changelog do Projeto]]
3. criar ADR se for estrutural
4. atualizar MOC se afetar navegação

## Decisões pendentes — não resolver sozinho 🚩

| Flag | Questão | ADR |
|---|---|---|
| F-01 | Factory Method permanece? | [[ADR-010 - Factory Method pendente de confirmacao]] |
| F-02 | Provedor de IA continua Gemini? | [[ADR-011 - Provedor de IA em revisao]] |
| F-03 | Quais domínios de maturidade? | [[ADR-013 - Dominios de maturidade em aberto]] |

Ao encontrar uma nota que depende de uma dessas flags, marcar a pendência — nunca inventar a resposta.
