# Evidências — Exposure & Remediation Management

Saída **real** da validação da iniciativa (CP-1 a CP-7), gerada em 2026-09-16
na branch `feat/exposure-remediation-management`.

> ⚠️ **Não confundir com as outras pastas de evidência:**
> `zap/` é o baseline de segurança contra a própria stack (Fase 8);
> `dast/` é a saída de scans disparados **pelo módulo DAST** (Fase 9);
> `sonarqube/` é a análise estática do CI;
> `screenshots/` (raiz) são as telas das fases anteriores.
> **Esta pasta** é a prova de que as sete entregas desta iniciativa funcionam.

---

## O que tem aqui

| Arquivo | O que prova | Como foi gerado |
|---|---|---|
| [`test-summary.md`](test-summary.md) | Números de execução das três suítes, build, migrations e CSP | Execuções reais, transcritas |
| [`docker-build-no-cache.log`](docker-build-no-cache.log) | O build da imagem é reproduzível do zero | `docker compose build --no-cache` |
| [`security-headers.txt`](security-headers.txt) | A CSP **chega ao navegador**, e é a estrita | `curl -sI http://localhost:8086/` |
| [`migrations-from-zero.txt`](migrations-from-zero.txt) | As 18 migrations aplicam sobre um banco vazio | `prisma migrate deploy` num banco novo |
| `screenshots/` | As telas existem e mostram o conteúdo real | `npx playwright test e2e/capturar-evidencias.spec.ts` |

---

## As capturas

Todas geradas por script (`app/web/e2e/capturar-evidencias.spec.ts`) contra a
stack em `http://localhost:8086`, com a base de **demonstração**
(`npm run db:seed`) — nenhum dado real de cliente, nenhuma credencial, nenhum
token na tela.

| Arquivo | O que mostra | Checkpoint |
|---|---|---|
| `01-playbooks-catalogo.png` | O catálogo com as dez categorias do OWASP Top 10, cada cartão com o selo de origem | CP-5 |
| `02-playbook-owasp-com-licenca.png` | Um playbook oficial aberto: conteúdo real, CWEs, referências e a atribuição **CC BY-SA 4.0** no rodapé | CP-5 |
| `03-finding-como-corrigir.png` | O finding com **contexto de risco**, **VRS com a conta aberta**, **SLA**, **aceite de risco** e o bloco **"Como corrigir"** — os cinco checkpoints numa tela só | CP-1 a CP-5 |
| `04-quadro-remediacao.png` | As três colunas de trabalho, com severidade, VRS, prazo e responsável por cartão | CP-7 |
| `05-mover-para-menu.png` | O menu "Mover para…" aberto — as transições **válidas**, sem arrastar-e-soltar | CP-7 |
| `06-buscas-salvas.png` | A faixa de buscas salvas sobre a listagem de findings | CP-6 |

### Por que a captura 03 é a mais importante

Ela responde, numa tela, à pergunta que a iniciativa inteira existe para
responder: *"achei uma falha — e agora?"*

- **onde ela está**: `PRODUÇÃO · ALTA · EXPOSTA À INTERNET · CONFIDENCIAL`;
- **o quanto importa aqui**: `VRS 91 · imediato`, com a soma visível ao lado do
  CVSS 9.8 — não no lugar dele;
- **até quando**: o prazo de SLA;
- **quem corrige**: o responsável (ou o link para atribuir);
- **se não vamos corrigir**: o painel de aceite formal de risco;
- **como corrigir**: o playbook da OWASP, com a licença creditada.

---

## O que estas evidências NÃO cobrem

- **CP-8 (Exposure Graph)** — não foi implementado; não há o que evidenciar.
  Ver `docs/EXPOSURE_REMEDIATION.md` §9.
- **SonarQube desta branch** — a análise roda no CI, disparada por PR. Esta
  entrega não foi commitada nem teve PR aberto (decisão do Rafael), então
  **não há execução de SonarQube para mostrar**. Dependência externa, não
  resultado omitido.
- **Novo baseline do ZAP** — o de `zap/` é da Fase 8 e continua válido para o
  que cobre. Rodar um novo contra as telas desta iniciativa é trabalho de uma
  janela própria (o ZAP não pode dividir a máquina com as suítes de teste).
- **Uma falha intermitente** em `VRS-05`, observada uma vez em três execuções
  completas: está registrada em `test-summary.md` em vez de escondida.
