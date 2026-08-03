---
type: referencia-codigo
tags: [backend, code-style, anti-patterns]
status: ativo
---

# Referencia - Padroes que Evitar

## Objetivo

Registrar padrões que o Claude deve evitar ao implementar o Vulnera.

Esta nota existe para impedir que o projeto fique complexo demais, inseguro ou inconsistente com o estilo do autor.

## Regra geral

O Vulnera é um TCC técnico.

O código deve ser:

- simples
- seguro
- legível
- modular
- explicável
- compatível com a documentação

Evitar arquitetura excessivamente abstrata ou difícil de justificar na banca.

## Padrões arquiteturais a evitar

### 1. Arquitetura enterprise desnecessária

Evitar criar:

- muitos adapters
- ports sem necessidade
- factories genéricas para tudo
- camadas duplicadas
- abstrações antes de existir problema real

Preferir:

- controller
- service
- repository
- DTO
- module

### 2. Duplicação de regra de negócio

Evitar:

- regra no controller
- regra repetida no service e no front
- regra escondida no repository
- regra duplicada em múltiplos módulos

Preferir:

- regra centralizada no service
- validação de entrada no DTO
- persistência no repository
- documentação linkada à regra RN

### 3. Controller com lógica pesada

Evitar:

```ts
@Post()
async create(@Body() body: any) {
  // valida plano
  // consulta banco
  // calcula regra
  // salva
  // envia notificação
}
```

Preferir controller fino delegando ao service.

### 4. Repository com regra de negócio

Evitar:

```ts
async createProject(data) {
  // verifica assinatura ativa
  // valida plano
  // decide status
  // cria projeto
}
```

Preferir repository apenas para persistência.

### 5. Input sem validação

Evitar:

- `any`
- body livre
- query params sem limite
- enum aceitando string aberta
- DTO sem validação

Preferir:

- DTOs
- ValidationPipe
- enums claros
- limites de tamanho
- validação explícita

### 6. Segurança apenas no front-end

Evitar:

- esconder botão e achar que isso basta
- validar apenas no formulário
- confiar em role enviada pelo cliente
- deixar ownership apenas na UI

Preferir validação e autorização no back-end.

### 7. Exposição de dados sensíveis

Evitar retornar:

- password hash
- refresh token
- JWT completo em logs
- segredos
- paths internos
- payloads sensíveis completos

### 8. Bibliotecas suspeitas ou desnecessárias

Evitar:

- pacote pouco mantido
- pacote obscuro para função simples
- biblioteca que exige desabilitar segurança
- dependência sem documentação clara

Preferir:

- recursos nativos
- bibliotecas oficiais
- bibliotecas consolidadas
- soluções simples

### 9. SQL manual sem necessidade

Como o Vulnera usa Prisma, evitar:

- SQL concatenado
- queries manuais simples
- interpolação de input
- duplicar acesso ao banco fora do Prisma

Usar Prisma Client por padrão.

### 10. Criar todos os arquivos da estrutura completa de uma vez

A estrutura completa é referência.

Não criar 295 arquivos sem necessidade imediata.

Implementar por ondas pequenas.

## Exemplos do que evitar

Cole aqui exemplos seus ou gerados que representam padrões ruins para o Vulnera.

```ts
// Exemplo de padrão que deve ser evitado
```

## Como corrigir o padrão

Explique aqui como o exemplo acima deveria ser refeito no estilo do Vulnera.

```ts
// Exemplo corrigido ou adaptado
```

## Checklist antes de aceitar uma implementação

- [ ] a feature respeita o vault?
- [ ] a regra está no service?
- [ ] entradas são validadas?
- [ ] ownership foi aplicado?
- [ ] não há segredo exposto?
- [ ] não há dependência desnecessária?
- [ ] não há complexidade exagerada?
- [ ] documentação foi atualizada?

## Relação com outras notas

- [[Guia de Estilo de Codigo]]
- [[Politica de Desenvolvimento Seguro]]
- [[Checklist de Seguranca por Feature]]
- [[Regras para o Claude ao Gerar Codigo]]
- [[Escopo Realista para o TCC]]

## Regra final para o Claude

Se uma solução parecer sofisticada demais para um TCC, simplificar.

Se uma solução enfraquecer segurança, não usar.

Se uma solução fugir do vault, justificar e registrar.