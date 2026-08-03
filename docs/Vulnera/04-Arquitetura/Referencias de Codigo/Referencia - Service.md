---
type: referencia-codigo
tags: [backend, code-style, service]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Service

## Objetivo

Registrar o estilo esperado para services no Vulnera, usando exemplos do autor como referência de regra de negócio clara, fluxo direto e organização.

## Papel desta nota

Esta nota orienta o Claude a interpretar services antigos criados em TypeScript, Express e MySQL/MySQL2, adaptando o padrão para Express, Prisma e MySQL.

## Contexto dos exemplos legados

Os exemplos antigos do autor podem conter:

- services com métodos de negócio
- validações explícitas
- chamadas para repositories
- erros lançados manualmente
- regras de domínio dentro do service
- retornos simples
- uso de classes TypeScript

Esses exemplos devem orientar o estilo, não a tecnologia final.

## Stack oficial do Vulnera

No Vulnera, services devem usar:

- Express
- injeção de dependência
- repositories quando necessário
- Prisma por meio de repository ou service específico
- exceptions do Express
- DTOs já validados na borda
- regras documentadas no vault

## Regra principal

Services são o centro da regra de negócio.

Eles devem conter:

- validações de domínio
- orquestração entre repositories
- decisões de fluxo
- verificação de estado
- ownership quando fizer sentido
- auditoria quando necessário
- notificações quando necessário

## O que pertence ao service

- validar se a Company tem assinatura ativa
- validar limite de aplicações por plano
- validar se Project pode mudar de status
- validar se Vulnerability pode mudar de status
- calcular ou aplicar severidade
- verificar ownership
- disparar auditoria
- chamar notificações
- coordenar upload de evidência

## O que não pertence ao service

- declarar rotas HTTP
- manipular `Request` e `Response`
- conter SQL manual espalhado
- renderizar UI
- retornar dados sensíveis
- substituir validação básica de DTO

## Exemplo legado do autor

Cole aqui um exemplo antigo de service usado em projetos anteriores.

```ts
import { EstoqueRepository } from '../repository/estoque.repository';
import { Estoque } from '../models/estoque.model';

export class EstoqueService {
    constructor(private readonly _repository = new EstoqueRepository()) { }

    /**
     * Retorna todos os registros de estoque.
     * @returns Promise com a lista de estoques.
     */
    async selecionarTodos() {
        return await this._repository.selectTodos();
    }

    /**
     * Retorna um registro de estoque pelo seu ID.
     * @param id - ID do estoque a ser buscado.
     * @returns Promise com os dados do estoque encontrado.
     */
    async selecionarPorId(id: number) {
        return await this._repository.selectById(id);
    }

    /**
     * Cria um novo registro de estoque no banco de dados.
     * @param idProduto - ID do produto a ser associado ao estoque.
     * @param quantidadeAtual - Quantidade inicial em estoque.
     * @returns Promise com o resultado da inserção.
     */
    async adicionarEstoque(idProduto: number, quantidadeAtual: number) {
        const estoque = Estoque.adicionar(idProduto, quantidadeAtual);
        return await this._repository.adicionarEstoque(estoque);
    }

    /**
     * Atualiza um registro de estoque existente.
     * @param id - ID do estoque a ser editado.
     * @param idProduto - ID do produto associado.
     * @param quantidadeAtual - Nova quantidade em estoque.
     * @returns Promise com o resultado da atualização.
     */
    async editarEstoque(id: number, idProduto: number, quantidadeAtual: number) {
        const estoque = Estoque.editar(idProduto, quantidadeAtual, id);
        return await this._repository.editarEstoque(id, estoque);
    }

    /**
     * Remove um registro de estoque pelo seu ID.
     * @param id - ID do estoque a ser deletado.
     * @returns Promise com o resultado da exclusão.
     */
    async deletarEstoque(id: number) {
        return await this._repository.deletarEstoque(id);
    }
}

```

## O que o Claude deve aprender com o exemplo

- métodos claros
- regra de negócio explícita
- fluxo fácil de seguir
- dependências bem definidas
- validações antes da persistência
- código didático
- pouca abstração desnecessária

## O que não deve ser copiado literalmente

- dependências de MySQL/MySQL2
- erros próprios de outro projeto
- regras de negócio de outro domínio
- SQL dentro do service
- nomes de entidades antigas
- validações que deveriam estar em DTO
- lógica duplicada em controller

## Exemplo adaptado para Express

```ts
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async create(dto: CreateApplicationDto, user: AuthUser) {
    const activeSubscription =
      await this.subscriptionsRepository.findActiveByCompanyId(user.companyId);

    if (!activeSubscription) {
      throw new throw new Error("FORBIDDEN")('Empresa sem assinatura ativa.');
    }

    const totalApps =
      await this.applicationsRepository.countActiveByCompanyId(user.companyId);

    if (totalApps >= activeSubscription.plan.appLimit) {
      throw new throw new Error("<ENTITY>_LIMIT_REACHED")('Limite de aplicações atingido.');
    }

    return this.applicationsRepository.create({
      ...dto,
      companyId: user.companyId,
    });
  }
}
```

## Exemplo de service com mudança de status

```ts
@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly auditService: AuditService,
  ) {}

  async updateStatus(projectId: string, dto: UpdateProjectStatusDto, user: AuthUser) {
    const project = await this.projectsRepository.findById(projectId);

    if (!project) {
      throw new throw new Error("<ENTITY>_NOT_FOUND")('Projeto não encontrado.');
    }

    if (!this.canMoveToStatus(project.status, dto.status, user.role)) {
      throw new throw new Error("FORBIDDEN")('Transição de status não permitida.');
    }

    const updatedProject = await this.projectsRepository.updateStatus(
      projectId,
      dto.status,
    );

    await this.auditService.register({
      actorId: user.id,
      entityType: 'Project',
      entityId: projectId,
      action: 'PROJECT_STATUS_UPDATED',
      diff: {
        from: project.status,
        to: dto.status,
      },
    });

    return updatedProject;
  }

  private canMoveToStatus(currentStatus: string, nextStatus: string, role: string) {
    // Implementar regra conforme máquina de estados documentada.
    return true;
  }
}
```

## Responsabilidades por tipo de service

### Service de domínio

Exemplo:

- `ProjectsService`
- `VulnerabilitiesService`
- `ApplicationsService`

Responsável por regras de negócio do módulo.

### Service de apoio

Exemplo:

- `AuditService`
- `NotificationsService`
- `AiService`

Responsável por capacidade transversal ou integração.

### Service de integração

Exemplo:

- `MailService`
- `ExpoPushService`
- `GeminiService`

Responsável por comunicação externa.

## Regras de segurança no service

Services devem garantir:

- ownership
- autorização contextual
- limites de plano
- transições válidas
- não exposição de dados sensíveis
- uso seguro de repositories
- auditoria de ações sensíveis

## Relação com regras de negócio

Services devem implementar regras como:

- [[RN03 - Limite de aplicacoes por plano]]
- [[RN07 - Projeto exige assinatura ativa]]
- [[RN10 - Severidade via CVSS com override justificado]]
- [[RN12 - Transicoes seguem maquina de estados]]
- [[RN13 - Fluxo com remediation service]]
- [[RN14 - Fluxo sem remediation service]]
- [[RN16 - Cliente so ve dados da propria Company]]
- [[RN17 - Pentester so ve Projects atribuidos]]
- [[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]]

## Relação com arquitetura

- [[Back-end Express]]
- [[Repositorios]]
- [[DTOs e Validacao]]
- [[Middlewares e Ownership]]
- [[Referencia - Adaptacao para Prisma]]

## Relação com segurança

- [[Politica de Desenvolvimento Seguro]]
- [[Checklist de Seguranca por Feature]]
- [[Padrao - Validacao de Entradas]]
- [[Padrao - Prevencao de Injection]]
- [[Padrao - Logs e Dados Sensiveis]]

## Checklist para o Claude

Antes de aceitar um service, verificar:

- [ ] a regra de negócio está clara?
- [ ] o método é pequeno o suficiente?
- [ ] há validação de estado quando necessário?
- [ ] ownership foi considerado?
- [ ] exceptions são seguras?
- [ ] repository é usado para persistência?
- [ ] não há SQL manual desnecessário?
- [ ] ações sensíveis geram auditoria?
- [ ] não há complexidade exagerada?

## Regra final para o Claude

Usar services legados como referência de clareza e fluxo de negócio.

No Vulnera, adaptar para Express, Prisma, MySQL, exceptions seguras e regras documentadas no vault.

## Nota sobre a origem dos exemplos

Os exemplos de código desta nota foram escritos originalmente com **TypeScript, Express e MySQL/MySQL2**.

Eles representam o estilo de service do autor: métodos nomeados pela regra de negócio, fluxo direto, dependências bem definidas.

**Não representam a stack do Vulnera.**

Ao implementar services no Vulnera, sempre adaptar para:
- `@Injectable()` com injeção de dependência via constructor
- repositories Prisma no lugar de repositories MySQL2
- exceptions Express (`throw new Error("<ENTITY>_NOT_FOUND")`, `throw new Error("FORBIDDEN")`, etc.) no lugar de erros manuais
- DTOs já validados na entrada (sem revalidar no service o que o DTO já garante)
- regras de negócio documentadas no vault

Guia completo de adaptação: [[Referencia - Adaptacao para Prisma]]
