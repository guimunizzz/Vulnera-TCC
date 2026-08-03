---
type: guia-operacional
tags: [architecture, code-generation, source-of-truth]
status: ativo
---

# Regras para o Claude ao Gerar Codigo

## Objetivo

Definir como o Claude deve usar a estrutura completa do projeto ao implementar o Vulnera.

## Antes de gerar código

Sempre consultar:

- [[MOC - Vulnera]]
- [[MOC - Dominio]]
- [[MOC - Produto]]
- [[MOC - Arquitetura]]
- [[Fonte Original - MVP Vulnera]]
- [[Estrutura Geral do Monorepo]]
- [[Politica de Desenvolvimento Seguro]]
- [[Guia de Estilo de Codigo]]

## Regra principal

Não criar código fora da estrutura documentada sem justificar.

Se a estrutura precisar mudar, registrar a mudança em:

- [[Changelog do Projeto]]
- [[Decisoes Recentes]]
- ADR, se for decisão estrutural

## Ordem de implementação

A implementação deve seguir ondas:

1. bootstrap do monorepo
2. API base
3. autenticação, usuários e empresas
4. planos e assinaturas
5. aplicações
6. projetos
7. vulnerabilities
8. evidências
9. comentários, chat e tickets
10. relatórios
11. maturidade
12. notificações
13. mobile cliente
14. IA Gemini
15. hardening e testes

## Regra de escopo

Não implementar tudo de uma vez.

Cada sessão deve focar em uma feature ou onda pequena.

## Regra de simplicidade

O Vulnera é um TCC.

Portanto, priorizar:

- clareza
- manutenção
- explicabilidade
- organização
- segurança adequada
- complexidade controlada

Evitar:

- arquitetura enterprise desnecessária
- abstrações genéricas demais
- múltiplas camadas sem ganho real
- dependências não oficiais ou suspeitas

## Regra de segurança

Toda feature deve considerar:

- autenticação
- autorização
- ownership
- validação de entrada
- prevenção de injection
- prevenção de XSS
- proteção de segredos
- logs sem dados sensíveis

## Regra de documentação

Ao implementar uma feature, atualizar quando necessário:

- nota do módulo em `03-Produto`
- nota de arquitetura em `04-Arquitetura`
- nota de dados em `06-Dados`
- changelog em `08-Operacao`
- status do projeto

## Regra de consistência

O código deve refletir o vault.

Se o código divergir da documentação, o Claude deve:

1. apontar a divergência
2. explicar o motivo
3. registrar no changelog
4. sugerir atualização documental

## Regra de arquivos

Não criar arquivos extras apenas por padrão.

Criar arquivos quando houver motivo claro:

- separação de responsabilidade
- reuso real
- teste
- configuração
- documentação
- segurança