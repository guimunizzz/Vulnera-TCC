---
type: funcionalidade
tags: [feature]
status: ativo
---

# Dashboard

## Objetivo
Exibir indicadores e visão geral da operação, diferenciados por perfil de usuário.

## Usuários envolvidos
- **Admin**: visão global da consultoria
- **Pentester**: visão dos projetos atribuídos
- **Cliente**: visão dos próprios projetos e maturidade

## Visão por perfil

### Dashboard Admin
- total de projetos ativos por status (kanban ou contagem)
- novas assinaturas pendentes de aprovação
- findings abertos por severidade (crítico, alto, médio, baixo)
- projetos com SLA próximo do vencimento
- tickets de suporte abertos
- resumo de maturidade médio das empresas ativas
- tendência de criação de findings (semana/mês)

### Dashboard Pentester
- projetos atribuídos e seus status
- total de findings abertos nos projetos ativos
- distribuição de severidade dos findings nos projetos atribuídos
- projetos com revalidação pendente

### Dashboard Cliente
- projetos da empresa por status
- findings por severidade (dos próprios projetos)
- score de maturidade atual + tendência histórica
- número de findings em REVALIDATION ou FIXED aguardando fechamento
- download de relatórios disponíveis

## Indicadores técnicos (para Admin — observabilidade)
Integração com Prometheus/Grafana (Fase 7 do roadmap) expõe:
- `active_projects` — gauge de projetos em andamento
- `vulnerability_created_total{severity}` — criação por severidade
- latência e erros de requisição

## Dependências técnicas
- dados agregados via queries no back-end (não há tabela de cache de dashboard no MVP)
- `GET /dashboard` ou queries específicas por recurso com parâmetros de contagem
- front-end usa Recharts para gráficos (incluindo radar de maturidade no dashboard do cliente)

## Relacionado
[[Project]]
[[Vulnerability]]
[[MaturityAssessment]]
[[Subscription]]
[[SupportTicket]]
[[Observabilidade]]
[[Web Admin]]
[[Web Cliente]]

---

> [!info] Reescrito na Fase 6.5 (2026-08-09)
> O que existia antes eram três dashboards por PAPEL, com toda a agregação feita
> no cliente e sem nenhuma série temporal. Continuam existindo (são a tela
> `/dashboard`), mas o módulo analítico de verdade é o painel POR APLICAÇÃO
> descrito abaixo.

## Painel analítico por aplicação

Rota: `/applications/:id/dashboard`.
Backend: [[ADR-025 - Metricas analiticas derivadas do AuditLog]].

**Quatro visões, padronizadas.** Toda aplicação tem exatamente as mesmas abas,
com os mesmos gráficos nas mesmas posições — é o que permite comparar duas
aplicações de relance. Um painel que se adapta ao conteúdo obrigaria a
reaprender o layout a cada troca.

### 1. Postura atual

- **Quatro KPIs** com variação versus o período anterior e micro-sparkline:
  findings em aberto, risk score, taxa de remediação, críticos em aberto.
  Cada um declara se *subir é bom* — "taxa de remediação subiu 12%" é positivo,
  "risk score subiu 12%" é péssimo, e pintar toda subida de verde faria o painel
  mentir na métrica que mais importa.
- **Donut de severidade**, clicável (filtra o painel inteiro).
- **Gráfico de aging** — barras por faixa de idade (<7d, 7–30d, 30–90d, >90d),
  com a cor subindo junto com a idade. É a métrica de *dívida de segurança* e o
  gráfico mais impactante do conjunto. Clicável.
- **MTTR por severidade**, em mediana, sempre com o número de amostras.

### 2. Evolução

- **Burndown**: findings abertos acumulados no tempo. É a única linha do conjunto
  que responde "a postura está melhorando ou piorando?".
- **Criados × resolvidos**: barras divergentes em torno do zero — criados para
  cima, resolvidos para baixo.
- **Risk score no tempo**, com faixa de referência na média do período.
  ⚠️ Aproximado — ver ADR-025 §6 e a limitação L-11.

### 3. Insights

Lista priorizada (crítico → atenção → neutro → positivo) de frases derivadas de
**regra determinística**, não de IA ([[Adr 017 ia cortada do escopo do mvp]]
continua valendo). Cada insight com filtro é clicável e aplica aquele recorte às
outras abas.

Exemplos gerados: "5 findings críticos abertos há mais de 30 dias" · "Categoria
OWASP mais frequente: A01 Broken Access Control, 40% dos findings" · "Taxa de
reabertura de 4%" · "Nenhum finding crítico em aberto".

### 4. Comparativo

Todas as aplicações da empresa lado a lado — risk score, críticos abertos, taxa
de remediação, MTTR — em tabela ordenável, com a aplicação atual destacada.

## Filtros

Todo filtro vive **na query string**, sem `useState` espelhando. Consequência:
link compartilhável, voltar/avançar do navegador funciona, recarregar preserva o
contexto.

- Período por preset (7d/30d/90d/1 ano/tudo) + intervalo personalizado.
- Severidade, status e OWASP em multi-seleção **com contagem por opção**,
  refletindo os outros filtros já aplicados.
- Busca textual com debounce de 300ms.
- Interruptor "comparar com período anterior", que liga os deltas.
- **Filtragem cruzada**: clicar numa fatia do donut ou numa barra do aging aplica
  aquele recorte ao painel inteiro.
- **Chips do que está ativo**, removíveis um a um, mais "limpar tudo".
- O filtro é lembrado por aplicação em `localStorage`, mas **a URL sempre vence** —
  senão, abrir um link compartilhado mostraria o filtro de quem clicou.

## Regras de desenho

- Todo gráfico tem **estado vazio desenhado**, nunca área em branco.
- O **esqueleto tem a forma do gráfico final** — sem salto de layout na troca.
- Tooltip sempre com valor **absoluto e relativo**: "18 findings" não responde
  "isso é muito?"; "18 findings (44%)" responde.
- Nenhum gráfico sem legenda ou eixo rotulado.
- Em tela estreita o gráfico vira **lista**, nunca encolhe até ficar ilegível.
