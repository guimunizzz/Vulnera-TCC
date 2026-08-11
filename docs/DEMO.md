# DEMO.md — Roteiro de demonstração da Vulnera

> Roteiro cronometrado pros 3 perfis (ADMIN / CLIENT / PENTESTER), pensado
> pra caber em **~10 minutos**. Duas trilhas combinadas de propósito:
>
> - **Trilha ao vivo** (passos 1-7): cria uma empresa nova do zero, prova que
>   o pipeline inteiro funciona de verdade — não é só fixture de seed.
> - **Trilha "estado maduro"** (passos 8-10): troca pra conta da **TechNova
>   Solutions** (empresa do seed, `npm run db:seed` — 5 aplicações, 10
>   findings, avaliação de maturidade completa) porque uma empresa criada na
>   hora não tem histórico suficiente pra um relatório/radar/dashboard
>   interessante de mostrar.
>
> Pré-requisito: `docker compose up --build` rodando (banco + API + web —
> ver README raiz) **e** o seed executado (`npm run db:seed` dentro de
> `app/api`, ou `docker compose exec api npm run db:seed`).

---

## Antes de começar (fora da contagem dos 10 min)

- Navegador aberto em **http://localhost:3000**
- Celular com o Expo Go instalado e o app mobile rodando (`npx expo start`
  em `app/mobile`, `.env` apontando pro IP da rede local) — só necessário
  pro passo 5 (push notification)
- Anotar as credenciais de demo (todas com `npm run db:seed`):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| ADMIN | `admin@vulnera.local` | `admin12345` |
| CLIENT (owner, TechNova) | `owner@technova.demo` | `demo12345` |
| CLIENT (membro, TechNova) | `fernanda@technova.demo` | `demo12345` |
| PENTESTER | `bruno.pentester@vulnera.local` ou `camila.pentester@vulnera.local` | `senha12345` |

---

## Trilha ao vivo — empresa nova do zero

### 1. Landing + Planos — ~1 min

1. Abra `http://localhost:3000` — sem sessão, redireciona pro login.
2. Clique em **Planos** (ou vá direto em `/plans`) — página pública, 3 cards
   (Básico/Pro/Enterprise), sem precisar estar logado.
3. Narrativa: "aqui é onde qualquer empresa nova entra — vê os planos antes
   de criar conta".

### 2. Registro + Onboarding — ~1,5 min

1. **Registrar** (`/register`) com um e-mail qualquer (ex.:
   `demo-banca@exemplo.com`) — vira CLIENT por padrão.
2. Login automático redireciona pro **wizard de onboarding** (3 passos):
   dados da empresa (nome + CNPJ) → escolha do plano → confirmação.
3. Ao concluir, a empresa fica com uma `Subscription` em
   `PENDING_APPROVAL` — o dashboard do CLIENT mostra isso claramente.
4. Narrativa: "a empresa existe, mas não pode usar a plataforma até o
   admin aprovar — é o gate comercial".

### 3. Aprovação do Admin — ~1 min

1. Logout, login como **ADMIN** (`admin@vulnera.local`).
2. Dashboard do ADMIN mostra o alerta **"N assinatura(s) aguardando
   aprovação"** com link direto.
3. Ir em `/admin/subscriptions`, achar a empresa recém-criada, **Aprovar**.
4. Narrativa: "a partir daqui a empresa vira `ACTIVE` e pode criar
   aplicações — a regra de ouro é 1 assinatura ativa por empresa,
   revalidada tanto na criação quanto aqui na aprovação".

### 4. Aplicação + Projeto — ~1,5 min

1. Logout, login de novo com a conta CLIENT recém-criada.
2. **Aplicações** → **Nova aplicação** (nome + URL + ambiente).
3. **Nova análise** (wizard de 4 passos) → cria o `Project` vinculado
   (1 projeto por aplicação, RN05).
4. Narrativa: "toda aplicação tem no máximo um projeto de análise ativo por
   vez — o limite de quantas aplicações a empresa pode ter vem do plano".

### 5. Pentester registra um finding CRITICAL (push no celular) — ~1,5 min

1. Logout, login como **ADMIN** de novo → dentro do projeto recém-criado,
   aba **Visão geral** → atribuir um pentester (`Camila Pentester`, por
   exemplo) no card "Pentesters atribuídos".
2. Logout, login como **pentester** atribuído.
3. No projeto, aba **Findings** → **Novo finding**. Preencher:
   - Vetor CVSS que dê **CRITICAL** (ex.:
     `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` — score 9.8)
   - Categoria OWASP, descrição, impacto, recomendação
4. Salvar — **o celular com o Expo Go deve receber uma notificação push**
   na hora (`VulnerabilityService.create` dispara pro CLIENT da empresa
   quando a severidade final é CRITICAL).
5. Narrativa: "a severidade não é escolhida à mão — é calculada em tempo
   real pela fórmula oficial do CVSS 3.1 a partir do vetor. O admin pode
   fazer override manual, mas precisa de justificativa de 20+ caracteres,
   e fica tudo auditado".

### 6. Evidência — ~0,5 min

1. No finding recém-criado, aba de evidências → anexar um print/PDF
   qualquer (até 10MB; tipo validado pelo **conteúdo real do arquivo**,
   não pela extensão — um `.exe` renomeado pra `.png` é rejeitado).
2. Narrativa: "cada evidência fica isolada por empresa e projeto no disco
   (`uploads/{companyId}/{vulnerabilityId}/`), servida só por download
   autenticado".

### 7. Transição de status — ~0,5 min

1. No mesmo finding, mudar o status: `OPEN` → `IN_PROGRESS`.
2. Levar o projeto pra `IN_REVIEW` (aba Visão geral → "Concluir
   [análise]") — é o gate mínimo pra liberar relatório (RN18).

---

## Trilha "estado maduro" — TechNova (seed)

> A partir daqui, **logout e login na conta ADMIN ou CLIENT da TechNova**
> (`owner@technova.demo` / `demo12345`) — é a empresa com histórico rico do
> `prisma/seed.ts`: 5 aplicações, 5 projetos (status variados de propósito
> — 3 em revisão, 1 em andamento, 1 concluído), 10 findings (2 críticos, 3
> altos, 3 médios, 2 baixos), evidências e comentários reais, 2 pentesters,
> e uma avaliação de maturidade já respondida.

### 8. Relatórios PDF — ~1 min

1. Entrar num projeto **em revisão ou concluído** (ex.: "Pentest Web —
   Portal do Cliente"), aba **Relatórios**.
2. Gerar o **Executivo** — capa, sumário, KPIs, gráfico de severidade, top
   5 riscos, **seção de maturidade** (tabela de médias por domínio + radar
   desenhado à mão) e conclusão.
3. Gerar o **Técnico** — 1 seção por finding, evidências embutidas,
   comentários, glossário.
4. Narrativa: "o PDF inteiro é montado no navegador do cliente — o servidor
   nunca vê o arquivo, só serve o JSON consolidado (ADR-003)".

### 9. Maturidade — ~1 min

1. No dashboard do ADMIN, achar a TechNova na lista de "top empresas" e
   clicar em **Maturidade** (ou, logado como CLIENT, botão "Ver avaliação
   de maturidade" no próprio dashboard).
2. Mostrar os 7 domínios na lateral com a média de cada um, o radar de 7
   eixos e a média geral (2.89 — nível **Intermediário**).
3. Trocar de domínio, mudar uma resposta ao vivo (só ADMIN edita), salvar
   em lote — a média recalcula na hora.
4. Narrativa: "é um checklist simplificado de propósito — perguntas
   objetivas, escala 1-5, média simples. Não é uma auditoria SAMM completa,
   é uma primeira leitura rápida do ambiente do cliente".

### 10. Dashboards — ~1 min

1. **ADMIN**: empresas ativas, assinaturas pendentes, críticos em aberto
   globais, top empresas por volume.
2. **CLIENT**: KPIs da própria empresa, distribuição por severidade
   (donut), findings recentes.
3. **PENTESTER**: projetos atribuídos, findings registrados na semana,
   críticos em aberto nos projetos dele.
4. (Opcional, se der tempo) Abrir o **dashboard analítico** de uma
   aplicação (`/applications/:id/dashboard`) — 4 abas: Postura, Evolução,
   Insights, Comparativo.

---

## Se algo falhar no meio da demo

- **Push não chegou no celular**: confirma que o `.env` do mobile aponta
  pro IP da rede local (não `localhost`) e que o Expo Go está com sessão
  ativa — sem isso, o token nunca foi registrado.
- **Relatório não gera**: o projeto precisa estar `IN_REVIEW` ou
  `COMPLETED` (RN18) — confirma o status na aba Visão geral antes.
- **Onboarding trava em "aguardando aprovação"**: precisa logar como ADMIN
  e aprovar em `/admin/subscriptions` — não existe auto-aprovação.
- **Quer reiniciar do zero**: `docker compose down -v` apaga tudo
  (inclusive o volume do banco) — depois `docker compose up --build` +
  `npm run db:seed`.

---

_Ver `README.md` na raiz pro setup completo do zero (clone → docker →
migrate → seed) e `docs/BACKLOG.md` pras limitações conhecidas._
