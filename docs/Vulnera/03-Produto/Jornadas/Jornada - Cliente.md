---
type: jornada
tags: [feature, journey]
status: ativo
---

# Jornada - Cliente

## Perfil principal
Usuário com `role = CLIENT` e `companyRole = OWNER`. Responsável por contratar e acompanhar as análises de segurança da empresa.

## Objetivo do usuário
Contratar uma análise de segurança para a aplicação da empresa, acompanhar o progresso, interagir com os achados e receber um relatório profissional.

## Etapas principais

### Descoberta
- visita a landing page pública
- compara os planos disponíveis (Basic, Pro, Pro+)
- decide contratar

### Cadastro e contratação
- preenche dados da empresa e cria conta (OWNER)
- seleciona o plano
- aguarda aprovação do Admin (pode levar horas/dias)
- recebe e-mail de boas-vindas ao ser aprovado

### Configuração inicial
- faz primeiro login na plataforma
- cadastra a(s) aplicação(ões) da empresa (dentro do limite do plano)
- solicita análise para uma aplicação (abre Project)
- aguarda triagem e atribuição de pentester pelo Admin

### Acompanhamento da análise
- acompanha status do projeto via web e mobile
- recebe push notifications sobre findings críticos e mudanças de status
- visualiza findings liberados e seus detalhes
- conversa com o Pentester via chat do projeto
- abre tickets de suporte se necessário

### Encerramento
- valida correções realizadas pela equipe de desenvolvimento
- solicita revalidação de findings corrigidos
- baixa relatório técnico e/ou executivo em PDF
- aceita o encerramento do projeto

## Dores e riscos

| Dor | Mitigação no Vulnera |
|-----|---------------------|
| Aguardar aprovação sem visibilidade | E-mail de confirmação de cadastro + status visible na plataforma |
| Não entender criticidade dos achados | Severidade baseada em CVSS + categoria OWASP padronizada |
| Perder comunicações sobre o projeto | Notificações in-app, e-mail e push mobile |
| Não saber o que está incluso no contrato | Escopo formal definido no formulário de abertura do projeto |
| Relatório inacessível ou de difícil leitura | PDF gerado client-side com layout profissional executivo e técnico |

## Plataformas utilizadas
- **Web**: todas as funções (onboarding, projetos, findings, relatórios, tickets)
- **Mobile**: acompanhamento, notificações push, leitura de findings (read-mostly)

## Relacionado
[[Fluxo - Onboarding]]
[[Fluxo - Contratacao]]
[[Fluxo - Criacao de Aplicacao]]
[[Fluxo - Abertura de Projeto]]
[[Fluxo - Revalidacao]]
[[Fluxo - Geracao de Relatorio]]
[[Web Cliente]]
[[Mobile Cliente]]
[[Publico-Alvo]]
