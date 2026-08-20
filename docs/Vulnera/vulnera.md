---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Problema e oportunidade](#2-problema-e-oportunidade)
3. [Objetivos](#3-objetivos)
4. [Público-alvo](#4-público-alvo)
5. [Proposta de valor](#5-proposta-de-valor)
6. [Modelo comercial e planos](#6-modelo-comercial-e-planos)
7. [Escopo funcional — Web](#7-escopo-funcional--web)
8. [Escopo funcional — Mobile](#8-escopo-funcional--mobile)
9. [Fora do escopo](#9-fora-do-escopo)
10. [Requisitos funcionais](#10-requisitos-funcionais)
11. [Requisitos não funcionais](#11-requisitos-não-funcionais)
12. [Regras de negócio](#12-regras-de-negócio)
13. [Perfis e permissões](#13-perfis-e-permissões)
14. [Máquinas de estado](#14-máquinas-de-estado)
15. [Fluxos principais](#15-fluxos-principais)
16. [Jornadas de usuário](#16-jornadas-de-usuário)
17. [Modelagem de dados](#17-modelagem-de-dados)
18. [MER em Mermaid](#18-mer-em-mermaid)
19. [Arquitetura técnica](#19-arquitetura-técnica)
20. [Stack técnica definitiva](#20-stack-técnica-definitiva)
21. [DevSecOps e infraestrutura](#21-devsecops-e-infraestrutura)
22. [Segurança da própria aplicação](#22-segurança-da-própria-aplicação)
23. [Integração com Gemini (IA)](#23-integração-com-gemini-ia)
24. [Notificações e comunicação em tempo real](#24-notificações-e-comunicação-em-tempo-real)
25. [Estrutura de pastas](#25-estrutura-de-pastas)
26. [Contratos da API REST](#26-contratos-da-api-rest)
27. [Telas principais](#27-telas-principais)
28. [Dashboard e indicadores](#28-dashboard-e-indicadores)
29. [Relatórios](#29-relatórios)
30. [MVP e roadmap de desenvolvimento](#30-mvp-e-roadmap-de-desenvolvimento)
31. [Distribuição de trabalho na equipe](#31-distribuição-de-trabalho-na-equipe)
32. [Metodologia](#32-metodologia)
33. [Testes](#33-testes)
34. [Riscos](#34-riscos)
35. [Diferenciais e posicionamento](#35-diferenciais-e-posicionamento)
36. [Roadmap visual consolidado](#36-roadmap-visual-consolidado)

---

> [!warning] DOCUMENTO HISTÓRICO — não usar para implementação
> Esta é a definição **original** do MVP (NestJS · PostgreSQL · Socket.IO · 7 meses · equipe de 3 com divisão por pessoa). Nada disso reflete o projeto atual.
>
> **Fonte de verdade vigente: [[Contexto Mestre v4]].**
>
> Valor desta nota: material para a monografia contar a evolução do projeto — a migração de NestJS para Express e a redução sucessiva de prazo (7 → 4 → 3 meses) são evidência de priorização consciente sob restrição, e rendem na defesa.

## 1. Visão geral

**Vulnera** é uma plataforma dividida em três aplicações integradas (web administrativa, web cliente e mobile cliente) que simula a operação de uma consultoria de segurança da informação. Cobre o ciclo completo: **assinatura de um plano → definição de escopo → execução da análise → registro de findings → acompanhamento pelo cliente → emissão de relatórios → revalidação**.

### Visão de contexto

```mermaid
graph TB
    subgraph "Consumidores"
        CA[Admin]
        CP[Pentester]
        CC[Cliente Empresa]
    end

    subgraph "Vulnera"
        WEB[Web App<br/>React + Vite]
        MOB[Mobile App<br/>Expo]
        BE[Back-end<br/>Express]
        DB[(MySQL)]
    end

    subgraph "Integrações"
        GEM[Gemini IA]
        MAIL[E-mail SMTP]
        EXPO[Expo Push]
    end

    CA --> WEB
    CP --> WEB
    CC --> WEB
    CC --> MOB
    WEB --> BE
    MOB --> BE
    BE --> DB
    BE --> GEM
    BE --> MAIL
    BE --> EXPO

    classDef users fill:#4c1d95,stroke:#a78bfa,color:#fff
    classDef core fill:#1e3a8a,stroke:#60a5fa,color:#fff
    classDef ext fill:#064e3b,stroke:#34d399,color:#fff
    class CA,CP,CC users
    class WEB,MOB,BE,DB core
    class GEM,MAIL,EXPO ext
```

O produto une:

- **Engenharia de software** (arquitetura em camadas, TypeScript end-to-end, testes, CI/CD)
- **Segurança da informação** (SAST, DAST, maturidade, OWASP Top 10, CVSS)
- **DevSecOps** (Docker rootless, SonarQube, OWASP ZAP, GitHub Actions, observabilidade)
- **Gestão de fluxo de trabalho** (máquina de estados, portal do cliente, SLAs)

> O Vulnera **não executa ataques reais**. É uma plataforma de **gestão** do serviço de consultoria.

---

## 2. Problema e oportunidade

### 2.1 Problema

```mermaid
mindmap
  root((Dores atuais<br/>em consultoria<br/>de segurança))
    Escopo
      Verbalizado sem registro
      Mal delimitado
      Sem aceite formal
    Evidências
      Dispersas em planilhas
      Screenshots soltos
      Sem rastreabilidade
    Comunicação
      E-mails sem histórico
      Cliente perdido no andamento
      Findings sem thread de discussão
    Maturidade
      Cliente não entende criticidade
      Sem priorização clara
      Sem comparativo histórico
    Auditoria
      Quem viu o quê?
      Quando mudou severidade?
      Baixo compliance
```

### 2.2 Oportunidade pedagógica

O Vulnera servirá também como **laboratório didático** — aplicações de colegas do curso serão cadastradas no sistema e analisadas com **SonarQube** (SAST) e **OWASP ZAP** (DAST), demonstrando na prática a importância da segurança. Gera cases reais para o TCC e envolve a turma.

---

## 3. Objetivos

### 3.1 Objetivo geral

Desenvolver uma plataforma full-stack em TypeScript para gestão, acompanhamento e entrega de análises de segurança, composta por **back-end Express**, **front-end React + Vite** e **app mobile React Native (Expo)**, com infraestrutura em Docker e pipeline CI/CD completo.

### 3.2 Objetivos específicos

| #    | Objetivo                                                             |
| ---- | -------------------------------------------------------------------- |
| OE01 | Permitir que clientes contratem planos de análise de forma digital   |
| OE02 | Centralizar cadastro de empresas, usuários e aplicações              |
| OE03 | Registrar findings com classificação CVSS automática → severidade    |
| OE04 | Implementar máquina de estados para ciclo de vida do achado          |
| OE05 | Permitir avaliação de maturidade baseada em domínios e subcontroles  |
| OE06 | Gerar relatórios técnico e executivo em PDF client-side              |
| OE07 | Disponibilizar mobile app para acompanhamento do cliente             |
| OE08 | Implementar chat em tempo real e sistema de comentários em achados   |
| OE09 | Integrar Gemini para sugestões de vulnerabilidades e recomendações   |
| OE10 | Manter trilha de auditoria para ações sensíveis                      |
| OE11 | Demonstrar práticas DevSecOps (container rootless, CI/CD, SAST/DAST) |

---

## 4. Público-alvo

```mermaid
graph LR
    subgraph "Consultoria"
        ADM[Admin<br/>operação]
        PEN[Pentester<br/>execução técnica]
    end
    subgraph "Cliente - Empresa contratante"
        OWN[Owner<br/>contrata e gerencia]
        MBR[Member<br/>consulta e acompanha]
    end

    ADM -- aprova assinatura --> OWN
    PEN -- entrega findings --> OWN
    OWN -- convida --> MBR

    classDef consult fill:#7c2d12,stroke:#fb923c,color:#fff
    classDef client fill:#0c4a6e,stroke:#38bdf8,color:#fff
    class ADM,PEN consult
    class OWN,MBR client
```

### 4.1 Admin (consultor / operador da plataforma)

Usuário da consultoria. Gerencia empresas-cliente, aprova assinaturas, atribui pentesters, gera relatórios, avalia maturidade.

### 4.2 Pentester / Analista

Usuário técnico vinculado à consultoria. Executa análises, registra findings, anexa evidências, responde dúvidas do cliente.

### 4.3 Cliente (contato da empresa contratante)

Usuário vinculado a uma `Company`. Contrata plano, cadastra aplicações (respeitando limite), acompanha andamento, interage com achados, valida correções.

> **Nota importante:** uma `Company` (empresa cliente) pode ter **múltiplos usuários** do tipo `CLIENT`, com um papel interno (owner, member) para controle de quem assina contrato vs quem apenas consulta.

---

## 5. Proposta de valor

```mermaid
graph LR
    V[Vulnera]
    V --> C[Para o cliente]
    V --> T[Para a equipe técnica]
    V --> A[Para o TCC]

    C --> C1[Clareza contratual]
    C --> C2[Visibilidade em tempo real]
    C --> C3[Relatórios profissionais]
    C --> C4[Mobile com push]

    T --> T1[Centralização de findings]
    T --> T2[Padronização CVSS/OWASP]
    T --> T3[Assistência IA]
    T --> T4[Auditoria completa]

    A --> A1[Arquitetura real]
    A --> A2[TS end-to-end]
    A --> A3[3 apps integradas]
    A --> A4[DevSecOps meta]
    A --> A5[Tema atual - IA]

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef branch fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef leaf fill:#065f46,stroke:#34d399,color:#fff
    class V root
    class C,T,A branch
    class C1,C2,C3,C4,T1,T2,T3,T4,A1,A2,A3,A4,A5 leaf
```

---

## 6. Modelo comercial e planos

O sistema simula uma operação SaaS com planos de assinatura. Cada plano define limites de uso.

### 6.1 Planos previstos

| Plano     | Preço (fictício) | Aplicações             | Projetos simultâneos | Remediação inclusa | Suporte             |
| --------- | ---------------- | ---------------------- | -------------------- | ------------------ | ------------------- |
| **Basic** | R$ X/mês         | 2                      | 1                    | ❌                 | E-mail              |
| **Pro**   | R$ Y/mês         | 5                      | 3                    | ✅                 | E-mail + Chat       |
| **Pro+**  | Sob consulta     | Ilimitado (negociável) | Ilimitado            | ✅                 | E-mail + Chat + SLA |

> Valores monetários são **simulados** — o foco é a lógica de limite, não cobrança real. Não há integração com gateway de pagamento.

### 6.2 Fluxo de contratação

```mermaid
flowchart TD
    A([Visitante na landing]) --> B[Cadastra Company<br/>+ User owner]
    B --> C[Seleciona plano]
    C --> D[(Subscription<br/>PENDING_APPROVAL)]
    D --> E{{Notifica admin<br/>e-mail + in-app}}
    E --> F[Admin revisa<br/>dados da empresa]
    F --> G{Aprovar?}
    G -- sim --> H[(Subscription<br/>ACTIVE)]
    G -- não --> I[(Subscription<br/>REJECTED)]
    H --> J{{E-mail de boas-vindas<br/>ao cliente}}
    J --> K([Cliente pode cadastrar<br/>aplicações e abrir projetos])
    I --> L([Cliente recebe justificativa])

    classDef start fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef ok fill:#065f46,stroke:#34d399,color:#fff
    classDef fail fill:#7f1d1d,stroke:#f87171,color:#fff
    classDef action fill:#4c1d95,stroke:#a78bfa,color:#fff
    class A,K start
    class H,J ok
    class I,L fail
    class D,E action
```

### 6.3 Add-on: Serviço de Remediação

Projetos podem ter o flag `hasRemediationService`. Ele muda quem pode mover os status de finding:

```mermaid
flowchart LR
    P[Projeto criado] --> Q{hasRemediationService?}
    Q -- true --> R[Analista pode mover<br/>para FIXED e REVALIDATION]
    Q -- false --> S[Apenas cliente pode<br/>marcar como FIXED ou solicitar REVALIDATION]
    R --> T[Analista valida<br/>REVALIDATION to CLOSED]
    S --> T

    classDef start fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef dec fill:#92400e,stroke:#fbbf24,color:#fff
    classDef act fill:#065f46,stroke:#34d399,color:#fff
    class P start
    class Q dec
    class R,S,T act
```

---

## 7. Escopo funcional — Web

### 7.1 Mapa de módulos

```mermaid
graph TB
    ROOT[Vulnera Web]
    ROOT --> AUTH[Autenticação]
    ROOT --> COMP[Empresas]
    ROOT --> APP[Aplicações]
    ROOT --> SUB[Assinaturas]
    ROOT --> PROJ[Projetos]
    ROOT --> VUL[Vulnerabilidades]
    ROOT --> EVI[Evidências]
    ROOT --> MAT[Maturidade]
    ROOT --> REP[Relatórios]
    ROOT --> CHAT[Chat + Comentários]
    ROOT --> TIC[Tickets]
    ROOT --> NOT[Notificações]
    ROOT --> AI[IA Gemini]
    ROOT --> DASH[Dashboard]

    VUL --> EVI
    PROJ --> VUL
    PROJ --> CHAT
    COMP --> APP
    APP --> PROJ
    COMP --> SUB
    PROJ --> MAT
    PROJ --> REP
    VUL --> AI

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef core fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef sup fill:#065f46,stroke:#34d399,color:#fff
    class ROOT root
    class PROJ,VUL,COMP,APP core
    class AUTH,SUB,EVI,MAT,REP,CHAT,TIC,NOT,AI,DASH sup
```

### 7.2 Autenticação e perfis

- Login com JWT (access + refresh token)
- Registro de empresa cliente (fluxo de onboarding)
- Logout invalidando refresh token
- Recuperação de senha por e-mail
- Roles: `ADMIN`, `PENTESTER`, `CLIENT`
- CompanyRole (subrole interno para clientes): `OWNER`, `MEMBER`

### 7.3 Gestão de empresas (Companies)

- CRUD de empresas-cliente (apenas Admin)
- Visualização do plano ativo, data de assinatura, limite de aplicações
- Histórico de projetos
- Vinculação de múltiplos usuários à empresa

### 7.4 Gestão de aplicações

- CRUD de aplicações vinculadas a uma `Company` (não ao projeto)
- Campos: nome, URL, ambiente (prod/homol/dev), stack técnica, descrição, partes sensíveis
- Gate de validação: não permite exceder limite do plano
- Flag `isActive` (soft delete)

### 7.5 Solicitação de análise

- Formulário de escopo: tipo de análise (SAST/DAST/maturidade/combo), nível (básico/intermediário/avançado), janela de execução, restrições
- Opção de contratar serviço de remediação
- Relacionado a **1 aplicação** (regra 1-para-1)
- Gera um `Project` em status `REQUESTED`

### 7.6 Gestão de projetos

- Visualização kanban por status
- Atribuição de pentesters responsáveis
- Linha do tempo com eventos principais
- Dashboard de progresso (% de findings fechados, dias em aberto)

### 7.7 Findings / Vulnerabilidades

- Registro com: título, descrição, OWASP Top 10 (categoria), CVSS vector, score calculado, severidade automática (com override manual justificado), impacto, recomendação, responsável, status
- Anexos: evidências (imagem/log)
- Campo `proof` (input que gerou a evidência — ex: payload, request, comando)
- Comentários em thread por finding
- Histórico de mudanças de status e severidade

### 7.8 Evidências

- Upload de arquivos: `jpg`, `jpeg`, `png`, `txt`, `log`
- Validação de MIME no back e front
- Limite de tamanho (ex: 10 MB por arquivo)
- Campo `proof` obrigatório descrevendo o contexto da evidência
- Armazenamento: filesystem local em volume Docker (MVP) → migração futura para S3/MinIO

### 7.9 Avaliação de maturidade

Inspirada no padrão visto em ferramentas de mercado (ex: TechNova):

- Organizada em **domínios** (Gestão de Acesso, Backup & Continuidade, Segurança de Rede, etc.)
- Cada domínio tem **subcontroles** com score de 1 a 5 e flag de conformidade
- Admin avalia manualmente cada subcontrole
- Score consolidado do domínio = média ponderada
- Score geral = média dos domínios
- **Ajuste automático**: quantidade e severidade de findings ativos penalizam o score
- Nível final: Básico (< 40), Intermediário (40-70), Avançado (> 70)
- Radar/spider chart comparativo entre avaliações

#### Estrutura hierárquica

```mermaid
graph TB
    A[Assessment<br/>avaliação de maturidade] --> D1[Domínio<br/>Gestão de Acesso]
    A --> D2[Domínio<br/>Backup]
    A --> D3[Domínio<br/>Rede]
    A --> D4[...]

    D1 --> C11[Controle<br/>MFA]
    D1 --> C12[Controle<br/>Revisão Privilégios]

    D2 --> C21[Controle<br/>Backup Offsite]
    D2 --> C22[Controle<br/>Testes Restauração]

    C11 --> S1["Score 1-5<br/>Conforme: S/N"]
    C12 --> S2["Score 1-5<br/>Conforme: S/N"]
    C21 --> S3["Score 1-5<br/>Conforme: S/N"]
    C22 --> S4["Score 1-5<br/>Conforme: S/N"]

    classDef top fill:#581c87,stroke:#c084fc,color:#fff
    classDef mid fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef leaf fill:#065f46,stroke:#34d399,color:#fff
    class A top
    class D1,D2,D3,D4 mid
    class C11,C12,C21,C22 leaf
    class S1,S2,S3,S4 leaf
```

#### Domínios iniciais

1. Gestão de Acesso
2. Backup & Continuidade
3. Segurança de Rede
4. Gestão de Vulnerabilidades
5. Monitoramento e Resposta
6. Conscientização e Cultura
7. Gestão de Código e Dependências

### 7.10 Dashboard

- Visão admin: operação da consultoria inteira
- Visão pentester: projetos atribuídos
- Visão cliente: seus projetos + maturidade + tendência histórica

### 7.11 Relatórios

- Geração **client-side** com `pdf-lib`
- Sem processamento pesado no servidor → reduz superfície DDoS
- Dois tipos: executivo e técnico (detalhes em §29)

### 7.12 Portal do cliente (web)

- Dashboard simplificado
- Lista de findings liberados
- Chat com analista (via socket)
- Abertura de ticket de suporte (gera e-mail para admin)
- Download de relatórios
- Solicitar revalidação

### 7.13 Comentários e chat

- **Comentários em findings**: thread assíncrona, notificação por e-mail
- **Chat em projeto**: tempo real via WebSocket (Socket.IO), mensagens persistidas em banco
- **Tickets de suporte**: fluxo separado, criado pelo cliente → e-mail para admin → resposta na plataforma

### 7.14 Integração com IA (Gemini)

- Endpoint autenticado que consulta Gemini com contexto de projeto/finding
- Funcionalidades:
  - Sugestão de descrição e recomendação a partir de título
  - Sugestão de categoria OWASP
  - Resumo executivo do projeto
  - Dicas de vulnerabilidades comuns dado o tech stack da aplicação
- **Rate limit** agressivo por usuário para controlar custo
- Chave de API armazenada em variável de ambiente (nunca no código)

---

## 8. Escopo funcional — Mobile

> **Escopo propositalmente enxuto.** Mobile é read-mostly, exclusivo para perfil `CLIENT`.

### 8.1 Mapa de navegação

```mermaid
graph TB
    LP[Landing<br/>pública] --> LOGIN[Login]
    LP --> PLANS[Planos<br/>redireciona para web]
    LOGIN --> HOME[Home<br/>Lista de projetos]
    HOME --> PDET[Detalhe do projeto]
    PDET --> FLIST[Lista de findings]
    FLIST --> FDET[Detalhe de finding<br/>read-only]
    PDET --> RPT[Relatórios<br/>viewer PDF]
    HOME --> CFG[Configurações<br/>push por categoria]
    HOME --> NOTIF[Central de<br/>notificações]

    classDef pub fill:#7c2d12,stroke:#fb923c,color:#fff
    classDef logged fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef detail fill:#065f46,stroke:#34d399,color:#fff
    class LP,LOGIN,PLANS pub
    class HOME,CFG,NOTIF logged
    class PDET,FLIST,FDET,RPT detail
```

### 8.2 Landing page (acesso público)

- Apresentação da plataforma
- Lista de planos
- Botão de contratação (redireciona para web ou fluxo interno simplificado)
- Login

### 8.3 Área logada do cliente

- Lista de projetos da empresa
- Detalhe de projeto (status, findings resumidos, linha do tempo)
- Lista de findings liberados
- Detalhe de finding (somente leitura)
- Download/visualização de relatórios
- Notificações push:
  - Finding crítico liberado
  - Projeto mudou de status
  - Nova mensagem no chat
- Configurações: ativar/desativar categorias de push

### 8.4 O que **não** vai ter no mobile

- Cadastro de aplicações
- Criação/edição de projetos
- Chat em tempo real (apenas visualização? — decisão aberta; recomendação: só notificação inicialmente)
- Abertura de tickets (deixar para web)
- Qualquer função administrativa

---

## 9. Fora do escopo

- Execução real de ataques
- Exploração automatizada
- Integração com scanners comerciais (Burp Pro, Acunetix)
- Esteira CI/CD do cliente com bloqueio automático
- Coleta automática de CVEs
- Laudos com validade jurídica
- Multitenancy corporativo avançado (org → subsidiárias)
- Gateway de pagamento real
- App mobile para Admin ou Pentester

---

## 10. Requisitos funcionais

| ID   | Requisito                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------- |
| RF01 | O sistema deve permitir autenticação via e-mail e senha com JWT                                     |
| RF02 | O sistema deve suportar três roles (ADMIN, PENTESTER, CLIENT) e subrole de empresa (OWNER, MEMBER)  |
| RF03 | O sistema deve permitir cadastro de empresa cliente via onboarding público                          |
| RF04 | O sistema deve permitir que empresas cadastrem aplicações respeitando o limite do plano             |
| RF05 | O sistema deve permitir contratação de plano com ativação manual pelo admin                         |
| RF06 | O sistema deve notificar o admin sobre novas assinaturas                                            |
| RF07 | O sistema deve permitir abertura de projetos com escopo personalizado                               |
| RF08 | O sistema deve permitir marcar projeto com flag de serviço de remediação                            |
| RF09 | O sistema deve permitir vincular múltiplos pentesters a um projeto                                  |
| RF10 | O sistema deve permitir registro de findings com CVSS vector e categoria OWASP                      |
| RF11 | O sistema deve calcular severidade automaticamente a partir do CVSS score                           |
| RF12 | O sistema deve permitir override manual da severidade com justificativa                             |
| RF13 | O sistema deve permitir anexar evidências (jpg, jpeg, png, txt, log) com campo `proof`              |
| RF14 | O sistema deve implementar máquina de estados para findings                                         |
| RF15 | O sistema deve permitir comentários em threads por finding                                          |
| RF16 | O sistema deve permitir chat em tempo real por projeto                                              |
| RF17 | O sistema deve permitir abertura de tickets de suporte que disparam e-mail ao admin                 |
| RF18 | O sistema deve permitir avaliação de maturidade por domínios e subcontroles                         |
| RF19 | O sistema deve gerar relatório executivo e técnico em PDF client-side                               |
| RF20 | O sistema deve exibir dashboards diferenciados por perfil                                           |
| RF21 | O sistema deve registrar logs de criação de findings e mudanças de severidade                       |
| RF22 | O sistema deve integrar com Gemini para sugestões assistidas                                        |
| RF23 | O mobile deve permitir login, consulta de projetos/findings/relatórios e receber push notifications |
| RF24 | O cliente deve poder desativar categorias específicas de push                                       |

---

## 11. Requisitos não funcionais

| ID    | Requisito                                                                                 |
| ----- | ----------------------------------------------------------------------------------------- |
| RNF01 | O sistema deve ser desenvolvido em TypeScript em todas as camadas                         |
| RNF02 | O back-end deve ser Express com arquitetura em camadas (controller → service → repository) |
| RNF03 | O front-end web deve ser React + Vite (App Router) com Tailwind                                |
| RNF04 | O mobile deve ser React Native via Expo Go                                                |
| RNF05 | O banco de dados deve ser MySQL 8+                                                  |
| RNF06 | O ORM deve ser Prisma                                                                     |
| RNF07 | Toda a infraestrutura local deve rodar via Docker Compose                                 |
| RNF08 | Dockerfiles **não podem** usar `COPY .` cru e devem rodar como usuário não-root           |
| RNF09 | O sistema deve ter pipeline CI/CD via GitHub Actions (lint, testes, build, SAST)          |
| RNF10 | O sistema deve ser analisado continuamente pelo SonarQube                                 |
| RNF11 | O sistema deve expor métricas Prometheus e ter dashboards no Grafana                      |
| RNF12 | O sistema deve ser analisado pelo OWASP ZAP em ambiente de staging                        |
| RNF13 | Senhas devem ser armazenadas com bcrypt (cost >= 10)                                      |
| RNF14 | Tokens JWT devem ter expiração curta (access 15min, refresh 7 dias)                       |
| RNF15 | Uploads devem ter validação de MIME type e limite de tamanho                              |
| RNF16 | O sistema deve ter logs estruturados (JSON) em todas as camadas                           |
| RNF17 | Dados sensíveis (senhas, tokens, evidências) não devem aparecer em logs                   |
| RNF18 | A geração de PDF deve ocorrer no cliente para evitar superfície de ataque DDoS            |
| RNF19 | O sistema deve ser responsivo (mobile-first no web do cliente)                            |

---

## 12. Regras de negócio

| ID   | Regra                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| RN01 | Uma `Company` pode ter múltiplos `Users` com role CLIENT                                                                         |
| RN02 | Um `User` pertence a no máximo uma `Company`                                                                                     |
| RN03 | A quantidade de `Applications` de uma Company é limitada pelo plano ativo                                                        |
| RN04 | Uma `Application` pertence a uma única `Company` e é reutilizável entre projetos                                                 |
| RN05 | Um `Project` é 1-para-1 com `Application`                                                                                        |
| RN06 | Um `Project` herda a Company da Application                                                                                      |
| RN07 | Um `Project` só pode ser aberto se a Company tiver assinatura ativa                                                              |
| RN08 | Um `Project` pode ter múltiplos `Pentesters` atribuídos                                                                          |
| RN09 | Toda `Vulnerability` pertence a um `Project` e herda sua Application                                                             |
| RN10 | A severidade de uma `Vulnerability` é calculada a partir do CVSS vector (v3.1), com possibilidade de override manual justificado |
| RN11 | Toda `Vulnerability` deve ter uma categoria OWASP Top 10                                                                         |
| RN12 | Transições de status de `Vulnerability` seguem a máquina de estados definida em §14                                              |
| RN13 | Se o projeto tem `hasRemediationService = true`, analista pode mover para `FIXED` e `REVALIDATION`                               |
| RN14 | Se `hasRemediationService = false`, apenas o cliente pode marcar como `FIXED` ou solicitar `REVALIDATION`                        |
| RN15 | Admin pode sempre mover qualquer status (para correções administrativas) — mas a ação é auditada                                 |
| RN16 | O cliente só vê dados de Projects/Applications/Findings da sua própria Company                                                   |
| RN17 | O pentester só vê Projects aos quais está atribuído                                                                              |
| RN18 | Relatórios só podem ser gerados com o projeto em status ≥ `IN_REVIEW`                                                            |
| RN19 | Avaliação de maturidade é feita por Admin; clientes/pentesters apenas visualizam                                                 |
| RN20 | Criação de Vulnerability gera log de auditoria                                                                                   |
| RN21 | Mudança de severidade (manual ou via CVSS) gera log de auditoria                                                                 |
| RN22 | Nova assinatura notifica admin por e-mail e via plataforma                                                                       |
| RN23 | Ticket de suporte gera e-mail para admin com link direto                                                                         |
| RN24 | Push notifications mobile são filtráveis por categoria nas configurações do usuário                                              |

### 12.1 Regra 3 visualizada — limite de aplicações

```mermaid
flowchart LR
    A[Cliente solicita<br/>criar aplicação] --> B[Back valida]
    B --> C{Plano ativo?}
    C -- não --> X[(403 Forbidden<br/>assinatura inativa)]
    C -- sim --> D{Count apps < limit?}
    D -- sim --> OK[(201 Created)]
    D -- não --> Y[(422 Unprocessable<br/>limite atingido)]

    classDef ok fill:#065f46,stroke:#34d399,color:#fff
    classDef err fill:#7f1d1d,stroke:#f87171,color:#fff
    class OK ok
    class X,Y err
```

---

## 13. Perfis e permissões

### 13.1 Hierarquia de identidades

```mermaid
graph TB
    USR[User - identidade base]
    USR --> R1[role: ADMIN]
    USR --> R2[role: PENTESTER]
    USR --> R3[role: CLIENT]

    R3 --> CR1["companyRole: OWNER<br/>contrata, convida, paga"]
    R3 --> CR2["companyRole: MEMBER<br/>consulta e interage"]

    R3 -.pertence a.-> COMP[Company]
    CR1 -.vincula.-> COMP
    CR2 -.vincula.-> COMP

    classDef base fill:#581c87,stroke:#c084fc,color:#fff
    classDef role fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef sub fill:#065f46,stroke:#34d399,color:#fff
    classDef ext fill:#7c2d12,stroke:#fb923c,color:#fff
    class USR base
    class R1,R2,R3 role
    class CR1,CR2 sub
    class COMP ext
```

### 13.2 Matriz de permissões

| Ação                             |    Admin    | Pentester | Client (Owner)  | Client (Member) |
| -------------------------------- | :---------: | :-------: | :-------------: | :-------------: |
| Login                            |     ✅      |    ✅     |       ✅        |       ✅        |
| Gerenciar usuários da plataforma |     ✅      |    ❌     |       ❌        |       ❌        |
| Ativar assinatura                |     ✅      |    ❌     |       ❌        |       ❌        |
| Criar empresa                    | ✅ (manual) |    ❌     | ✅ (onboarding) |       ❌        |
| Editar empresa própria           |     ❌      |    ❌     |       ✅        |       ❌        |
| Convidar usuário da empresa      |     ❌      |    ❌     |       ✅        |       ❌        |
| Cadastrar aplicação              |     ✅      |    ❌     |       ✅        |       ✅        |
| Abrir projeto                    |     ✅      |    ❌     |       ✅        |       ✅        |
| Atribuir pentester               |     ✅      |    ❌     |       ❌        |       ❌        |
| Registrar finding                |     ✅      |    ✅     |       ❌        |       ❌        |
| Comentar em finding              |     ✅      |    ✅     |       ✅        |       ✅        |
| Avaliar maturidade               |     ✅      |    ❌     |       ❌        |       ❌        |
| Gerar relatório                  |     ✅      |    ✅     |  ✅ (download)  |  ✅ (download)  |
| Abrir ticket de suporte          |     ❌      |    ❌     |       ✅        |       ✅        |
| Ver dashboard global             |     ✅      |    ❌     |       ❌        |       ❌        |
| Ver dashboard da empresa         |     ✅      |    ❌     |       ✅        |       ✅        |

---

## 14. Máquinas de estado

### 14.1 Status de Project

```mermaid
stateDiagram-v2
    [*] --> REQUESTED: Cliente contrata plano
    REQUESTED --> TRIAGE: Admin inicia triagem
    TRIAGE --> PLANNED: Escopo aprovado
    PLANNED --> IN_PROGRESS: Analista inicia
    IN_PROGRESS --> IN_REVIEW: Análise concluída
    IN_REVIEW --> IN_PROGRESS: Revisão solicita ajustes
    IN_REVIEW --> DELIVERED: Relatório entregue
    DELIVERED --> CLOSED: Cliente aceita
    DELIVERED --> IN_PROGRESS: Revalidação solicitada
    CLOSED --> [*]
```

### 14.2 Status de Vulnerability

```mermaid
stateDiagram-v2
    [*] --> OPEN: Analista cadastra
    OPEN --> IN_PROGRESS: Em remediação
    IN_PROGRESS --> FIXED: Marcado como corrigido
    FIXED --> REVALIDATION: Solicita revalidação
    REVALIDATION --> CLOSED: Analista valida correção
    REVALIDATION --> IN_PROGRESS: Correção não validada
    OPEN --> RISK_ACCEPTED: Cliente aceita o risco
    RISK_ACCEPTED --> CLOSED: Registro final
    CLOSED --> [*]
```

**Quem pode transicionar:**

| Transição                  | Com remediação | Sem remediação |
| -------------------------- | -------------- | -------------- |
| OPEN → IN_PROGRESS         | Analista       | Cliente        |
| IN_PROGRESS → FIXED        | Analista       | Cliente        |
| FIXED → REVALIDATION       | Cliente        | Cliente        |
| REVALIDATION → CLOSED      | Analista       | Analista       |
| REVALIDATION → IN_PROGRESS | Analista       | Cliente        |
| OPEN → RISK_ACCEPTED       | Cliente        | Cliente        |

### 14.3 Status de Subscription

```mermaid
stateDiagram-v2
    [*] --> PENDING_APPROVAL: Cliente contrata
    PENDING_APPROVAL --> ACTIVE: Admin aprova
    PENDING_APPROVAL --> REJECTED: Admin recusa
    ACTIVE --> SUSPENDED: Violação ou inadimplência
    SUSPENDED --> ACTIVE: Regularização
    ACTIVE --> CANCELED: Cliente cancela
    SUSPENDED --> CANCELED: Cancelamento forçado
    CANCELED --> [*]
    REJECTED --> [*]
```

### 14.4 Status de Support Ticket

```mermaid
stateDiagram-v2
    [*] --> OPEN: Cliente abre
    OPEN --> IN_PROGRESS: Admin responde
    IN_PROGRESS --> OPEN: Cliente responde
    IN_PROGRESS --> CLOSED: Resolvido
    OPEN --> CLOSED: Cancelado pelo cliente
    CLOSED --> [*]
```

---

## 15. Fluxos principais

### 15.1 Fluxo macro

```mermaid
sequenceDiagram
    participant C as Cliente
    participant W as Web
    participant A as Admin
    participant P as Pentester
    participant G as Gemini

    C->>W: Acessa landing page
    C->>W: Cria conta e assina plano
    W-->>A: Notifica nova assinatura
    A->>W: Ativa assinatura
    C->>W: Cadastra aplicação
    C->>W: Solicita análise (cria projeto)
    A->>W: Atribui pentester
    P->>W: Executa análise
    P->>G: Solicita sugestão de recomendação
    G-->>P: Retorna sugestão
    P->>W: Cadastra findings
    C->>W: Acompanha via web/mobile
    W-->>C: Push notification (crítico)
    P->>W: Gera relatório
    C->>W: Baixa relatório
    C->>W: Solicita revalidação
    P->>W: Valida correção
    A->>W: Encerra projeto
```

### 15.2 Fluxo de autenticação JWT

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Front
    participant B as Back-end
    participant DB as MySQL

    U->>F: login(email, senha)
    F->>B: POST /auth/login
    B->>DB: busca user por email
    DB-->>B: user + hash
    B->>B: bcrypt.compare
    B->>B: gera access (15min) + refresh (7d)
    B->>DB: salva refresh_token hash
    B-->>F: { accessToken, refreshToken }
    F->>F: armazena tokens<br/>(Secure storage)

    Note over F,B: Fluxo de requisição autenticada
    F->>B: GET /projects (Bearer access)
    B->>B: valida JWT
    B-->>F: 200 OK

    Note over F,B: Fluxo de renovação
    F->>B: POST /auth/refresh
    B->>DB: valida hash do refresh
    B-->>F: novo access token
```

### 15.3 Fluxo de finding com Gemini

```mermaid
sequenceDiagram
    participant P as Pentester
    participant F as Front
    participant B as Back-end
    participant G as Gemini API

    P->>F: preenche título + contexto
    P->>F: clica "Sugerir com IA"
    F->>B: POST /ai/suggest-finding
    B->>B: rate limit check
    B->>G: prompt estruturado
    G-->>B: JSON com sugestões
    B->>B: valida schema
    B-->>F: { description, owasp, cvss, recommendation }
    F-->>P: exibe sugestões editáveis
    P->>F: ajusta e salva
    F->>B: POST /vulnerabilities
    B->>B: marca aiAssisted = true
    B->>B: gera audit log
    B-->>F: 201 Created
```

---

## 16. Jornadas de usuário

### 16.1 Jornada do cliente (onboarding)

```mermaid
journey
    title Jornada do cliente - primeiro uso
    section Descoberta
      Visita landing page: 5: Cliente
      Compara planos: 4: Cliente
    section Cadastro
      Preenche dados da empresa: 3: Cliente
      Seleciona plano: 4: Cliente
      Aguarda aprovação: 2: Cliente
    section Ativação
      Recebe e-mail de boas-vindas: 5: Cliente
      Faz primeiro login: 5: Cliente
    section Uso
      Cadastra aplicação: 4: Cliente
      Abre projeto: 4: Cliente
      Acompanha análise: 5: Cliente
      Baixa relatório: 5: Cliente
```

### 16.2 Jornada do pentester (análise)

```mermaid
journey
    title Jornada do pentester - ciclo de análise
    section Recebimento
      Vê novo projeto atribuído: 4: Pentester
      Lê escopo e restrições: 3: Pentester
    section Execução
      Analisa aplicação: 4: Pentester
      Encontra vulnerabilidade: 5: Pentester
      Solicita ajuda do Gemini: 4: Pentester
    section Registro
      Cadastra finding: 5: Pentester
      Anexa evidências: 4: Pentester
      Discute com cliente no chat: 4: Pentester
    section Entrega
      Gera relatório técnico: 5: Pentester
      Valida correções: 4: Pentester
      Encerra projeto: 5: Pentester
```

### 16.3 Jornada do admin (operação)

```mermaid
journey
    title Jornada do admin - dia típico
    section Manhã
      Revisa novas assinaturas: 4: Admin
      Aprova clientes: 5: Admin
      Atribui projetos: 3: Admin
    section Tarde
      Responde tickets: 2: Admin
      Avalia maturidade: 4: Admin
      Gera dashboards: 5: Admin
    section Fim do dia
      Revisa relatórios: 4: Admin
      Encerra projetos: 5: Admin
```

---

## 17. Modelagem de dados

### 17.1 Visão conceitual simplificada

```mermaid
graph LR
    COMP[Company] --> USR[Users]
    COMP --> APP[Applications]
    COMP --> SUB[Subscriptions]
    PLAN[Plans] --> SUB
    APP --> PROJ[Projects]
    PROJ --> VULN[Vulnerabilities]
    PROJ --> CHAT[ChatMessages]
    PROJ --> REP[Reports]
    PROJ --> MAT[Maturity Assessment]
    VULN --> EVI[Evidences]
    VULN --> CMT[Comments]
    MAT --> MSC[Maturity Scores]
    MDOM[Domains] --> MCTRL[Controls]
    MCTRL --> MSC
    USR --> NOT[Notifications]
    USR --> AUD[Audit Logs]
    USR --> TIC[Support Tickets]

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef core fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef detail fill:#065f46,stroke:#34d399,color:#fff
    classDef meta fill:#7c2d12,stroke:#fb923c,color:#fff
    class COMP,USR,PROJ,VULN root
    class APP,SUB,PLAN,MAT core
    class EVI,CMT,CHAT,REP,MSC detail
    class MDOM,MCTRL,NOT,AUD,TIC meta
```

### 17.2 Entidades principais

- `User` — qualquer pessoa que loga (role: ADMIN, PENTESTER, CLIENT)
- `Company` — empresa cliente
- `Plan` — catálogo de planos disponíveis
- `Subscription` — assinatura ativa de uma company
- `Application` — sistema alvo de análise (pertence a company)
- `Project` — análise específica (1-1 com application)
- `ProjectMember` — vínculo pentester ↔ projeto
- `Vulnerability` — finding
- `Evidence` — arquivo/prova anexada a um finding
- `VulnerabilityComment` — thread de comentários por finding
- `ChatMessage` — mensagem de chat do projeto
- `SupportTicket` — ticket aberto pelo cliente
- `MaturityAssessment` — avaliação de maturidade do projeto/company
- `MaturityDomain` — catálogo de domínios
- `MaturityControl` — subcontrole dentro de um domínio
- `MaturityScore` — score de um subcontrole em uma avaliação
- `Report` — metadados do relatório gerado
- `Notification` — notificação in-app (com flag para push)
- `AuditLog` — trilha de auditoria
- `PasswordResetToken` — tokens de reset
- `RefreshToken` — tokens de refresh JWT

### 17.3 Justificativa de escolhas

- **Company separada de User**: permite múltiplos usuários por empresa com subrole (OWNER, MEMBER)
- **Plan como tabela**: permite criar novos planos sem deploy (administrativo)
- **MaturityControl como tabela**: catálogo centralizado, permite evolução sem quebrar avaliações históricas
- **AuditLog genérica**: uma tabela com `entityType`, `entityId`, `action`, `diff` cobre todos os casos

---

## 18. MER em Mermaid

```mermaid
erDiagram
    USER {
        uuid id PK
        string email UK
        string password_hash
        string name
        string role "ADMIN | PENTESTER | CLIENT"
        string company_role "OWNER | MEMBER | null"
        uuid company_id FK
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    COMPANY {
        uuid id PK
        string legal_name
        string trade_name
        string cnpj UK
        string contact_email
        string contact_phone
        datetime created_at
    }

    PLAN {
        uuid id PK
        string name "BASIC | PRO | Enterprise"
        int app_limit
        int concurrent_project_limit
        boolean includes_remediation
        decimal monthly_price
        boolean is_active
    }

    SUBSCRIPTION {
        uuid id PK
        uuid company_id FK
        uuid plan_id FK
        string status "PENDING_APPROVAL | ACTIVE | SUSPENDED | CANCELED"
        date start_date
        date end_date
        datetime created_at
        uuid approved_by FK "User (admin)"
    }

    APPLICATION {
        uuid id PK
        uuid company_id FK
        string name
        string url
        string environment "PROD | HOMOL | DEV"
        string tech_stack
        string description
        boolean is_active
        datetime created_at
    }

    PROJECT {
        uuid id PK
        uuid application_id FK
        string name
        string analysis_type "SAST | DAST | MATURITY | COMBO"
        string analysis_level "BASIC | INTERMEDIATE | ADVANCED"
        boolean has_remediation_service
        string scope_in
        string scope_out
        string notes
        string status
        datetime requested_at
        datetime started_at
        datetime closed_at
    }

    PROJECT_MEMBER {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        datetime assigned_at
    }

    VULNERABILITY {
        uuid id PK
        uuid project_id FK
        string title
        text description
        string owasp_category "A01..A10"
        string cvss_vector
        float cvss_score
        string severity_calculated
        string severity_final
        string severity_override_reason
        text impact
        text recommendation
        string status
        boolean ai_assisted
        uuid created_by FK
        uuid assigned_to FK
        datetime created_at
        datetime updated_at
    }

    EVIDENCE {
        uuid id PK
        uuid vulnerability_id FK
        string file_name
        string file_path
        string mime_type
        int size_bytes
        text proof
        uuid uploaded_by FK
        datetime created_at
    }

    VULN_COMMENT {
        uuid id PK
        uuid vulnerability_id FK
        uuid author_id FK
        text content
        datetime created_at
    }

    CHAT_MESSAGE {
        uuid id PK
        uuid project_id FK
        uuid author_id FK
        text content
        datetime sent_at
    }

    SUPPORT_TICKET {
        uuid id PK
        uuid opened_by FK
        uuid company_id FK
        string subject
        text description
        string status "OPEN | IN_PROGRESS | CLOSED"
        datetime opened_at
        datetime closed_at
    }

    MATURITY_DOMAIN {
        uuid id PK
        string name
        string description
        int sort_order
    }

    MATURITY_CONTROL {
        uuid id PK
        uuid domain_id FK
        string name
        text description
        int sort_order
    }

    MATURITY_ASSESSMENT {
        uuid id PK
        uuid company_id FK
        uuid project_id FK
        float overall_score
        string level "BASIC | INTERMEDIATE | ADVANCED"
        text notes
        uuid evaluated_by FK
        datetime created_at
    }

    MATURITY_SCORE {
        uuid id PK
        uuid assessment_id FK
        uuid control_id FK
        int score "1..5"
        boolean is_compliant
        text notes
    }

    REPORT {
        uuid id PK
        uuid project_id FK
        string type "EXECUTIVE | TECHNICAL"
        string title
        text summary
        datetime generated_at
        uuid generated_by FK
    }

    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        string category
        string title
        text message
        boolean is_read
        boolean sent_as_push
        datetime created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid actor_id FK
        string entity_type
        uuid entity_id
        string action
        text diff_json
        datetime created_at
    }

    COMPANY ||--o{ USER : "has users"
    COMPANY ||--o{ APPLICATION : "owns"
    COMPANY ||--o{ SUBSCRIPTION : "subscribes"
    PLAN ||--o{ SUBSCRIPTION : "is used by"
    APPLICATION ||--|| PROJECT : "has one active"
    PROJECT ||--o{ PROJECT_MEMBER : "includes"
    USER ||--o{ PROJECT_MEMBER : "participates"
    PROJECT ||--o{ VULNERABILITY : "contains"
    VULNERABILITY ||--o{ EVIDENCE : "has"
    VULNERABILITY ||--o{ VULN_COMMENT : "has"
    PROJECT ||--o{ CHAT_MESSAGE : "has"
    USER ||--o{ CHAT_MESSAGE : "sends"
    USER ||--o{ SUPPORT_TICKET : "opens"
    COMPANY ||--o{ SUPPORT_TICKET : "has"
    MATURITY_DOMAIN ||--o{ MATURITY_CONTROL : "includes"
    PROJECT ||--o{ MATURITY_ASSESSMENT : "has"
    COMPANY ||--o{ MATURITY_ASSESSMENT : "has"
    MATURITY_ASSESSMENT ||--o{ MATURITY_SCORE : "has"
    MATURITY_CONTROL ||--o{ MATURITY_SCORE : "scored in"
    PROJECT ||--o{ REPORT : "generates"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDIT_LOG : "performs"
```

---

## 19. Arquitetura técnica

### 19.1 Diagrama de alto nível

```mermaid
graph TB
    subgraph "Clientes"
        W[Web React + Vite]
        M[Mobile Expo]
    end

    subgraph "Borda"
        NGINX[Nginx reverse proxy]
    end

    subgraph "Aplicação"
        API[Express API REST]
        WS[Socket.IO Gateway]
    end

    subgraph "Dados"
        PG[(MySQL)]
        FS[Volume evidências]
    end

    subgraph "Externos"
        GEMINI[Google Gemini API]
        SMTP[SMTP / SendGrid]
        EXPO[Expo Push Service]
    end

    subgraph "Observabilidade"
        PROM[Prometheus]
        GRAF[Grafana]
        SONAR[SonarQube]
    end

    W --> NGINX
    M --> NGINX
    M -.push.- EXPO
    NGINX --> API
    NGINX --> WS
    API --> PG
    API --> FS
    API --> GEMINI
    API --> SMTP
    API --> EXPO
    WS --> PG
    API --> PROM
    PROM --> GRAF
```

### 19.2 Camadas do back-end (Express)

```mermaid
graph LR
    REQ[HTTP Request] --> CTRL[Controller]
    CTRL --> DTO[DTO + Validation]
    DTO --> GRD[Guard<br/>Auth + Role + Ownership]
    GRD --> SVC[Service<br/>regras de negócio]
    SVC --> REPO[Repository<br/>abstração Prisma]
    REPO --> DB[(MySQL)]
    REPO --> SVC
    SVC --> CTRL
    CTRL --> RES[HTTP Response]

    classDef entry fill:#7c2d12,stroke:#fb923c,color:#fff
    classDef layer fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef data fill:#065f46,stroke:#34d399,color:#fff
    class REQ,RES entry
    class CTRL,DTO,GRD,SVC,REPO layer
    class DB data
```

- **Controller**: rotas HTTP, validação de entrada (class-validator)
- **Guard**: JWT, role, ownership (ex: cliente só vê sua company)
- **Service**: regras de negócio, orquestração
- **Repository**: abstração sobre Prisma (facilita testes)
- **DTOs**: tipagem forte de input/output

### 19.3 Fluxo de uma requisição típica

```mermaid
sequenceDiagram
    participant C as Cliente Web
    participant N as Nginx
    participant CTRL as Controller
    participant GRD as AuthGuard
    participant SVC as Service
    participant RP as Repository
    participant DB as MySQL

    C->>N: GET /api/v1/projects
    N->>CTRL: proxy
    CTRL->>GRD: valida JWT
    GRD->>GRD: extrai userId, role
    GRD-->>CTRL: OK
    CTRL->>SVC: findProjects(user)
    SVC->>SVC: aplica filtro por escopo<br/>(company ou atribuição)
    SVC->>RP: query
    RP->>DB: SELECT
    DB-->>RP: rows
    RP-->>SVC: entities
    SVC-->>CTRL: DTOs
    CTRL-->>C: 200 JSON
```

### 19.4 Estratégia de testes

| Camada     | Tipo de teste      | Ferramenta       |
| ---------- | ------------------ | ---------------- |
| Service    | Unitário           | Jest + mocks     |
| Controller | Integração         | Jest + supertest |
| E2E        | Cypress/Playwright | Fim-a-fim        |
| Front      | Componente         | Vitest + RTL     |
| Mobile     | Unit + snapshot    | Jest + RNTL      |

---

## 20. Stack técnica definitiva

### 20.1 Linguagem

- **TypeScript** em todas as camadas (web, mobile, back)
- `strict: true` no `tsconfig`

### 20.2 Back-end

- **Express 10+**
- **Prisma** como ORM
- **MySQL 8**
- **Socket.IO** para real-time
- **Nodemailer** (ou Resend) para e-mail
- **jsonwebtoken** + **bcrypt** para auth
- **class-validator** + **class-transformer**
- **Pino** para logging estruturado
- **express** para documentação OpenAPI

### 20.3 Front-end web

- **React + Vite** (App Router)
- **React 18**
- **Tailwind CSS**
- **shadcn/ui** para componentes base
- **Recharts** para gráficos (incluindo radar de maturidade)
- **pdf-lib** para geração de relatórios client-side
- **Zustand** ou **TanStack Query** para estado
- **Axios** com interceptors para auth
- **Socket.IO client** para chat

### 20.4 Mobile

- **React Native via Expo (Expo Go)**
- **Expo Router** para navegação
- **Expo Notifications** para push
- **NativeWind** (Tailwind no RN) — opcional
- **Axios** + **TanStack Query**

### 20.5 Infraestrutura local

- **Docker + Docker Compose**
- Containers: api, web, mysql, prometheus, grafana, sonarqube
- **Nginx** como reverse proxy (em prod)

### 20.6 Mapa mental da stack

```mermaid
mindmap
  root((Vulnera))
    Back-end
      Express
      Prisma
      MySQL
      Socket.IO
      JWT manual
      Pino logs
    Front-end Web
      React + Vite
      App Router
      Tailwind
      shadcn/ui
      Recharts
      pdf-lib
      TanStack Query
    Mobile
      Expo
      Expo Router
      Expo Notifications
      NativeWind
    Infra
      Docker
      docker-compose
      Nginx
    DevSecOps
      GitHub Actions
      SonarQube
      OWASP ZAP
      Prometheus
      Grafana
    IA
      Gemini 1.5 Flash
      Rate limiting
```

---

## 21. DevSecOps e infraestrutura

### 21.1 Filosofia: simples e que funciona

> Este é um projeto de TCC, não produção. O objetivo do Docker é garantir que **qualquer integrante consiga rodar o projeto em qualquer máquina com um comando**. Nada além disso.

**Princípios:**

- Um **único `docker-compose.yml`** na raiz do repo
- Poucos serviços: apenas os que não são triviais de instalar localmente
- Desenvolvimento do código é **local** (`npm run dev`), não dentro do container
- Dockerfile só entra em cena pra build do CI (validar que build passa)
- Sem multi-stage complexo, sem Nginx, sem staging, sem produção

### 21.2 O que roda onde

```mermaid
graph LR
    subgraph "Máquina do dev (local)"
        A[api - Express<br/>npm run dev]
        W[web - React + Vite<br/>npm run dev]
        M[mobile - Expo<br/>npx expo start]
    end

    subgraph "Docker Compose"
        DB[(MySQL)]
        SQ[SonarQube]
        MH[Mailhog]
    end

    A --> DB
    A --> MH
    W --> A
    M --> A

    classDef local fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef dock fill:#065f46,stroke:#34d399,color:#fff
    class A,W,M local
    class DB,SQ,MH dock
```

**Por que essa divisão:**

- **Código roda local** → hot reload instantâneo, debug fácil, sem volume mount problemático, Expo já exige local de qualquer forma
- **Banco + SonarQube + Mailhog no Docker** → são chatos de instalar direto, e nenhum precisa de hot reload

### 21.3 docker-compose.yml (versão enxuta)

```yaml
services:
  db:
    image: mysql:8-alpine
    container_name: vulnera-db
    environment:
      POSTGRES_USER: vulnera
      POSTGRES_PASSWORD: vulnera
      POSTGRES_DB: vulnera
    ports:
      - "5432:5432"
    volumes:
      - vulnera-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vulnera"]
      interval: 5s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: vulnera-mail
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI

  sonarqube:
    image: sonarqube:10-community
    container_name: vulnera-sonar
    ports:
      - "9000:9000"
    environment:
      SONAR_ES_BOOTSTRAP_CHECKS_DISABLE: "true"
    volumes:
      - vulnera-sonar-data:/opt/sonarqube/data
      - vulnera-sonar-ext:/opt/sonarqube/extensions

volumes:
  vulnera-db-data:
  vulnera-sonar-data:
  vulnera-sonar-ext:
```

**Como usar:**

```bash
# Sobe tudo
docker compose up -d

# Instala deps locais (uma vez)
cd apps/api && npm install
cd ../web && npm install
cd ../mobile && npm install

# Em terminais separados:
cd apps/api && npm run dev      # back-end
cd apps/web && npm run dev      # web
cd apps/mobile && npx expo start  # mobile

# Quando quiser derrubar:
docker compose down

# Se quiser zerar o banco (atenção: apaga dados):
docker compose down -v
```

**Acesso:**

- Banco: `mysql://vulnera:vulnera@localhost:5432/vulnera`
- SonarQube: `http://localhost:9000` (login padrão `admin/admin`)
- Mailhog UI: `http://localhost:8025`
- API: `http://localhost:3000`
- Web: `http://localhost:3001`
- Mobile: QR code do Expo Go

### 21.4 Dockerfiles (só usados no CI)

Existem pra validar que o projeto **é construível** (não quebra ao buildar). Não são usados em dev.

**Requisitos mantidos do projeto:**

- sem `COPY .` cru (copia só o necessário)
- rodar como usuário não-root

#### `apps/api/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copia manifests primeiro (cache)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copia só o necessário para build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Usuário não-root
RUN addgroup -S vulnera && adduser -S vulnera -G vulnera
RUN chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

#### `apps/web/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY next.config.* tsconfig.json ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public

RUN npm run build

RUN addgroup -S vulnera && adduser -S vulnera -G vulnera
RUN chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3001
CMD ["npm", "start"]
```

### 21.5 CI/CD com GitHub Actions

#### Estratégia

- `main` = tratada como "produção" (estável, sempre íntegra)
- `develop` = branch de integração do time
- PRs entram em `develop` livremente
- PRs para `main` **só passam se o CI passar** (branch protection + required checks)

#### Pipeline visual

```mermaid
flowchart LR
    PR[PR para main] --> LINT[Lint]
    LINT --> TEST[Jest<br/>unit + integração]
    TEST --> REG[Testes canário<br/>auth + multi-tenant]
    REG --> SONAR[SonarQube scan]
    SONAR --> BUILD[Docker build<br/>validação]
    BUILD --> OK[(PR aprovada<br/>pode mergear)]

    LINT -- falha --> BLOCK[(PR bloqueada)]
    TEST -- falha --> BLOCK
    REG -- falha --> BLOCK
    BUILD -- falha --> BLOCK

    classDef step fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef ok fill:#065f46,stroke:#34d399,color:#fff
    classDef err fill:#7f1d1d,stroke:#f87171,color:#fff
    class PR,LINT,TEST,REG,SONAR,BUILD step
    class OK ok
    class BLOCK err
```

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      mysql:
        image: mysql:8-alpine
        env:
          POSTGRES_USER: vulnera
          POSTGRES_PASSWORD: vulnera
          POSTGRES_DB: vulnera_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U vulnera"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: mysql://vulnera:vulnera@localhost:5432/vulnera_test
      JWT_SECRET: test-secret-not-for-prod
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test
      - run: npm run test:integration

  docker-build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f apps/api/Dockerfile apps/api
      - run: docker build -f apps/web/Dockerfile apps/web

  sonarqube:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: SonarSource/sonarqube-scan-action@v2
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

  update-tech-status:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/develop'
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run tech-status:update
      - name: Commit auto-update
        run: |
          git config user.name "vulnera-bot"
          git config user.email "bot@vulnera.local"
          git add TECH_STATUS.md
          git diff --staged --quiet || git commit -m "chore: atualiza TECH_STATUS.md [skip ci]"
          git push
```

#### Branch protection em `main`

Configurar no GitHub:

- ✅ Require pull request before merging
- ✅ Require status checks to pass: `lint`, `test`, `docker-build`
- ✅ Require branches to be up to date
- ❌ SonarQube **não bloqueia** (é informativo — visível no PR)

### 21.6 SonarQube

- Roda em container local (docker-compose)
- **Sem Quality Gate bloqueante** — é informativo
- Serve pra você **monitorar tendência** (ver no `TECH_STATUS.md` se débito técnico tá crescendo)
- Em PRs, comentário automático com resumo da análise
- Métricas que você acompanha: bugs, vulnerabilities, code smells, coverage, duplication

### 21.7 OWASP ZAP

- **Não roda no CI** (seria lento demais pra cada PR)
- Roda **manualmente** antes de marcos importantes (fim de cada fase)
- Relatório exportado vira evidência no próprio TCC
- Comando manual (exemplo):

```bash
docker run --rm -v $(pwd)/zap-reports:/zap/wrk/ \
  -t ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t http://host.docker.internal:3000 \
  -r zap-report.html
```

### 21.8 Observabilidade (opcional — fase 7)

Prometheus + Grafana ficam como **fase 7** do roadmap. **Não entram no docker-compose principal** pra manter a subida do projeto rápida.

Quando chegarmos lá, rodará em um `docker-compose.observability.yml` separado, que sobe paralelamente ao principal quando necessário.

**Prometheus coleta:**

- `http_requests_total{method,status}` — volume por endpoint
- `http_request_duration_seconds` — latência
- `vulnerability_created_total{severity}` — eventos de negócio
- `active_projects` — gauge

**Grafana dashboards:**

- Operacional: latência, erros 5xx, throughput
- Negócio: projetos ativos, findings por severidade/semana, tempo médio de resolução

---

## 22. Segurança da própria aplicação

O Vulnera **precisa** ser seguro — é uma plataforma de segurança. Ironias são traiçoeiras na banca.

### 22.1 Camadas de defesa

```mermaid
graph TB
    subgraph "Perímetro"
        HTTPS[HTTPS obrigatório]
        CORS[CORS whitelist]
        HELM[Helmet headers]
    end
    subgraph "Requisição"
        RATE[Rate limiting<br/>throttler]
        VAL[class-validator<br/>DTO validation]
    end
    subgraph "Autenticação"
        JWT[JWT access 15min]
        REF[Refresh hasheado<br/>no banco]
        BCR[Bcrypt cost 12]
    end
    subgraph "Autorização"
        GRD[Guards de role]
        OWN[Ownership check<br/>company escopo]
    end
    subgraph "Dados"
        PRIS[Prisma<br/>queries parametrizadas]
        SAN[Sanitização<br/>campos markdown]
    end
    subgraph "Upload"
        MIME[Validação MIME]
        MAG[Magic number]
        UUID[Nome reescrito UUID]
    end
    subgraph "Auditoria"
        LOG[Logs estruturados<br/>sem dados sensíveis]
        AUD[AuditLog para<br/>ações sensíveis]
    end

    classDef peri fill:#7f1d1d,stroke:#f87171,color:#fff
    classDef req fill:#92400e,stroke:#fbbf24,color:#fff
    classDef auth fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef authz fill:#4c1d95,stroke:#a78bfa,color:#fff
    classDef data fill:#065f46,stroke:#34d399,color:#fff
    classDef up fill:#0c4a6e,stroke:#38bdf8,color:#fff
    classDef aud fill:#581c87,stroke:#c084fc,color:#fff
    class HTTPS,CORS,HELM peri
    class RATE,VAL req
    class JWT,REF,BCR auth
    class GRD,OWN authz
    class PRIS,SAN data
    class MIME,MAG,UUID up
    class LOG,AUD aud
```

### 22.2 Checklist implementado

| Item              | Implementação                                                             |
| ----------------- | ------------------------------------------------------------------------- |
| Senhas            | bcrypt cost 12                                                            |
| JWT               | Access 15min, Refresh 7d, RS256 ou HS256 com secret forte                 |
| Refresh token     | Armazenado hasheado no banco, invalidável                                 |
| HTTPS             | Obrigatório em prod (certificado Let's Encrypt)                           |
| CORS              | Whitelist de origens                                                      |
| Rate limiting     | `express` (100 req/min por IP)                                  |
| Helmet            | Headers de segurança                                                      |
| SQL injection     | Prisma (queries parametrizadas nativas)                                   |
| XSS               | React escapa por padrão + sanitização em campos markdown                  |
| CSRF              | SameSite cookies + double-submit se necessário                            |
| Upload de arquivo | Validação MIME + magic number + limite de tamanho + scan de extensão      |
| Path traversal    | Nomes de arquivo reescritos com UUID                                      |
| Logs sensíveis    | Campo `password`, `token`, `cvss_vector` removidos antes de logar         |
| Auditoria         | Log para CRUD de findings, mudanças de severidade, downloads de relatório |
| Secrets           | `.env` (dev) + variáveis de ambiente (prod), **nunca** em código          |
| Permissões        | Guards Express por role + ownership check                                  |

### 22.3 Cabeçalhos de segurança

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` (restritiva)
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 23. Integração com Gemini (IA)

### 23.1 Arquitetura da integração

```mermaid
sequenceDiagram
    participant U as Usuário (pentester)
    participant F as Front
    participant AI as AI Module (Express)
    participant RL as RateLimiter
    participant CFG as Config
    participant G as Gemini API

    U->>F: clica "Sugerir com IA"
    F->>AI: POST /ai/suggest-finding
    AI->>RL: check (userId)
    RL-->>AI: OK ou 429
    AI->>CFG: busca API key (env)
    AI->>AI: monta prompt estruturado
    AI->>G: gera sugestão (gemini-1.5-flash)
    G-->>AI: JSON
    AI->>AI: valida schema
    AI->>AI: NÃO loga conteúdo<br/>(dados do cliente)
    AI-->>F: sugestão
    F-->>U: exibe editável
    U->>F: ajusta e aprova
    F->>AI: POST /vulnerabilities (aiAssisted=true)
    AI->>AI: grava AuditLog
```

### 23.2 Configuração

- Chave de API em `GEMINI_API_KEY` (variável de ambiente)
- Modelo: `gemini-1.5-flash` (custo baixo) ou `gemini-1.5-pro` (qualidade)
- Rate limit por usuário: 10 chamadas/hora (configurável)

### 23.3 Casos de uso

```mermaid
graph LR
    CASE[Gemini na plataforma]
    CASE --> C1[Sugestão de finding<br/>título → descrição + OWASP + CVSS + recomendação]
    CASE --> C2[Resumo executivo<br/>de projeto]
    CASE --> C3[Dicas de vulnerabilidades<br/>dado o stack da app]
    CASE --> C4[Revisão de texto<br/>de recomendação]

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef case fill:#065f46,stroke:#34d399,color:#fff
    class CASE root
    class C1,C2,C3,C4 case
```

#### 23.3.1 Sugestão de finding

**Input:**

```json
{
  "title": "SQL Injection em /api/users/search",
  "appContext": "Node.js + Express + MySQL",
  "proof": "' OR 1=1--"
}
```

**Prompt interno:**

```
Você é um analista sênior de segurança. Com base no título do finding,
contexto da aplicação e prova, sugira:
1. Descrição técnica (3-5 linhas)
2. Categoria OWASP Top 10 2021
3. CVSS v3.1 vector sugerido
4. Recomendação de remediação (3-5 linhas)
Retorne JSON estrito.
```

**Output esperado:**

```json
{
  "description": "...",
  "owaspCategory": "A03",
  "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  "recommendation": "..."
}
```

#### 23.3.2 Resumo executivo do projeto

Agrupa findings, severidades e maturidade, gera parágrafo executivo em português.

#### 23.3.3 Dicas de vulnerabilidades comuns

Dado o tech stack da aplicação, sugere 5 vulnerabilidades mais comuns naquele ecossistema.

### 23.4 Governança

- Toda sugestão gera flag `aiAssisted = true` no finding
- Usuário pode editar livremente antes de salvar
- Sugestões não são salvas automaticamente — sempre requerem ação humana
- Prompt e resposta não são logados (dados do cliente)

---

## 24. Notificações e comunicação em tempo real

### 24.1 Canais

| Evento                             | Web (in-app) | E-mail |  Push Mobile  |
| ---------------------------------- | :----------: | :----: | :-----------: |
| Nova assinatura (para admin)       |      ✅      |   ✅   |      ❌       |
| Assinatura aprovada (para cliente) |      ✅      |   ✅   |      ❌       |
| Finding crítico liberado           |      ✅      |   ✅   | ✅ (opcional) |
| Mudança de status do projeto       |      ✅      |   ❌   | ✅ (opcional) |
| Nova mensagem no chat              |      ✅      |   ❌   | ✅ (opcional) |
| Comentário em finding              |      ✅      |   ✅   |      ❌       |
| Ticket de suporte (para admin)     |      ✅      |   ✅   |      ❌       |
| Resposta em ticket (para cliente)  |      ✅      |   ✅   |      ❌       |

### 24.2 Arquitetura de notificações

```mermaid
sequenceDiagram
    participant EVT as Evento<br/>(ex: finding crítico criado)
    participant SVC as NotificationService
    participant DB as MySQL
    participant SMTP as SMTP
    participant EXPO as Expo Push
    participant WS as Socket.IO
    participant MOB as Mobile
    participant WEB as Web

    EVT->>SVC: notify(user, payload)
    SVC->>DB: insert Notification
    SVC->>DB: busca preferências do user
    alt canal web
        SVC->>WS: emit to user room
        WS->>WEB: push in-app
    end
    alt canal e-mail habilitado
        SVC->>SMTP: send email
    end
    alt canal push habilitado e severidade crítica
        SVC->>EXPO: send push
        EXPO->>MOB: notification
    end
```

### 24.3 Chat real-time

```mermaid
sequenceDiagram
    participant C as Cliente
    participant P as Pentester
    participant WS as Socket.IO
    participant DB as MySQL

    C->>WS: connect + join project:42
    P->>WS: connect + join project:42
    C->>WS: emit message
    WS->>DB: insert ChatMessage
    WS->>C: broadcast (ack)
    WS->>P: broadcast
    P->>WS: emit message
    WS->>DB: insert
    WS->>C: broadcast
    WS->>P: broadcast (ack)
```

### 24.4 Configuração do usuário

Tela de preferências com switches por categoria:

- 🚨 Findings críticos
- 📊 Mudanças de status
- 💬 Mensagens de chat
- 📝 Comentários

---

## 25. Estrutura de pastas

### 25.1 Visão do monorepo

```mermaid
graph TB
    ROOT[vulnera/]
    ROOT --> APPS[apps/]
    ROOT --> PKGS[packages/]
    ROOT --> INFRA[infra/]
    ROOT --> GH[.github/]
    ROOT --> DOCS[docs/]

    APPS --> API[api/ Express]
    APPS --> WEB[web/ React + Vite]
    APPS --> MOB[mobile/ Expo]

    PKGS --> T[types/]
    PKGS --> V[validators/]
    PKGS --> U[utils/]

    INFRA --> DC[docker-compose.yml]
    INFRA --> PROM[prometheus/]
    INFRA --> GRAF[grafana/]
    INFRA --> NGX[nginx/]

    GH --> WF[workflows/ci.yml]

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef apps fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef shared fill:#065f46,stroke:#34d399,color:#fff
    classDef infra fill:#7c2d12,stroke:#fb923c,color:#fff
    class ROOT root
    class APPS,API,WEB,MOB apps
    class PKGS,T,V,U shared
    class INFRA,DC,PROM,GRAF,NGX,GH,WF,DOCS infra
```

### 25.2 Árvore textual

```text
vulnera/
├── apps/
│   ├── api/                    # Express
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── companies/
│   │   │   │   ├── applications/
│   │   │   │   ├── projects/
│   │   │   │   ├── vulnerabilities/
│   │   │   │   ├── evidences/
│   │   │   │   ├── maturity/
│   │   │   │   ├── reports/
│   │   │   │   ├── chat/
│   │   │   │   ├── support/
│   │   │   │   ├── notifications/
│   │   │   │   ├── subscriptions/
│   │   │   │   └── ai/
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   └── interceptors/
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/
│   │   └── Dockerfile
│   │
│   ├── web/                    # React + Vite
│   │   ├── app/
│   │   │   ├── (public)/       # LP, login, onboarding
│   │   │   ├── (admin)/        # Área admin
│   │   │   ├── (pentester)/    # Área pentester
│   │   │   ├── (client)/       # Portal do cliente
│   │   │   └── api/            # Se necessário
│   │   ├── components/
│   │   ├── lib/
│   │   └── Dockerfile
│   │
│   └── mobile/                 # Expo
│       ├── app/                # Expo Router
│       ├── components/
│       ├── services/
│       └── app.config.ts
│
├── packages/                   # Código compartilhado
│   ├── types/                  # Interfaces e enums
│   ├── validators/             # Zod schemas compartilhados
│   └── utils/
│
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── prometheus/
│   ├── grafana/
│   └── nginx/
│
├── .github/workflows/
├── docs/
└── README.md
```

---

## 26. Contratos da API REST

### 26.1 Convenções

- Base path: `/api/v1`
- Autenticação: `Authorization: Bearer <accessToken>`
- Paginação: `?page=1&pageSize=20`
- Ordenação: `?sortBy=createdAt&order=desc`
- Filtros: `?severity=HIGH&status=OPEN`

### 26.2 Organização por domínio

```mermaid
graph LR
    V1[/api/v1]
    V1 --> AUTH[/auth]
    V1 --> COMP[/companies]
    V1 --> SUB[/subscriptions]
    V1 --> APP[/applications]
    V1 --> PROJ[/projects]
    V1 --> VUL[/vulnerabilities]
    V1 --> CHAT[/chat]
    V1 --> SUP[/support]
    V1 --> MAT[/maturity]
    V1 --> REP[/reports]
    V1 --> AI[/ai]
    V1 --> NOT[/notifications]

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef core fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef sup fill:#065f46,stroke:#34d399,color:#fff
    class V1 root
    class AUTH,PROJ,VUL,COMP,APP core
    class SUB,CHAT,SUP,MAT,REP,AI,NOT sup
```

### 26.3 Endpoints principais

#### Auth

- `POST /auth/register` — registra Company + User owner
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET  /auth/me`

#### Companies

- `GET  /companies` — admin only
- `GET  /companies/:id`
- `PUT  /companies/:id`
- `GET  /companies/:id/users`
- `POST /companies/:id/users/invite`

#### Subscriptions

- `POST /subscriptions` — cria pending
- `GET  /subscriptions/pending` — admin lista pendentes
- `POST /subscriptions/:id/approve` — admin ativa
- `GET  /subscriptions/current` — cliente consulta plano ativo

#### Applications

- `GET  /applications` — filtrada por company do usuário
- `POST /applications` — valida limite do plano
- `GET  /applications/:id`
- `PUT  /applications/:id`
- `DELETE /applications/:id`

#### Projects

- `GET  /projects`
- `POST /projects` — cria em REQUESTED
- `GET  /projects/:id`
- `PUT  /projects/:id`
- `POST /projects/:id/members` — atribui pentester
- `POST /projects/:id/transition` — muda status (valida máquina)

#### Vulnerabilities

- `GET  /vulnerabilities?projectId=`
- `POST /vulnerabilities`
- `GET  /vulnerabilities/:id`
- `PUT  /vulnerabilities/:id`
- `POST /vulnerabilities/:id/transition`
- `POST /vulnerabilities/:id/evidences` — upload multipart
- `GET  /vulnerabilities/:id/comments`
- `POST /vulnerabilities/:id/comments`

#### Chat

- `GET /projects/:id/messages?before=...`
- WebSocket: `/chat` (join por projectId)

#### Support

- `POST /support/tickets`
- `GET  /support/tickets` — admin ou cliente (scoped)
- `PUT  /support/tickets/:id`

#### Maturity

- `GET  /maturity/domains` — catálogo
- `POST /maturity/assessments`
- `GET  /maturity/assessments/:id`
- `PUT  /maturity/assessments/:id/scores`

#### Reports

- `GET /reports?projectId=` — metadados
- `POST /reports` — registra intenção (front gera PDF)
- `GET /projects/:id/report-data` — payload completo para renderização

#### AI

- `POST /ai/suggest-finding`
- `POST /ai/suggest-recommendation`
- `POST /ai/project-summary`

#### Notifications

- `GET /notifications`
- `POST /notifications/:id/read`
- `PUT /notifications/preferences`

---

## 27. Telas principais

### 27.1 Mapa de telas por perfil

```mermaid
graph TB
    subgraph "Público"
        T1[Landing]
        T2[Planos]
        T3[Onboarding]
        T4[Login]
        T5[Recuperar senha]
    end

    subgraph "Admin"
        A1[Dashboard global]
        A2[Empresas]
        A3[Assinaturas pendentes]
        A4[Usuários da plataforma]
        A5[Triagem de projetos]
        A6[Avaliação de maturidade]
        A7[Catálogo domínios]
    end

    subgraph "Pentester"
        P1[Meus projetos]
        P2[Detalhe projeto]
        P3[Editor de finding]
        P4[Relatório técnico]
    end

    subgraph "Cliente"
        C1[Dashboard empresa]
        C2[Aplicações]
        C3[Nova análise]
        C4[Projeto acompanhamento]
        C5[Findings liberados]
        C6[Chat]
        C7[Tickets]
        C8[Relatórios]
        C9[Preferências]
    end

    subgraph "Mobile"
        M1[Landing]
        M2[Login]
        M3[Lista projetos]
        M4[Detalhe projeto]
        M5[Detalhe finding]
        M6[Viewer PDF]
        M7[Config push]
    end

    classDef pub fill:#7c2d12,stroke:#fb923c,color:#fff
    classDef adm fill:#581c87,stroke:#c084fc,color:#fff
    classDef pen fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef cli fill:#065f46,stroke:#34d399,color:#fff
    classDef mob fill:#0c4a6e,stroke:#38bdf8,color:#fff
    class T1,T2,T3,T4,T5 pub
    class A1,A2,A3,A4,A5,A6,A7 adm
    class P1,P2,P3,P4 pen
    class C1,C2,C3,C4,C5,C6,C7,C8,C9 cli
    class M1,M2,M3,M4,M5,M6,M7 mob
```

### 27.2 Lista completa

1. Landing page
2. Planos
3. Onboarding (cadastro de empresa + usuário)
4. Login
5. Recuperar senha
6. Dashboard global (admin)
7. Gestão de empresas (admin)
8. Gestão de assinaturas pendentes (admin)
9. Gestão de usuários da plataforma (admin)
10. Gestão de projetos — triagem e atribuição (admin)
11. Avaliação de maturidade (admin)
12. Catálogo de domínios/controles (admin)
13. Meus projetos (pentester)
14. Detalhe do projeto (pentester)
15. Cadastro/edição de finding (pentester) — com assistente IA
16. Geração de relatório técnico (pentester)
17. Dashboard da empresa (cliente)
18. Minhas aplicações (cliente)
19. Contratar nova análise (cliente)
20. Acompanhar projeto (cliente)
21. Findings liberados (cliente)
22. Chat do projeto (cliente)
23. Tickets de suporte (cliente)
24. Download de relatórios (cliente)
25. Configurações de notificações (cliente)
26. Landing + planos (mobile)
27. Login (mobile)
28. Lista de projetos (mobile)
29. Detalhe de projeto (mobile)
30. Detalhe de finding (mobile) — read-only
31. Viewer de relatório (mobile)
32. Configurações de push (mobile)

---

## 28. Dashboard e indicadores

```mermaid
graph TB
    DASH[Dashboards]
    DASH --> A[Admin]
    DASH --> P[Pentester]
    DASH --> C[Cliente]

    A --> A1[Empresas ativas]
    A --> A2[Assinaturas pendentes]
    A --> A3[Projetos em andamento]
    A --> A4[Findings abertos por severidade]
    A --> A5[MTTR]
    A --> A6[MRR simulado]

    P --> P1[Meus projetos]
    P --> P2[Findings da semana]
    P --> P3[Projetos em atraso]

    C --> C1[Projetos ativos]
    C --> C2[Findings por severidade]
    C --> C3[% corrigido]
    C --> C4[Nível de maturidade]
    C --> C5[Radar de domínios]
    C --> C6[Tendência histórica]

    classDef root fill:#581c87,stroke:#c084fc,color:#fff
    classDef role fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef m fill:#065f46,stroke:#34d399,color:#fff
    class DASH root
    class A,P,C role
    class A1,A2,A3,A4,A5,A6,P1,P2,P3,C1,C2,C3,C4,C5,C6 m
```

---

## 29. Relatórios

### 29.1 Princípios de geração

- **Geração 100% client-side** com `pdf-lib`
- Foco em **compatibilidade máxima**: sem dependências complexas, uso de fontes padrão (Helvetica, Times-Roman, Courier) garantindo renderização idêntica em qualquer navegador
- **Visualmente agradável**: grid consistente, hierarquia tipográfica clara, uso controlado de cor, espaçamento generoso
- Sem processamento no servidor → elimina superfície DDoS e problemas de fonte no back

### 29.2 Fluxo de geração

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Front (React)
    participant B as Back-end
    participant DB as MySQL
    participant LIB as pdf-lib/renderer
    participant BR as Navegador

    U->>F: clica "Exportar PDF"
    F->>B: GET /projects/:id/report-data
    B->>DB: busca dados consolidados
    DB-->>B: JSON agregado
    B-->>F: payload completo
    F->>LIB: renderiza ReportDocument<br/>(JSX → PDF)
    LIB-->>F: Blob PDF
    F->>BR: triggers download<br/>(Blob URL)
    BR-->>U: arquivo.pdf
    F->>B: POST /reports (registra evento)
    B->>DB: grava metadado + audit log
```

### 29.3 Executivo (PDF, 3-5 páginas)

- Capa com branding
- Sumário executivo (gerado ou refinado pelo Gemini)
- Gráfico de findings por severidade
- Score de maturidade (radar)
- Top 5 riscos
- Recomendações prioritárias
- Conclusão

### 29.4 Técnico (PDF, 20+ páginas)

- Dados do projeto
- Metodologia aplicada
- Escopo (in / out)
- Lista completa de findings, cada um com:
  - Descrição
  - OWASP Top 10
  - CVSS vector e score
  - Impacto
  - Evidências (thumbnails)
  - Recomendação
  - Status final

### 29.5 Design guidelines

- Paleta: 2 cores primárias + 4 tons de cinza
- Tipografia: fonte base padrão do pdf-lib (Helvetica) — evita problemas de fonte externa
- Cabeçalhos com faixa colorida leve
- Ícones simples via glifos ou SVG inline
- Severidades com badge colorido (crítico = vermelho, alto = laranja, médio = amarelo, baixo = azul)
- Rodapé com numeração de página + data + nome do projeto
- Quebras de página controladas entre seções

---

## 30. MVP e roadmap de desenvolvimento

> Ordem de implementação pensada para: destravar o resto o quanto antes + dividir bem entre os 3 integrantes.

### Fase 0 — Fundação (semanas 1-2)

- Setup do monorepo
- Docker Compose base (api + web + db)
- Schema Prisma inicial (User, Company, Plan, Subscription)
- Auth JWT completo (register, login, refresh, logout)
- CI básico (lint + test)
- SonarQube local
- Documento de arquitetura no `/docs`

### Fase 1 — Core cliente-empresa (semanas 3-5)

- CRUD Company (admin)
- Onboarding público (cadastro empresa + user owner)
- Gestão de planos (seed + visualização)
- Fluxo de Subscription (criar → notificar admin → aprovar)
- CRUD Application (com gate de limite)
- Dashboard inicial por role

### Fase 2 — Projetos e findings (semanas 6-9) — ⭐ núcleo do produto

- CRUD Project com escopo e flag de remediação
- Máquina de estados de Project
- Atribuição de pentesters
- CRUD Vulnerability
- Cálculo CVSS → severidade (com override)
- Categoria OWASP Top 10
- Máquina de estados de Vulnerability
- Upload de evidências
- Comentários em findings
- **Marco: MVP funcional web**

### Fase 3 — Comunicação (semanas 10-11)

- Chat real-time via Socket.IO
- Tickets de suporte
- E-mails transacionais (Mailhog em dev)
- Notificações in-app

### Fase 4 — Mobile (semanas 12-14) — em paralelo com Fase 3 se possível

- Setup Expo
- Telas: landing, login, lista de projetos, detalhe
- Visualização de findings
- Expo Push Notifications
- Integração com back

### Fase 5 — Maturidade e relatórios (semanas 15-17)

- Catálogo de domínios e controles (seed)
- Avaliação de maturidade (admin)
- Radar chart
- Relatório executivo (PDF client-side)
- Relatório técnico (PDF client-side)

### Fase 6 — IA e refinamentos (semanas 18-19)

- Integração Gemini
- Sugestão de finding
- Resumo executivo automático

### Fase 7 — Observabilidade e hardening (semanas 20-22)

- Prometheus + Grafana (dashboards)
- OWASP ZAP em staging
- Hardening de segurança
- Auditoria completa

### Fase 8 — Polimento e entrega (semanas 23-28)

- Testes E2E
- Documentação final
- Slides do TCC
- Ensaio de apresentação
- Buffer de imprevistos (3-4 semanas — **essencial**)

---

## 31. Distribuição de trabalho na equipe

### Matriz simplificada

| Área               | Rafael | Guilherme | Iann |
| ------------------ | :----: | :-------: | :--: |
| Arquitetura        |   🔴   |           |      |
| Auth + segurança   |   🔴   |           |      |
| CRUDs base         |        |    🟡     |  🟢  |
| Findings           |   🔴   |    🟡     |      |
| Upload evidência   |        |    🔴     |      |
| Chat               |        |    🔴     |      |
| Máquina estados    |   🔴   |           |      |
| Mobile             |   🟡   |    🔴     |      |
| Relatórios PDF     |        |    🔴     |  🟡  |
| Maturidade         |   🟡   |    🟡     |      |
| Gemini             |   🔴   |           |      |
| Docker + CI        |   🔴   |           |      |
| Prometheus/Grafana |   🔴   |           |      |
| Documentação       |   🟡   |    🟡     |  🔴  |
| Testes manuais     |        |           |  🔴  |

🔴 owner · 🟡 colaborador · 🟢 sob mentoria

---

## 32. Metodologia

### 32.1 Framework

- **Scrum adaptado** com sprints de 2 semanas
- **Kanban visual** no GitHub Projects
- Cerimônias leves: planning (início sprint), dailies (async no grupo), review (fim sprint), retro (fim sprint)

### 32.2 Fluxo de branching

```mermaid
gitGraph
    commit id: "init"
    branch develop
    checkout develop
    commit id: "setup"
    branch feature/auth
    commit id: "login"
    commit id: "jwt"
    checkout develop
    merge feature/auth
    branch feature/company
    commit id: "crud-company"
    checkout develop
    merge feature/company
    branch fix/bug-login
    commit id: "hotfix"
    checkout develop
    merge fix/bug-login
    checkout main
    merge develop tag: "v1.0-mvp"
```

### 32.3 Convenções

- `main` — protegida, só via PR
- `develop` — branch de integração
- `feature/<nome>` — tarefas
- `fix/<nome>` — correções
- Convenção de commits: **Conventional Commits** (`feat:`, `fix:`, `docs:`)

### 32.4 Code review

- Toda PR revisada por Rafael
- Checklist mínimo: lint passa, testes passam, SonarQube aprova

---

## 33. Testes

### 33.1 Filosofia

Pragmática para TCC: **testar o que, se quebrar, causa estrago real**. Não perseguir cobertura alta por vaidade — perseguir **confiança em regressão**.

Dois tipos que importam:

1. **Testes de integração dos fluxos principais** — "quando eu crio um finding, ele aparece na listagem com a severidade certa"
2. **Testes canário de regras críticas** — casos específicos que protegem os pontos mais perigosos do sistema

### 33.2 Testes canário — obrigatórios e intocáveis

Esses testes existem porque suas duas maiores dores são **auth quebrando login** e **guards vazando dados entre empresas**. Cada um desses testes é um **alarme**. Se algum falhar, significa que alguém introduziu uma regressão grave.

> **Regra:** todos abaixo rodam em **toda PR**. Modificar/remover um desses testes exige comentário explícito na PR com justificativa. São marcados com `@canary` no nome do teste.

```mermaid
graph TB
    PR[Qualquer PR] --> CI[CI roda testes]
    CI --> AUTH[🔒 Canários de Auth]
    CI --> TEN[🏢 Canários Multi-tenant]
    CI --> STATE[🔄 Canários Máquina de Estados]
    CI --> BIZ[📋 Integração Fluxos Principais]

    AUTH --> A1[Login com senha certa]
    AUTH --> A2[Login com senha errada]
    AUTH --> A3[Token expirado rejeita]
    AUTH --> A4[Refresh gera novo access]
    AUTH --> A5[Logout invalida refresh]
    AUTH --> A6[Rota protegida sem token retorna 401]

    TEN --> T1[Cliente A não vê projeto de B]
    TEN --> T2[Cliente A não edita finding de B]
    TEN --> T3[Pentester não atribuído retorna 403]
    TEN --> T4[Upload em projeto alheio falha]

    STATE --> S1[Transição inválida rejeita]
    STATE --> S2[Sem remediação: analista não marca FIXED]
    STATE --> S3[CVSS score calcula severidade correta]

    classDef crit fill:#7f1d1d,stroke:#f87171,color:#fff
    classDef tenant fill:#4c1d95,stroke:#a78bfa,color:#fff
    classDef state fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef biz fill:#065f46,stroke:#34d399,color:#fff
    class AUTH,A1,A2,A3,A4,A5,A6 crit
    class TEN,T1,T2,T3,T4 tenant
    class STATE,S1,S2,S3 state
    class BIZ biz
```

#### Canários de Autenticação (RF01, RNF13, RNF14)

| ID      | Cenário                                      | Critério de sucesso                                                     |
| ------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| AUTH-01 | Login com credenciais válidas                | Retorna 200 + accessToken + refreshToken                                |
| AUTH-02 | Login com senha errada                       | Retorna 401, não loga senha no log                                      |
| AUTH-03 | Login com e-mail inexistente                 | Retorna 401 (mesma resposta de senha errada — previne user enumeration) |
| AUTH-04 | Request com token expirado                   | Retorna 401 com mensagem clara                                          |
| AUTH-05 | Request com token assinado com secret errado | Retorna 401                                                             |
| AUTH-06 | Refresh com token válido                     | Retorna novo access token                                               |
| AUTH-07 | Refresh após logout                          | Retorna 401 (token invalidado)                                          |
| AUTH-08 | Rota protegida sem header Authorization      | Retorna 401                                                             |
| AUTH-09 | Senha armazenada é hash bcrypt               | Query direta no DB, verifica formato `$2[aby]$`                         |

#### Canários Multi-tenant (RN16, RN17) — os mais importantes

Esses protegem a dor que você mais teme: **vazamento de dados entre empresas**.

| ID     | Cenário                                                         | Critério de sucesso                                |
| ------ | --------------------------------------------------------------- | -------------------------------------------------- |
| TEN-01 | Cliente da Company A faz GET em projeto da Company B            | Retorna 404 (não 403 — evita confirmar existência) |
| TEN-02 | Cliente da Company A lista projetos                             | Response não contém nenhum projeto da Company B    |
| TEN-03 | Cliente da Company A tenta editar Application da Company B      | Retorna 404                                        |
| TEN-04 | Cliente da Company A tenta fazer upload em finding da Company B | Retorna 404                                        |
| TEN-05 | Pentester não atribuído ao Project X acessa findings de X       | Retorna 403                                        |
| TEN-06 | Cliente tenta GET /api/v1/companies (listar todas)              | Retorna 403 (rota admin-only)                      |
| TEN-07 | Cliente Member tenta convidar novo usuário                      | Retorna 403 (só Owner pode)                        |
| TEN-08 | Dashboard agregado do cliente só soma dados da própria Company  | Query assertion no resultado                       |

#### Canários de Regras de Negócio

| ID     | Cenário                                                 | Critério de sucesso                     |
| ------ | ------------------------------------------------------- | --------------------------------------- |
| BIZ-01 | Cadastrar aplicação excedendo limite do plano Basic (2) | Retorna 422                             |
| BIZ-02 | Criar projeto com Company sem subscription ativa        | Retorna 422                             |
| BIZ-03 | CVSS score 9.5 → severidade calculada = CRITICAL        | Assertion no objeto                     |
| BIZ-04 | CVSS score 5.0 → severidade calculada = MEDIUM          | Assertion                               |
| BIZ-05 | Override de severidade sem justificativa                | Retorna 422                             |
| BIZ-06 | Projeto sem remediação: analista tenta marcar FIXED     | Retorna 403                             |
| BIZ-07 | Projeto com remediação: analista marca FIXED            | Retorna 200                             |
| BIZ-08 | Transição inválida (ex: OPEN → CLOSED direto)           | Retorna 422                             |
| BIZ-09 | Upload de arquivo `.exe`                                | Retorna 422 (MIME rejeitado)            |
| BIZ-10 | Gerar relatório de projeto em status REQUESTED          | Retorna 422 (precisa estar ≥ IN_REVIEW) |

### 33.3 Testes de integração — fluxos principais

Um teste end-to-end por fluxo, sem mock do banco (usa MySQL de teste, subido automaticamente no CI).

| Fluxo                     | O que cobre                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **F1 — Onboarding**       | Register Company → Subscription PENDING → Admin aprova → Login do Owner funciona                                    |
| **F2 — Criar análise**    | Cliente loga → Cria Application → Cria Project → Admin atribui Pentester → Pentester vê projeto na lista            |
| **F3 — Ciclo de finding** | Pentester cria Vulnerability → anexa Evidence → Cliente comenta → Pentester transiciona → relatório pode ser gerado |
| **F4 — Permissões cross** | Executa como 3 usuários diferentes (admin, pentester, cliente) e verifica matriz de permissões do §13.2             |

### 33.4 Ferramentas

- **Jest** — unitários e integração
- **Supertest** — chamadas HTTP contra o app Express
- **@prisma/client** + banco de teste — assertions diretas quando necessário
- **Testcontainers** (opcional) — caso queira isolar ainda mais

### 33.5 Estrutura de testes

```text
apps/api/
├── src/
│   └── modules/
│       └── vulnerabilities/
│           ├── cvss.service.ts
│           └── cvss.service.spec.ts        # unitário colocalizado
└── test/
    ├── canary/                             # 🚨 intocáveis
    │   ├── auth.canary.spec.ts
    │   ├── multi-tenant.canary.spec.ts
    │   └── business-rules.canary.spec.ts
    ├── integration/
    │   ├── onboarding.flow.spec.ts
    │   ├── create-analysis.flow.spec.ts
    │   ├── finding-lifecycle.flow.spec.ts
    │   └── permissions-matrix.flow.spec.ts
    ├── helpers/
    │   ├── test-db.ts                      # reset do banco entre testes
    │   ├── fixtures.ts                     # dados comuns
    │   └── http-client.ts                  # supertest wrapper com auth
    └── jest-e2e.json
```

### 33.6 Scripts npm

```json
{
  "scripts": {
    "test": "jest",
    "test:canary": "jest --testPathPattern='.canary.spec'",
    "test:integration": "jest --testPathPattern='.flow.spec'",
    "test:watch": "jest --watch"
  }
}
```

### 33.7 O que **não** vamos testar (decisão consciente)

- **Componentes de UI individuais** (Button, Card, etc.) — retorno baixo, manutenção alta
- **Getters/setters triviais**
- **Mock de libs externas** (Gemini, Expo Push) — testamos só a nossa camada de abstração
- **Cobertura de 100%** — gate de cobertura fica em **60% de linhas** (no SonarQube, apenas informativo)

### 33.8 Regressão garantida

```mermaid
flowchart LR
    DEV[Dev termina feature] --> PR[Abre PR para main]
    PR --> CI[CI roda]
    CI --> C1{Canários passam?}
    C1 -- não --> BLOCK[(PR bloqueada<br/>nome do canário<br/>aparece na review)]
    C1 -- sim --> C2{Integração passa?}
    C2 -- não --> BLOCK
    C2 -- sim --> REV[Review humana]
    REV --> MERGE[(Merge em main)]

    classDef ok fill:#065f46,stroke:#34d399,color:#fff
    classDef err fill:#7f1d1d,stroke:#f87171,color:#fff
    class MERGE ok
    class BLOCK err
```

**Se um canário falhar, o mecanismo garante:**

- PR não pode ser mergeada em `main`
- Mensagem clara de qual regra foi violada
- Dev vê rapidamente onde quebrou
- Os outros dois integrantes ficam protegidos do estrago

### 33.9 Testes mobile e web (fora do escopo crítico)

- **Web**: opcionalmente Vitest + React Testing Library pra componentes complexos (ex: editor de finding)
- **Mobile**: confiamos em testes manuais + TestFlight-like no Expo Go — **não há suíte automatizada**
- Justificativa: escopo mobile é read-mostly, baixo risco de regressão crítica

---

## 34. Riscos

| #   | Risco                                                                  | Probabilidade | Impacto | Mitigação                                                                |
| --- | ---------------------------------------------------------------------- | :-----------: | :-----: | ------------------------------------------------------------------------ |
| R1  | Iann abandonar o curso                                                 |     Alta      |  Médio  | Nenhuma task dele no caminho crítico; documentar tudo                    |
| R2  | Escopo inflar                                                          |     Alta      |  Alto   | MVP enxuto + roadmap priorizado; decisão documentada de "fora do escopo" |
| R3  | Gemini exceder cotas gratuitas                                         |     Média     |  Baixo  | Rate limit rigoroso; fallback silencioso se quota estourar               |
| R4  | Complexidade de Socket.IO + mobile                                     |     Média     |  Médio  | Deixar chat mobile como "só notificação" inicialmente                    |
| R5  | PDF client-side pesado travar navegador                                |     Baixa     |  Médio  | Paginação no relatório técnico; evidências como thumbnails               |
| R6  | Rafael sobrecarregado                                                  |     Alta      |  Alto   | Delegar tarefas médias para Guilherme; bloquear 2h/dia para code review  |
| R7  | Integração entre web, mobile e back dessincronizar                     |     Média     |  Alto   | Package de types compartilhado (`packages/types`)                        |
| R8  | Apresentação sem tempo de ensaio                                       |     Média     |  Alto   | Buffer de 3-4 semanas no cronograma                                      |
| R9  | Demo sem dados realistas                                               |     Baixa     |  Médio  | Criar seed com 2 empresas fictícias, 10 findings representativos         |
| R10 | SonarQube/ZAP acusando vulnerabilidades não corrigidas na apresentação |     Média     |  Alto   | Tratar achados logo, não acumular                                        |

---

## 35. Diferenciais e posicionamento

### O que torna o Vulnera um TCC forte

1. **Não é CRUD** — tem máquina de estados, integrações externas, real-time, IA e mobile
2. **TypeScript end-to-end** — mostra maturidade técnica
3. **Três aplicações integradas** — web admin, web cliente e mobile
4. **DevSecOps aplicado ao próprio produto** — meta-prova-de-conceito
5. **Integração real com IA** — tema atual e valorizado
6. **Baseado em padrões de mercado** — CVSS v3.1, OWASP Top 10
7. **Problema claro e verificável** — solução testável com colegas do curso como cobaias
8. **Observabilidade** — Prometheus + Grafana pouquíssimas equipes fazem
9. **Trilha de auditoria** — raro em TCC, comum em produto real
10. **Arquitetura com camadas claras** — mostra conhecimento de engenharia de software

### Frase de elevador (pitch para banca)

> O **Vulnera** é uma plataforma SaaS que simula a operação de uma consultoria de segurança da informação, composta por back-end Express, front-end React + Vite e app mobile React Native, toda em TypeScript. Permite que empresas contratem análises de segurança, acompanhem findings em tempo real com máquina de estados baseada em CVSS e OWASP, e recebam relatórios gerados com apoio de IA. A própria infraestrutura demonstra práticas DevSecOps: containers rootless, CI/CD com SonarQube e OWASP ZAP, e observabilidade via Prometheus/Grafana.

---

## 36. Roadmap visual consolidado

Cronograma de 28 semanas com responsáveis por entrega.
Legenda: **R** = Rafael · **G** = Guilherme · **I** = Iann

### 36.1 Linha do tempo Gantt

```mermaid
gantt
    title Vulnera — Roadmap de 28 semanas
    dateFormat  YYYY-MM-DD
    axisFormat  S%W

    section Fase 0 - Fundação
    Setup monorepo e Docker (R)         :f0a, 2026-01-05, 7d
    Schema Prisma base (R)              :f0b, after f0a, 4d
    Auth JWT completo (R)               :f0c, after f0b, 7d
    CI básico lint + test (R)           :f0d, after f0a, 5d
    SonarQube local (R)                 :f0e, after f0d, 3d
    README e docs iniciais (I)          :f0f, 2026-01-05, 14d

    section Fase 1 - Core empresa
    CRUD Company (I com mentoria R)     :f1a, 2026-01-19, 7d
    Onboarding público web (G)          :f1b, after f1a, 7d
    Seed de Plans (I)                   :f1c, 2026-01-19, 3d
    Subscription fluxo aprovação (R)    :f1d, after f1b, 7d
    CRUD Application com gate (G)       :f1e, after f1d, 7d
    Dashboard inicial (G)               :f1f, after f1e, 5d

    section Fase 2 - Projetos e findings
    CRUD Project + escopo (G)           :f2a, 2026-02-09, 7d
    Máquina estados Project (R)         :f2b, after f2a, 5d
    Atribuição pentesters (R)           :f2c, after f2b, 3d
    CRUD Vulnerability (G)              :f2d, after f2a, 10d
    CVSS calc + override (R)            :f2e, after f2d, 5d
    Máquina estados Vuln (R)            :f2f, after f2e, 5d
    Upload evidências (G)               :f2g, after f2d, 7d
    Comentários em findings (G)         :f2h, after f2g, 5d

    section Fase 3 - Comunicação
    Chat Socket.IO (G)                  :f3a, 2026-03-09, 10d
    Tickets suporte (I)                 :f3b, 2026-03-09, 7d
    E-mails Mailhog (R)                 :f3c, after f3a, 5d
    Notificações in-app (R)             :f3d, after f3c, 5d

    section Fase 4 - Mobile
    Setup Expo (R + G)                  :f4a, 2026-03-23, 3d
    Login e lista projetos (G)          :f4b, after f4a, 7d
    Detalhe finding read-only (G)       :f4c, after f4b, 5d
    Expo Push integração (R)            :f4d, after f4c, 5d
    Config push por categoria (G)       :f4e, after f4d, 3d

    section Fase 5 - Maturidade e PDF
    Seed domínios e controles (I)       :f5a, 2026-04-13, 5d
    Tela avaliação maturidade (G)       :f5b, after f5a, 7d
    Radar chart Recharts (G)            :f5c, after f5b, 3d
    Relatório executivo PDF (G)         :f5d, after f5c, 7d
    Relatório técnico PDF (G + I)       :f5e, after f5d, 7d

    section Fase 6 - IA
    Módulo AI Express (R)                :f6a, 2026-05-04, 5d
    Rate limit + prompts (R)            :f6b, after f6a, 5d
    UI de sugestão no finding (G)       :f6c, after f6b, 4d

    section Fase 7 - Observabilidade
    Prometheus exporters (R)            :f7a, 2026-05-18, 5d
    Dashboards Grafana (R)              :f7b, after f7a, 5d
    OWASP ZAP pipeline (R)              :f7c, after f7b, 5d
    Hardening + auditoria (R)           :f7d, after f7c, 5d

    section Fase 8 - Entrega
    Testes E2E Playwright (G)           :f8a, 2026-06-08, 10d
    Doc final + slides (I)              :f8b, 2026-06-08, 14d
    Seed dados de demo (I)              :f8c, 2026-06-15, 5d
    Ensaio apresentação (R G I)         :f8d, 2026-07-06, 7d
    Buffer imprevistos                   :f8e, 2026-06-22, 21d
```

### 36.2 Responsáveis por feature (linha única)

```mermaid
graph LR
    subgraph "Fundação"
        F0R["Auth + CI + Docker<br/><b>R</b>"]
        F0I["Documentação inicial<br/><b>I</b>"]
    end

    subgraph "Core empresa"
        F1I["CRUD Company<br/>mentoria <b>R</b> para <b>I</b>"]
        F1G["Onboarding + App + Dashboard<br/><b>G</b>"]
        F1R["Subscription<br/><b>R</b>"]
    end

    subgraph "Projetos e findings"
        F2G["CRUDs + Upload + Comentários<br/><b>G</b>"]
        F2R["Máquinas de estado + CVSS<br/><b>R</b>"]
    end

    subgraph "Comunicação"
        F3G["Chat Socket.IO<br/><b>G</b>"]
        F3I["Tickets<br/><b>I</b>"]
        F3R["E-mails + Notif in-app<br/><b>R</b>"]
    end

    subgraph "Mobile"
        F4G["Telas e Push UI<br/><b>G</b>"]
        F4R["Expo setup + integração push<br/><b>R</b>"]
    end

    subgraph "Maturidade e PDF"
        F5I["Seed + Doc técnica PDF<br/><b>I</b>"]
        F5G["Tela + Radar + PDFs<br/><b>G</b>"]
    end

    subgraph "IA"
        F6R["Back-end Gemini<br/><b>R</b>"]
        F6G["UI sugestão<br/><b>G</b>"]
    end

    subgraph "DevSecOps"
        F7R["Prometheus Grafana ZAP<br/><b>R</b>"]
    end

    subgraph "Entrega"
        F8G["E2E<br/><b>G</b>"]
        F8I["Doc final + Seed demo<br/><b>I</b>"]
        F8ALL["Ensaio + apresentação<br/><b>R + G + I</b>"]
    end

    F0R --> F1R --> F2R --> F3R --> F4R --> F6R --> F7R
    F0I --> F1I --> F3I --> F5I --> F8I
    F1G --> F2G --> F3G --> F4G --> F5G --> F6G --> F8G
    F7R --> F8ALL
    F8G --> F8ALL
    F8I --> F8ALL

    classDef r fill:#7f1d1d,stroke:#f87171,color:#fff
    classDef g fill:#1e40af,stroke:#60a5fa,color:#fff
    classDef i fill:#065f46,stroke:#34d399,color:#fff
    classDef all fill:#581c87,stroke:#c084fc,color:#fff
    class F0R,F1R,F2R,F3R,F4R,F6R,F7R r
    class F1G,F2G,F3G,F4G,F5G,F6G,F8G g
    class F0I,F1I,F3I,F5I,F8I i
    class F8ALL all
```

### 36.3 Marcos do projeto (milestones)

```mermaid
timeline
    title Marcos principais do Vulnera
    Semana 2  : M1 - Fundação pronta
              : Auth + CI + Docker funcionando
    Semana 5  : M2 - Core empresa
              : Onboarding funcional de ponta a ponta
    Semana 9  : M3 - MVP web ⭐
              : Fluxo completo de finding com máquina de estados
    Semana 11 : M4 - Comunicação viva
              : Chat + notificações + tickets
    Semana 14 : M5 - Mobile no ar
              : App Expo funcional com push
    Semana 17 : M6 - Relatórios e maturidade
              : PDFs exportáveis + radar
    Semana 19 : M7 - IA integrada
              : Gemini sugerindo findings
    Semana 22 : M8 - Plataforma observável
              : Grafana + ZAP + hardening
    Semana 25 : M9 - Pronto para apresentar
              : E2E passando + doc final
    Semana 28 : M10 - Entrega TCC 🎓
              : Apresentação para banca
```

### 36.4 Features do produto final — resumo por responsável

#### Lideradas por Rafael (🔴 owner)

- Arquitetura Express em camadas
- Autenticação JWT (access + refresh)
- Guards de role e ownership
- Máquinas de estado (Project, Vulnerability, Subscription, Ticket)
- Cálculo CVSS → severidade com override
- Integração Gemini (prompts, rate limit, governança)
- Docker rootless + docker-compose
- CI/CD GitHub Actions (lint, test, build, SAST, ZAP)
- SonarQube + Quality Gate
- Prometheus + Grafana (dashboards)
- Auditoria (AuditLog genérico)
- E-mails transacionais
- Notificações in-app (back)
- Expo Push (back-end)
- Hardening de segurança geral

#### Lideradas por Guilherme (🔴 owner)

- Onboarding público
- CRUD Application (front)
- CRUD Project (front)
- CRUD Vulnerability (front, editor rico)
- Dashboard por role
- Upload de evidências (back + front)
- Comentários em findings
- Chat real-time (Socket.IO gateway no back + client no front)
- Tela de avaliação de maturidade com radar
- Relatórios em PDF client-side (executivo e técnico)
- Mobile Expo (telas, navegação, push UI)
- Testes E2E Playwright

#### Lideradas por Iann (🔴 owner) — sempre sob mentoria

- CRUD Company (com pair com Rafael)
- Seed de Plans
- Seed de MaturityDomain e MaturityControl
- Tickets de suporte (CRUD básico)
- READMEs de cada módulo
- Documentação de arquitetura
- Testes manuais
- Seed de dados para demo (empresas fictícias + findings representativos)
- Ajustes de UI (espaçamento, cor, responsividade)

---

## Apêndice A — Glossário rápido

- **SAST** — Static Application Security Testing
- **DAST** — Dynamic Application Security Testing
- **CVSS** — Common Vulnerability Scoring System
- **OWASP Top 10** — ranking das vulnerabilidades mais comuns em aplicações web
- **MFA** — Multi-Factor Authentication
- **MVP** — Minimum Viable Product
- **CI/CD** — Continuous Integration / Continuous Delivery
- **DevSecOps** — integração de segurança no ciclo de DevOps
- **MTTR** — Mean Time To Resolve (tempo médio para resolução)
- **MRR** — Monthly Recurring Revenue (receita recorrente mensal — simulada)

---

## Apêndice B — Tabela de CVSS → Severidade

| CVSS Score | Severidade |
| ---------- | :--------: |
| 0.0        |    NONE    |
| 0.1 – 3.9  |    LOW     |
| 4.0 – 6.9  |   MEDIUM   |
| 7.0 – 8.9  |    HIGH    |
| 9.0 – 10.0 |  CRITICAL  |

---

_Documento vivo. Versão 3 — enriquecida com diagramas Mermaid em todas as seções e roadmap visual consolidado._
