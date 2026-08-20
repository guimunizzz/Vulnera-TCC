---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Uso da IA

## Objetivo
Descrever como o Pentester usa a integração com Gemini para obter sugestões durante o registro de um finding.

## Ator principal
Pentester

## Pré-condições
- Pentester está em processo de registro de uma `Vulnerability`
- o usuário não atingiu o rate limit de requisições à IA

## Passos principais

1. Pentester preenche `title` e contexto básico no formulário de finding
2. Clica no botão "Sugerir com IA"
3. Front-end envia `POST /ai/suggest-finding` com título e contexto
4. Back-end verifica rate limit do usuário (requests por hora/dia)
   - se limite atingido: retorna `429 Too Many Requests`
5. Back-end monta prompt estruturado com título + contexto + instrução de formato
6. Back-end chama Gemini API com o prompt
7. Gemini retorna JSON com sugestões para:
   - `description` — descrição técnica da vulnerabilidade
   - `owasp` — categoria OWASP sugerida (A01..A10)
   - `cvss` — vetor CVSS sugerido
   - `recommendation` — recomendação de correção
8. Back-end valida o schema da resposta
9. Front-end exibe as sugestões como campos editáveis (não preenchidos automaticamente)
10. Pentester revisa cada sugestão, ajusta o que for necessário e salva o finding

## Restrições
- sugestões **não são salvas automaticamente** — sempre requerem ação humana
- `ai_assisted = true` é marcado no finding apenas se o usuário confirmar as sugestões
- a chave de API do Gemini nunca aparece no código — sempre via variável de ambiente
- prompt e resposta não são logados (dados do cliente)
- rate limit agressivo por usuário para controlar custo

## Funcionalidades disponíveis da IA
- sugestão de descrição e recomendação a partir do título
- sugestão de categoria OWASP
- sugestão de vetor CVSS
- resumo executivo do projeto (funcionalidade separada, para relatórios)
- dicas de vulnerabilidades comuns dado o tech stack da Application

## Regras de negócio relacionadas
- [[ADR-006 - Gemini com rate limit agressivo]]
- [[RN20 - Criacao de Vulnerability gera auditoria]] — gerado ao confirmar o finding

## Pós-condições (sucesso)
- Pentester recebeu sugestões editáveis
- o finding pode ser salvo normalmente com `ai_assisted = true`

## Pós-condições (rate limit)
- usuário recebe mensagem de limite atingido
- pode prosseguir com registro manual do finding

## Relacionado
[[Fluxo - Registro de Finding]]
[[IA Gemini]]
[[Integracao Gemini]]
[[ADR-006 - Gemini com rate limit agressivo]]
