---
type: permissao
tags: [domain, source-of-truth]
status: ativo
---

# Regras de Ownership

## Definição
Ownership define quais dados cada usuário pode acessar, independente de sua role.
É aplicado pelos Guards de autorização no back-end após a autenticação.

## Por role

### ADMIN
- acesso global a todos os dados da plataforma
- não possui restrição de escopo por Company ou Project
- todas as ações de override são auditadas (RN15)

### PENTESTER
- acessa apenas Projects nos quais está atribuído como membro
- não vê projects de outras atribuições, mesmo que da mesma empresa
- ver: [[RN17 - Pentester so ve Projects atribuidos]]

### CLIENT (qualquer companyRole)
- acessa apenas dados da própria Company:
  - Applications da sua Company
  - Projects das suas Applications
  - Findings dos seus Projects
  - Reports dos seus Projects
  - Tickets abertos pela sua Company
- não vê dados de outras empresas
- ver: [[RN16 - Cliente so ve dados da propria Company]]

### CLIENT OWNER (adicional ao CLIENT)
- pode editar dados da própria Company
- pode convidar novos usuários para a Company
- é o único que pode assinar ou cancelar assinaturas (em nome da empresa)

### CLIENT MEMBER
- escopo de leitura igual ao OWNER
- sem poderes de edição da empresa ou convite de usuários

## Implementação técnica
- `JwtAuthGuard` valida o JWT e extrai `userId`, `role`, `companyId`
- `RolesGuard` verifica a role mínima exigida pela rota
- `OwnershipGuard` aplica o filtro de escopo por companyId ou projectId no service
- Toda query de listagem inclui cláusula `WHERE company_id = :companyId` para CLIENTs
- Toda query de project inclui validação de `ProjectMember` para PENTESTERs

## Riscos de inconsistência
- Project herda companyId da Application (RN06) — se este campo estiver incorreto, o escopo de visibilidade fica errado
- ProjectMember deve ser removido quando pentester sai do projeto

## Relacionado
[[Roles]]
[[CompanyRole]]
[[Matriz de Permissoes]]
[[Middlewares e Ownership]]
[[RN15 - Admin pode sempre mover status com auditoria]]
[[RN16 - Cliente so ve dados da propria Company]]
[[RN17 - Pentester so ve Projects atribuidos]]
