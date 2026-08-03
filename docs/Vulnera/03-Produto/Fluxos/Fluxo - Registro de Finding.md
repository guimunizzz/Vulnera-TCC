---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Registro de Finding

## Objetivo
Permitir que o Pentester registre uma vulnerabilidade encontrada durante a análise, com ou sem assistência da IA.

## Ator principal
Pentester

## Pré-condições
- Project no status `IN_PROGRESS`
- Pentester está atribuído ao Project (`ProjectMember`)

## Passos principais

### Caminho sem IA
1. Pentester acessa o projeto e clica em "Novo Finding"
2. Preenche manualmente:
   - `title` — nome da vulnerabilidade
   - `description` — descrição técnica
   - `owasp_category` — categoria OWASP Top 10 (obrigatório)
   - `cvss_vector` — vetor CVSS v3.1
   - `impact` — impacto descrito
   - `recommendation` — recomendação de correção
3. Sistema calcula `severity_calculated` a partir do CVSS score
4. Pentester pode realizar override manual da severidade (campo `severity_final`) fornecendo `severity_override_reason`
5. Pentester submete o formulário
6. Sistema cria a `Vulnerability` com status `OPEN` e gera `AuditLog` com action = `CREATE`

### Caminho com assistência IA (opcional)
1. Pentester preenche `title` e contexto básico
2. Clica em "Sugerir com IA" → [[Fluxo - Uso da IA]]
3. Gemini retorna sugestões para `description`, `owasp_category`, `cvss_vector` e `recommendation`
4. Pentester revisa, ajusta e confirma
5. Sistema cria a `Vulnerability` com `ai_assisted = true`

### Anexo de evidências (opcional, após criação)
1. Pentester acessa o finding criado
2. Faz upload de arquivos (jpg, jpeg, png, txt, log — limite 10 MB)
3. Preenche campo `proof` descrevendo o contexto da evidência
4. Sistema valida MIME type + magic number + tamanho
5. Arquivo é salvo em volume Docker com nome reescrito (UUID)

## Regras de negócio relacionadas
- [[RN09 - Vulnerability pertence a um Project]]
- [[RN10 - Severidade via CVSS com override justificado]]
- [[RN11 - Toda Vulnerability deve ter categoria OWASP]]
- [[RN17 - Pentester so ve Projects atribuidos]]
- [[RN20 - Criacao de Vulnerability gera auditoria]]
- [[RN21 - Mudanca de severidade gera auditoria]]

## Pós-condições
- `Vulnerability` criada com `status = OPEN`
- `AuditLog` gerado com ação `CREATE`
- se `ai_assisted = true`, campo marcado no registro
- evidências vinculadas se enviadas

## Relacionado
[[Fluxo - Uso da IA]]
[[Fluxo - Revalidacao]]
[[Findings]]
[[Evidencias]]
[[Vulnerability]]
[[Evidence]]
[[AuditLog]]
[[Maquina - Vulnerability]]
