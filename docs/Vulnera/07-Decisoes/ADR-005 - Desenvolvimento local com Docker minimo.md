---
type: decisao
tags: [decision, source-of-truth]
status: vigente
codigo: ADR-005
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# ADR-005 - Desenvolvimento local com Docker minimo

## Contexto
O Vulnera é desenvolvido por uma equipe de 3 pessoas em 7 meses de TCC. O ambiente de desenvolvimento precisa ser:
- reproduzível em qualquer máquina do time sem configuração manual complexa
- rápido para subir e desligar
- adequado ao ritmo de desenvolvimento iterativo com hot reload

Surgiu o debate sobre o quanto colocar no Docker:

**Opção maximalista**: tudo no Docker — API, web, mobile e dependências em containers. Simula ambiente de produção mais fielmente.

**Opção minimalista**: apenas infraestrutura auxiliar no Docker. Código roda local com `npm run dev`.

## Decisão
**O código da aplicação roda localmente. Apenas a infraestrutura auxiliar roda em Docker.**

Divisão adotada:

| O que roda local | O que roda no Docker |
|---|---|
| API Express (`npm run dev`) | MySQL |
| Web React + Vite (`npm run dev`) | SonarQube |
| Mobile Expo (`npx expo start`) | Mailhog (SMTP dev) |

Um único `docker-compose.yml` na raiz do repo sobe toda a infraestrutura auxiliar com `docker compose up -d`.

## Alternativas consideradas

### Alternativa A: Tudo no Docker (incluindo código)
- **Prós**: ambiente idêntico para todos; simula produção
- **Contras**: hot reload via volume mount é lento e problemático no Windows/Mac; Expo não funciona bem containerizado; debug difícil dentro de containers; overhead de configuração alto; tira o foco do desenvolvimento das features

### Alternativa B: Banco local sem Docker
- **Prós**: mais simples ainda
- **Contras**: MySQL tem instalação não trivial e varia entre SOs; cada integrante teria versão diferente; SonarQube não tem instalação prática sem Docker; Mailhog inexistente sem container

### Alternativa C (adotada): Código local + infraestrutura no Docker
- melhor equilíbrio para projeto acadêmico
- hot reload instantâneo
- banco e ferramentas de qualidade reproduzíveis via container
- Expo pode escanear QR code normalmente
- `docker compose up -d` funciona em Mac, Windows e Linux sem configuração extra

## Consequências positivas
- **Onboarding rápido**: novo integrante roda o projeto com `docker compose up -d` + 3 terminais
- **Hot reload real**: mudanças no código refletem imediatamente sem rebuild de container
- **Debug direto**: breakpoints e ferramentas de debug funcionam nativamente no processo local
- **Expo sem problema**: o QR code do Expo precisa da IP local — container dificulta isso
- **Foco no produto**: menos tempo configurando infra, mais tempo desenvolvendo features

## Trade-offs e limitações
- o ambiente local do dev não é idêntico ao container do CI — possíveis divergências de comportamento
- cada integrante precisa ter Node.js 20 instalado localmente
- variáveis de ambiente precisam ser mantidas no `.env` local de cada integrante
- Prometheus e Grafana ficam em `docker-compose.observability.yml` separado para não pesar no startup padrão

## Impacto no sistema

| Área | Impacto |
|---|---|
| Onboarding | Documentado no README: 4 comandos para estar rodando |
| CI | Dockerfiles existem apenas para validação de build no CI — não para dev |
| Infra | `docker-compose.yml` minimalista (db, mailhog, sonarqube) |
| Observabilidade | Prometheus + Grafana em arquivo separado (`docker-compose.observability.yml`) |
| Qualidade de código | SonarQube no container — acesso em `localhost:9000` |

## Comandos do fluxo de trabalho

```bash
# Sobe infraestrutura
docker compose up -d

# Instala deps (uma vez)
cd apps/api && npm install
cd ../web && npm install
cd ../mobile && npm install

# Em terminais separados:
cd apps/api && npm run dev
cd apps/web && npm run dev
cd apps/mobile && npx expo start

# Para desligar
docker compose down
```

## Quando revisar
Revisar esta decisão se:
- o time crescer e precisar garantir paridade total de ambiente entre devs
- houver um ambiente de staging ou homologação real onde o comportamento em container importe
- o projeto evoluir para além do TCC com deploy real

## Links relacionados
[[Docker Compose]]
[[Dockerfiles]]
[[GitHub Actions CI]]
[[Observabilidade]]
[[MOC - Arquitetura]]
