---
type: funcionalidade
tags: [feature]
status: ativo
---

# Evidencias

## Objetivo
Permitir o upload e gestão de evidências anexadas a um finding (vulnerabilidade), com validação de segurança no servidor.

## Usuários envolvidos
- **Pentester**: faz upload e descreve evidências
- **Admin**: pode visualizar e gerenciar
- **Cliente**: visualiza evidências dos próprios projetos (read-only)

## Capacidades
- upload de arquivos por finding: `jpg`, `jpeg`, `png`, `txt`, `log`
- validação de MIME type e magic number no back-end (não apenas extensão)
- limite de tamanho por arquivo (10 MB no MVP)
- campo obrigatório `proof`: descreve o contexto — ex: payload utilizado, URL, comando
- nome do arquivo reescrito como UUID no servidor (elimina path traversal)
- armazenamento em volume Docker local no MVP (migração futura para S3/MinIO)
- listagem de evidências por finding
- exclusão (soft delete ou hard delete com auditoria)

## Campos do Evidence
- `file_name` (nome original)
- `file_path` (caminho no volume, com nome UUID)
- `mime_type`
- `size_bytes`
- `proof` (obrigatório — contexto textual da evidência)
- `uploaded_by` (user_id do Pentester)

## Regras de segurança
- MIME type validado no back-end por magic number (não só pela extensão declarada)
- nome original não é usado para salvar o arquivo — apenas para exibição
- evidências não devem aparecer em logs estruturados
- acesso ao arquivo físico protegido por autenticação (não URL pública)

## Fluxos relacionados
- [[Fluxo - Registro de Finding]] — evidências são anexadas após criação do finding

## Dependências técnicas
- `POST /vulnerabilities/:id/evidences` (multipart/form-data)
- `GET /vulnerabilities/:id/evidences`
- multer ou equivalente para recepção de upload
- volume Docker montado em path configurável por variável de ambiente

## Relacionado
[[Evidence]]
[[Vulnerability]]
[[Findings]]
[[Seguranca da Aplicacao]]
