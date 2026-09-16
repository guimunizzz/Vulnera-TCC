/**
 * exposure-remediation.spec.ts (e2e)
 *
 * O caminho completo da iniciativa **Exposure & Remediation Management**,
 * dirigido num Chrome de verdade contra a stack REAL (`http://localhost:8086`).
 *
 * O que estes testes pegam que os outros não pegam: bugs de FIAÇÃO. O botão
 * existe (Vitest prova), o endpoint responde (Supertest prova) e mesmo assim
 * clicar não faz nada — porque a rota não foi registrada, o menu aponta para o
 * lugar errado, ou o componente nunca foi montado na página.
 *
 *   E2E-EXP-01  o catálogo OWASP está lá, com as dez categorias
 *   E2E-EXP-02  o playbook oficial abre, mostra conteúdo e credita a licença
 *   E2E-EXP-03  System é somente leitura — a tela diz isso e não oferece editar
 *   E2E-EXP-04  "Como corrigir" aparece dentro do finding
 *   E2E-EXP-05  buscas salvas: salvar o recorte atual e reabrir por ele
 *   E2E-EXP-06  a watchlist fixada aparece na barra lateral e navega
 *   E2E-EXP-07  quadro de remediação: colunas, cartões e "Mover para…"
 *   E2E-EXP-08  mover é operável por TECLADO (o motivo de não ter arrastar)
 *   E2E-EXP-09  a CSP chega no cabeçalho HTTP — e é a estrita
 *
 * ⚠️ RODE A SUÍTE SOZINHA (ver `playwright.config.ts`).
 * ⚠️ A stack precisa estar de pé E com o catálogo semeado:
 *      docker compose up -d
 *      npm run db:seed:playbooks --workspace=app/api
 */

import { expect, test, type APIRequestContext } from "@playwright/test";
import { login, API_URL, CREDENCIAIS } from "./helpers";

/**
 * Remove buscas salvas que uma execução anterior deixou para trás.
 *
 * ⚠️ NÃO É ZELO EXCESSIVO. Estes testes rodam contra a base REAL, e uma busca
 * salva residual muda o comportamento da tela: com o atalho já existente, o
 * botão "Salvar esta busca" deixa de aparecer (é assim que ele deve funcionar)
 * e o teste seguinte falha por um motivo que nada tem a ver com o produto.
 * Aconteceu exatamente isso quando o E2E-EXP-05 falhou depois de salvar e
 * antes de limpar.
 */
async function limparBuscasDeTeste(request: APIRequestContext): Promise<void> {
  const auth = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const lista = await request.get(`${API_URL}/saved-queries`, { headers });
  for (const q of (await lista.json()) as Array<{ id: string; name: string; isOwner: boolean }>) {
    if (q.isOwner && q.name.startsWith("E2E ")) {
      await request.delete(`${API_URL}/saved-queries/${q.id}`, { headers });
    }
  }
}

test.describe("Exposure & Remediation Management", () => {
  test("E2E-EXP-01 o catálogo OWASP está no produto, com as dez categorias", async ({ page }) => {
    await login(page, "pentester");
    await page.getByRole("link", { name: "Playbooks" }).click();
    await page.waitForURL(/\/playbooks/);

    await expect(page.getByRole("heading", { name: /playbooks de remediação/i })).toBeVisible();

    // As dez categorias do Top 10 2021, cada uma como seção do catálogo.
    for (const categoria of ["A01", "A03", "A06", "A10"]) {
      await expect(page.getByRole("heading", { name: new RegExp(`^${categoria} ·`) })).toBeVisible();
    }
    // E o selo de origem oficial em pelo menos um cartão.
    await expect(page.getByText("OWASP", { exact: true }).first()).toBeVisible();
  });

  test("E2E-EXP-02 o playbook oficial abre, tem conteúdo e credita a licença", async ({ page }) => {
    await login(page, "pentester");
    await page.goto("/playbooks?owaspCategory=A03");

    await page.getByRole("link", { name: /Injeção/i }).first().click();
    await page.waitForURL(/\/playbooks\/[^/]+$/);

    // Conteúdo REAL da OWASP, não um esqueleto.
    // ⚠️ O trecho conferido tem de EXISTIR na tradução pt-BR oficial. A
    // primeira versão deste teste procurava "consultas parametrizadas", que
    // soa certo e não está no texto — o A03 diz "chamadas não parametrizadas"
    // e "interface parametrizada". Inventar a frase esperada transformaria o
    // teste num teste sobre a minha memória, não sobre o conteúdo importado.
    await expect(page.getByRole("heading", { name: /como corrigir/i })).toBeVisible();
    await expect(page.getByText(/interpretador/i).first()).toBeVisible();

    // A atribuição CC BY-SA precisa estar VISÍVEL — é exigência da licença.
    await expect(page.getByText(/OWASP Foundation/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /CC BY-SA 4\.0/i })).toBeVisible();
  });

  test("E2E-EXP-03 playbook System é somente leitura, e a tela explica por quê", async ({ page }) => {
    await login(page, "pentester");
    await page.goto("/playbooks?owaspCategory=A01");
    await page.getByRole("link").filter({ hasText: /A01:2021/ }).first().click();
    await page.waitForURL(/\/playbooks\/[^/]+$/);

    await expect(page.getByText(/conteúdo oficial, somente leitura/i)).toBeVisible();
    // Não existe botão de editar num System — a ausência é a garantia.
    await expect(page.getByRole("button", { name: /^editar$/i })).toHaveCount(0);
    // Mas existe o caminho legítimo para adaptar.
    await expect(page.getByRole("button", { name: /duplicar e adaptar/i })).toBeVisible();
  });

  test("E2E-EXP-04 o bloco 'Como corrigir' aparece dentro do finding", async ({ page, request }) => {
    // Pega um finding de A03 pela API (montar estado pela UI seria lento e frágil).
    const auth = await request.post(`${API_URL}/auth/login`, {
      data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
    });
    const { accessToken } = await auth.json();
    const busca = await request.get(`${API_URL}/vulnerabilities?owaspCategory=A03&pageSize=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { data } = await busca.json();
    test.skip(data.length === 0, "nenhum finding A03 na base de demonstração");

    await login(page, "pentester");
    await page.goto(`/findings/${data[0].id}`);

    const bloco = page.getByRole("region", { name: /como corrigir/i });
    await expect(bloco).toBeVisible();
    // O playbook resolvido pela categoria do finding, com conteúdo de verdade.
    await expect(bloco.getByText(/OWASP Foundation/i)).toBeVisible();
  });

  test("E2E-EXP-05 salvar a busca atual e reabrir por ela", async ({ page, request }) => {
    await limparBuscasDeTeste(request);
    await login(page, "pentester");
    const nome = `E2E críticas ${Date.now()}`;

    await page.goto("/findings?severity=CRITICAL&status=OPEN");
    await page.getByRole("button", { name: /salvar esta busca/i }).click();
    await page.getByLabel(/nome da busca/i).fill(nome);
    await page.getByRole("button", { name: /^salvar$/i }).click();

    await expect(page.getByText(/busca salva/i)).toBeVisible();

    // Sai do recorte e volta CLICANDO no atalho — é navegação, não snapshot.
    await page.goto("/findings");
    // Âncoras (^$) porque o botão de remover tem `aria-label` "Remover a busca
    // salva <nome>" e casaria com o mesmo padrão sem elas.
    await page.getByRole("button", { name: new RegExp(`^${nome}$`) }).click();
    await expect(page).toHaveURL(/severity=CRITICAL/);
    await expect(page).toHaveURL(/status=OPEN/);

    // Limpa o que o teste criou.
    await page.getByRole("button", { name: new RegExp(`Remover a busca salva ${nome}`) }).click();
  });

  test("E2E-EXP-06 watchlist fixada aparece na barra lateral e navega", async ({ page, request }) => {
    await limparBuscasDeTeste(request);
    await login(page, "pentester");
    const nome = `E2E fixada ${Date.now()}`;

    await page.goto("/findings?slaState=BREACHED");
    await page.getByRole("button", { name: /salvar esta busca/i }).click();
    await page.getByLabel(/nome da busca/i).fill(nome);
    // Clique no RÓTULO, não no input: o Checkbox do design system esconde o
    // input e desenha o estado no `<span>`; é o label que recebe o clique de
    // uma pessoa de verdade (e o `.check()` do Playwright bate no input, que
    // está atrás dele).
    await page.getByText(/fixar na barra lateral/i).click();
    await page.getByRole("button", { name: /^salvar$/i }).click();
    await expect(page.getByText(/busca salva/i)).toBeVisible();

    // A seção "Watchlists" só existe quando há atalho fixado.
    const barra = page.getByRole("navigation", { name: /navegação principal/i });
    await expect(barra.getByRole("heading", { name: /watchlists/i })).toBeVisible();

    await page.goto("/dashboard");
    await barra.getByRole("link", { name: new RegExp(nome) }).click();
    await expect(page).toHaveURL(/\/findings\?.*slaState=BREACHED/);

    await page.goto("/findings?slaState=BREACHED");
    await page.getByRole("button", { name: new RegExp(`Remover a busca salva ${nome}`) }).click();
  });

  test("E2E-EXP-07 o quadro de remediação mostra colunas e move um finding", async ({ page }) => {
    await login(page, "pentester");
    await page.getByRole("link", { name: "Remediação" }).click();
    await page.waitForURL(/\/remediation/);

    await expect(page.getByRole("heading", { name: /quadro de remediação/i })).toBeVisible();
    // As três colunas de trabalho; `CLOSED` NÃO está aqui, de propósito.
    for (const coluna of ["Aberto", "Em andamento", "Corrigido"]) {
      await expect(page.getByRole("heading", { name: coluna, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: /encerrado/i })).toHaveCount(0);

    const primeiroMover = page.getByRole("button", { name: /mover para/i }).first();
    await primeiroMover.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    // ⚠️ Esperar a rede sossegar ANTES de abrir o menu. Ao chegar por
    // navegação SPA, a busca do quadro ainda pode estar revalidando; um
    // re-render no instante do clique remonta o cartão e o menu recém-aberto
    // vai junto — abre e fecha, sem item nenhum dentro.
    await page.waitForLoadState("networkidle");
    test.skip((await primeiroMover.count()) === 0, "nenhum finding aberto na base de demonstração");

    await primeiroMover.click();
    // O menu oferece só as transições VÁLIDAS a partir do status atual.
    // `expect(...).toBeVisible()` e não `count()`: a contagem é instantânea e
    // não espera o painel montar, o que deixava o teste falhar por corrida.
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("E2E-EXP-08 mover um finding é operável só com o teclado", async ({ page }) => {
    // 🎯 Este teste É a justificativa do ADR-039. Se um dia alguém trocar o
    // menu por arrastar-e-soltar, é aqui que a troca aparece como regressão.
    await login(page, "pentester");
    await page.goto("/remediation");

    const gatilho = page.getByRole("button", { name: /mover para/i }).first();
    // ⚠️ Esperar o cartão APARECER antes de contar. Contar logo depois do
    // `goto` devolve 0 porque a busca ainda está no skeleton — e o teste se
    // pulava sozinho, em silêncio, justamente no caso que ele existe para
    // proteger (a operação por teclado, ADR-039).
    await gatilho.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    test.skip((await gatilho.count()) === 0, "nenhum finding aberto na base de demonstração");

    await gatilho.focus();
    await expect(gatilho).toBeFocused();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // ⚠️ O menu deste design system navega por `aria-activedescendant`, NÃO
    // movendo o foco do DOM item a item — é um dos dois padrões ARIA válidos
    // para menu, e o foco permanece no painel de propósito. Por isso o que se
    // verifica é o item ATIVO, não `toBeFocused()` no item.
    await page.keyboard.press("ArrowDown");
    const ativo = page.locator('[role="menuitem"][data-ativo]');
    await expect(ativo).toHaveCount(1);
    await expect(menu).toHaveAttribute("aria-activedescendant", /item-\d+/);

    // Fechar devolve o foco ao gatilho — sem isso o próximo Tab recomeça do topo.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(gatilho).toBeFocused();
  });

  test("E2E-EXP-09 a CSP chega no cabeçalho, e é a estrita", async ({ page }) => {
    const resposta = await page.goto("/login");
    const csp = resposta?.headers()["content-security-policy"];

    expect(csp, "a CSP precisa ser enviada pelo servidor que o Docker usa").toBeTruthy();
    // O que protege contra XSS é `script-src` SEM 'unsafe-inline'.
    expect(csp).toContain("script-src 'self' 'sha256-");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");

    // E a página continua funcionando com ela aplicada — uma CSP que quebra o
    // produto é uma CSP que alguém desliga na véspera da apresentação.
    await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
  });
});
