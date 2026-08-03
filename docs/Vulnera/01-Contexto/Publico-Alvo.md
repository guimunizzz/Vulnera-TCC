---
type: contexto
tags: [core]
status: ativo
---

# Publico-Alvo

## Perfis de usuário

### Admin (consultor / operador da plataforma)
Usuário interno da consultoria. Responsável por:
- aprovar assinaturas de novas empresas
- atribuir pentesters a projetos
- gerenciar empresas-cliente
- avaliar maturidade de segurança
- responder tickets de suporte
- encerrar projetos

Role no sistema: `ADMIN`
Acesso: global — vê todos os dados da plataforma.

### Pentester / Analista
Usuário técnico da consultoria. Responsável por:
- executar análises nos projetos atribuídos
- registrar findings com CVSS e categoria OWASP
- anexar evidências
- responder comentários do cliente
- gerar relatórios técnicos
- validar correções (revalidação)

Role no sistema: `PENTESTER`
Acesso: restrito aos projetos em que está atribuído (RN17).

### Cliente (contato da empresa contratante)
Usuário externo vinculado a uma `Company`. Responsável por:
- contratar planos de análise
- cadastrar aplicações
- acompanhar andamento dos projetos
- interagir com findings via comentários
- solicitar revalidação de correções
- baixar relatórios
- abrir tickets de suporte

Role no sistema: `CLIENT`
Acesso: restrito aos dados da própria Company (RN16).

## Subroles de cliente (CompanyRole)
Dentro do perfil `CLIENT`, existe um papel interno por empresa:
- `OWNER` — contrata, convida outros usuários, responsável comercial
- `MEMBER` — acesso de consulta e acompanhamento, sem poderes administrativos

> Uma Company pode ter múltiplos usuários CLIENT, com ownership distribuído (RN01).

## Relacionado
[[Roles]]
[[CompanyRole]]
[[Matriz de Permissoes]]
[[RN01 - Empresa pode ter multiplos usuarios cliente]]
[[RN02 - Usuario pertence a no maximo uma Company]]
[[RN16 - Cliente so ve dados da propria Company]]
[[RN17 - Pentester so ve Projects atribuidos]]
