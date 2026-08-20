---
type: referencia-codigo
tags: [backend, code-style, controller]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Controller

## Objetivo

Registrar o estilo esperado para controllers no Vulnera, usando exemplos do autor como referência de organização, simplicidade e separação de responsabilidades.

## Papel desta nota

Esta nota orienta o Claude a interpretar controllers criados anteriormente em TypeScript, Express e MySQL/MySQL2, adaptando o padrão para Express.

## Contexto dos exemplos legados

Os exemplos antigos do autor podem usar:

- Express
- `Request` e `Response`
- `res.status().json()`
- rotas manuais
- controllers chamados por arquivos `.routes.ts`
- validações simples dentro do método
- chamada direta para service

Esses exemplos devem ser usados como referência de estilo, não como implementação literal.

## Stack oficial do Vulnera

No Vulnera, controllers devem usar:

- Express
- decorators como `@Controller()`, `@Get()`, `@Post()`, `@Patch()`, `@Delete()`
- DTOs
- middlewares
- decorators customizados como `@CurrentUser()`
- services injetados via constructor

## Regra principal

Controllers devem ser finos.

Eles devem:

- receber a requisição
- receber DTOs
- receber usuário autenticado quando necessário
- chamar o service
- retornar o resultado

Eles não devem conter regra de negócio pesada.

## Mapeamento Express para Express

| Express | Express |
|---|---|
| `router.get(...)` | `@Get()` |
| `router.post(...)` | `@Post()` |
| `router.patch(...)` | `@Patch()` |
| `router.delete(...)` | `@Delete()` |
| `Request` / `Response` | decorators do Express |
| `req.body` | `@Body()` |
| `req.params.id` | `@Param('id')` |
| `req.query` | `@Query()` |
| `req.user` | `@CurrentUser()` |
| middleware de auth | `@UseGuards()` |
| `res.status().json()` | retorno direto ou exception |

## Exemplo legado do autor

Cole aqui um exemplo antigo de controller usado em projetos anteriores.

```ts
import { Request, Response } from 'express';
import { EstoqueService } from '../services/estoque.services';

export class EstoqueController {
    constructor(private readonly _service = new EstoqueService()) { }

    /**
     * Lista todos os registros de estoque.
     * @param req - Objeto de requisição Express.
     * @param res - Objeto de resposta Express.
     */
    listarTodos = async (req: Request, res: Response): Promise<void> => {
        try {
            const estoques = await this._service.selecionarTodos();
            res.status(200).json({
                mensagem: 'Estoques listados com sucesso.',
                recurso: estoques,
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ mensagem: 'Erro interno do servidor.', error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }
    };

    /**
     * Busca um registro de estoque pelo ID informado na URL.
     * @param req - Objeto de requisição Express (params.id).
     * @param res - Objeto de resposta Express.
     */
    buscarPorId = async (req: Request, res: Response): Promise<void> => {
        try {
            const idEstoque = Number(req.params.id);

            if (idEstoque === null) {
                res.status(400).json({
                    mensagem: 'Dados invalidos.',
                    erros: [{ campo: 'id', mensagem: 'Informe um id valido.' }],
                });
                return;
            }

            const estoque = await this._service.selecionarPorId(idEstoque);
            res.status(200).json({
                mensagem: 'Estoque encontrado com sucesso.',
                recurso: estoque,
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ mensagem: 'Erro interno do servidor.', error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }
    };

    /**
     * Cria um novo registro de estoque com os dados do corpo da requisição.
     * @param req - Objeto de requisição Express (body: { idProduto, quantidadeAtual }).
     * @param res - Objeto de resposta Express.
     */
    criarEstoque = async (req: Request, res: Response): Promise<void> => {
        try {
            const { idProduto, quantidadeAtual } = req.body;
            const novoEstoque = await this._service.adicionarEstoque(idProduto, quantidadeAtual);
            res.status(201).json({ novoEstoque });
        } catch (error) {
            console.log(error);
            res.status(500).json({ mensagem: 'Erro interno do servidor.', error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }
    };

    /**
     * Atualiza um registro de estoque existente pelo ID informado na URL.
     * @param req - Objeto de requisição Express (params.id, body: { idProduto, quantidadeAtual }).
     * @param res - Objeto de resposta Express.
     */
    atualizarEstoque = async (req: Request, res: Response): Promise<void> => {
        try {
            const { idProduto, quantidadeAtual } = req.body;
            const idEstoque = Number(req.params.id);
            const estoqueAlterado = await this._service.editarEstoque(idEstoque, idProduto, quantidadeAtual);
            res.status(201).json({ estoqueAlterado });
        } catch (error) {
            console.log(error);
            res.status(500).json({ mensagem: 'Erro interno do servidor.', error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }
    };

    /**
     * Remove um registro de estoque pelo ID informado na URL.
     * @param req - Objeto de requisição Express (params.id).
     * @param res - Objeto de resposta Express.
     */
    deletarEstoque = async (req: Request, res: Response): Promise<void> => {
        try {
            const idEstoque = Number(req.params.id);

            if (idEstoque === null) {
                res.status(400).json({
                    mensagem: 'Dados invalidos.',
                    erros: [{ campo: 'id', mensagem: 'Informe um id valido.' }],
                });
                return;
            }

            await this._service.deletarEstoque(idEstoque);
            res.status(200).json({ mensagem: 'Estoque deletado com sucesso.' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ mensagem: 'Erro interno do servidor.', error: error instanceof Error ? error.message : 'Erro desconhecido' });
        }
    };
}

```

## O que o Claude deve aprender com o exemplo

- controller simples
- métodos curtos
- nomes claros
- delegação para service
- organização por recurso
- retorno previsível
- separação entre HTTP e regra de negócio

## O que não deve ser copiado literalmente

- uso de `Request` e `Response` do Express
- `res.status().json()` em Express
- validação pesada dentro do controller
- acesso direto ao banco
- SQL no controller
- regra de negócio no controller
- nomes de domínio de outro projeto
- estrutura de rotas Express

## Exemplo adaptado para Express

```ts
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applicationsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.applicationsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applicationsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.applicationsService.update(id, dto, user);
  }
}
```

## Responsabilidades do controller

### Pode fazer

- declarar rotas
- receber DTOs
- receber parâmetros
- receber usuário autenticado
- aplicar middlewares e decorators
- chamar service
- retornar resultado

### Não deve fazer

- acessar Prisma diretamente
- consultar banco
- validar regra de negócio complexa
- calcular limite de plano
- decidir transição de estado
- registrar auditoria manualmente se isso pertence ao service
- montar resposta complexa demais

## Padrão esperado no Vulnera

Cada módulo deve ter controller próprio quando expuser rotas HTTP.

Exemplo:

```text
modules/applications/
├── applications.controller.ts
├── applications.service.ts
├── applications.repository.ts
├── applications.module.ts
└── dto/
    ├── create-application.dto.ts
    └── update-application.dto.ts
```

## Segurança em controllers

Controllers devem sempre considerar:

- rota pública ou autenticada
- role necessária
- ownership necessário
- DTO adequado
- campos sensíveis no retorno
- validação de entrada

## Exemplo com middlewares

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }
}
```

## Relação com o domínio

Controllers normalmente expõem ações sobre:

- [[Company]]
- [[User]]
- [[Application]]
- [[Project]]
- [[Vulnerability]]
- [[Evidence]]
- [[Subscription]]
- [[Report]]

## Relação com arquitetura

- [[Back-end Express]]
- [[API REST]]
- [[DTOs e Validacao]]
- [[Middlewares e Ownership]]
- [[Referencia - Adaptacao para Prisma]]

## Relação com segurança

- [[Politica de Desenvolvimento Seguro]]
- [[Padrao - Validacao de Entradas]]
- [[Padrao - Autenticacao e JWT]]
- [[Padrao - Logs e Dados Sensiveis]]

## Checklist para o Claude

Antes de aceitar um controller, verificar:

- [ ] o controller está fino?
- [ ] existe DTO para entrada?
- [ ] não há regra de negócio pesada?
- [ ] não há acesso direto ao banco?
- [ ] a rota exige autenticação quando necessário?
- [ ] ownership será tratado no service ou middlewares?
- [ ] não retorna dados sensíveis?

## Regra final para o Claude

Usar controllers legados como referência de clareza e simplicidade.

No Vulnera, sempre adaptar para controllers Express com DTOs, middlewares e services.

## Nota sobre a origem dos exemplos

Os exemplos de código desta nota foram escritos originalmente com **TypeScript, Express e MySQL/MySQL2**.

Eles representam o estilo de controller do autor: métodos claros, delegação para o service, retorno previsível.

**Não representam a stack do Vulnera.**

Ao implementar controllers no Vulnera, sempre adaptar para:
- decorators Express (`@Controller`, `@Get`, `@Post`, `@Patch`, `@Delete`)
- `@Body()`, `@Param()`, `@Query()`, `@CurrentUser()` no lugar de `req.*`
- DTOs no lugar de acesso direto ao `req.body`
- middlewares no lugar de middlewares de autenticação
- exceptions Express no lugar de `res.status().json()`

Guia completo de adaptação: [[Referencia - Adaptacao para Prisma]]
