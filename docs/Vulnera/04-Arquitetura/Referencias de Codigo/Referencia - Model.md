---
type: referencia-codigo
tags: [backend, code-style, model]
status: ativo
---

# Referencia - Model

## Objetivo

Explicar como o Claude deve interpretar exemplos de `models` usados pelo autor em projetos anteriores e como adaptar essa ideia para o Vulnera.

## Papel desta nota

Em projetos antigos, o autor pode usar classes de model para representar entidades, herança, agregações ou métodos de domínio.

No Vulnera, a modelagem principal será feita com:

- Prisma Schema
- DTOs
- tipos TypeScript
- enums compartilhados
- objetos de domínio quando realmente necessários

## Contexto dos exemplos legados

Os exemplos antigos podem conter:

- classes TypeScript
- herança, como `Pessoa`, `Cliente`, `Vendedor`
- métodos internos, como `calcularTotal()`
- models usados junto com repositories
- objetos simples representando entidades

Esses exemplos devem orientar o estilo, mas não substituir o Prisma.

## Como interpretar models legados

Models legados representam:

- clareza de entidade
- organização de propriedades
- comportamento simples próximo do domínio
- nomes diretos
- código didático

## Como adaptar para o Vulnera

| Model legado | Vulnera |
|---|---|
| Classe de entidade simples | Model no `schema.prisma` |
| Herança de classes | Composição ou campos explícitos |
| Métodos no model | Service ou utilitário de domínio |
| Enum manual | Enum Prisma ou `packages/types` |
| Classe usada para persistência | Prisma Client + DTOs |

## Regra principal

O Claude não deve criar uma camada pesada de models se o Prisma já representa bem a entidade.

Criar classes ou objetos de domínio apenas quando houver ganho claro de clareza ou regra.

## Exemplo legado do autor

Cole aqui um exemplo antigo de model usado em projetos anteriores.

```ts
export class Estoque {
    private readonly _idEstoque?: number;
    private _idProduto: number = 0;
    private _quantidadeAtual: number = 0;
    private readonly _dtUltimaAtualizacao?: Date;

    /**
     * Cria uma nova instância de Estoque.
     * @param idProduto - ID do produto associado ao estoque.
     * @param quantidadeAtual - Quantidade atual disponível em estoque.
     * @param idEstoque - (Opcional) ID do registro de estoque (gerado pelo banco).
     * @param dtUltimaAtualizacao - (Opcional) Data da última atualização (gerada pelo banco).
     */
    constructor(
        idProduto: number,
        quantidadeAtual: number,
        idEstoque?: number,
        dtUltimaAtualizacao?: Date
    ) {
        this.IdProduto = idProduto;
        this.QuantidadeAtual = quantidadeAtual;
        this._idEstoque = idEstoque;
        this._dtUltimaAtualizacao = dtUltimaAtualizacao;
    }

    /** @returns ID do registro de estoque, ou undefined se ainda não persistido. */
    public get IdEstoque(): number | undefined {
        return this._idEstoque;
    }

    /** @returns ID do produto vinculado a este estoque. */
    public get IdProduto(): number {
        return this._idProduto;
    }

    /** @returns Quantidade atual disponível em estoque. */
    public get QuantidadeAtual(): number {
        return this._quantidadeAtual;
    }

    /** @returns Data e hora da última atualização do estoque, ou undefined. */
    public get DtUltimaAtualizacao(): Date | undefined {
        return this._dtUltimaAtualizacao;
    }

    /**
     * Define o ID do produto, aplicando validação.
     * @param value - ID do produto a ser associado.
     * @throws {TypeError} Se o valor não for um número válido maior que zero.
     */
    public set IdProduto(value: number) {
        this._validarIdProduto(value);
        this._idProduto = value;
    }

    /**
     * Define a quantidade atual, aplicando validação.
     * @param value - Quantidade a ser registrada.
     * @throws {TypeError} Se o valor não for um número válido e não negativo.
     */
    public set QuantidadeAtual(value: number) {
        this._validarQuantidadeAtual(value);
        this._quantidadeAtual = value;
    }

    /**
     * Cria uma instância de Estoque para adição (sem ID).
     * @param idProduto - ID do produto associado.
     * @param quantidadeAtual - Quantidade inicial em estoque.
     * @returns Nova instância de Estoque sem ID.
     */
    public static adicionar(idProduto: number, quantidadeAtual: number): Estoque {
        return new Estoque(idProduto, quantidadeAtual);
    }

    /**
     * Cria uma instância de Estoque para edição (com ID).
     * @param idProduto - ID do produto associado.
     * @param quantidadeAtual - Nova quantidade em estoque.
     * @param id - ID do registro de estoque a ser atualizado.
     * @returns Instância de Estoque com ID definido.
     */
    public static editar(idProduto: number, quantidadeAtual: number, id: number): Estoque {
        return new Estoque(idProduto, quantidadeAtual, id);
    }

    /**
     * Valida se o ID do produto é um número maior que zero.
     * @param value - Valor a ser validado.
     * @throws {TypeError} Se o valor não for do tipo number ou for menor/igual a zero.
     */
    private _validarIdProduto(value: number): void {
        if (typeof value !== 'number') {
            throw new TypeError('O id do produto deve ser um número.');
        }
        if (value <= 0) {
            throw new TypeError('O id do produto deve ser um número válido maior que zero.');
        }
    }

    /**
     * Valida se a quantidade atual é um número não negativo.
     * @param value - Valor a ser validado.
     * @throws {TypeError} Se o valor não for do tipo number ou for negativo.
     */
    private _validarQuantidadeAtual(value: number): void {
        if (typeof value !== 'number') {
            throw new TypeError('A quantidade atual deve ser um número.');
        }
        if (value < 0) {
            throw new TypeError('A quantidade atual não pode ser negativa.');
        }
    }
}

```

## O que o Claude deve aprender com o exemplo

- nomes simples
- propriedades explícitas
- métodos pequenos quando fizer sentido
- domínio compreensível
- código fácil de explicar

## O que não deve ser copiado literalmente

- entidades de outro domínio
- heranças desnecessárias
- models duplicando completamente o Prisma
- lógica de persistência dentro do model
- regra de negócio que pertence ao service

## Exemplo conceitual no Prisma

```prisma
model Project {
  id                    String   @id @default(uuid())
  applicationId          String
  name                  String
  analysisType           String
  analysisLevel          String
  hasRemediationService  Boolean  @default(false)
  status                String
  requestedAt            DateTime @default(now())
  startedAt              DateTime?
  closedAt               DateTime?

  application            Application @relation(fields: [applicationId], references: [id])
}
```

## Exemplo de tipo auxiliar

```ts
export type AuthUser = {
  id: string;
  role: 'ADMIN' | 'PENTESTER' | 'CLIENT';
  companyId?: string;
};
```

## Quando criar tipos ou classes auxiliares

Criar quando:

- melhorar leitura da regra
- evitar repetição
- representar payload interno
- representar usuário autenticado
- representar resultado calculado
- representar dados compartilhados entre apps

Evitar quando:

- duplicar uma entidade do Prisma sem necessidade
- criar abstração apenas por estética
- aumentar complexidade sem ganho real

## Relação com o domínio

- [[Company]]
- [[User]]
- [[Application]]
- [[Project]]
- [[Vulnerability]]
- [[Evidence]]
- [[Report]]
- [[AuditLog]]

## Relação com dados

- [[MER Conceitual]]
- [[Entidades e Relacionamentos]]
- [[Enum - Roles]]
- [[Enum - ProjectStatus]]
- [[Enum - VulnerabilityStatus]]

## Regra final para o Claude

Usar models legados como referência de clareza e domínio.

No Vulnera, a fonte principal de modelagem persistida deve ser o Prisma, e tipos/classes auxiliares devem existir apenas quando simplificarem a implementação.