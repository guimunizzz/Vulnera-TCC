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

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
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
async function limparBuscasDeTeste(request: APIRequestContext, marcador: string): Promise<void> {
  const auth = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const lista = await request.get(`${API_URL}/saved-queries`, { headers });
  for (const q of (await lista.json()) as Array<{ id: string; name: string; isOwner: boolean }>) {
    if (q.isOwner && q.name.startsWith(marcador)) {
      await request.delete(`${API_URL}/saved-queries/${q.id}`, { headers });
    }
  }
}

/** Marcador exclusivo para que o cleanup nunca toque buscas de outra execução. */
function marcadorDaExecucao(prefixo: string): string {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function criarFindingDoRun(request: APIRequestContext, prefixo: string): Promise<string> {
  const auth = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.pentester.email, password: CREDENCIAIS.pentester.senha },
  });
  expect(auth.ok(), "login de criação do E2E falhou").toBeTruthy();
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const projetos = await request.get(`${API_URL}/projects`, { headers });
  expect(projetos.ok(), "o pentester precisa ter um projeto para o finding do E2E").toBeTruthy();
  const projeto = ((await projetos.json()) as Array<{ id: string }>)[0];
  expect(projeto, "precondição impossível: pentester sem projeto atribuível").toBeTruthy();

  const criado = await request.post(`${API_URL}/vulnerabilities`, {
    headers,
    data: {
      projectId: projeto.id,
      title: `${prefixo} Finding do quadro`,
      description: "Finding temporário criado pelo E2E-EXP-07.",
      owaspCategory: "A03",
      cvssVector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    },
  });
  expect(criado.status(), await criado.text()).toBe(201);
  return ((await criado.json()) as { id: string }).id;
}

/** Remove somente findings criados por esta execução; AuditLog é append-only. */
async function limparFindingsDoRun(request: APIRequestContext, prefixo: string): Promise<void> {
  const auth = await request.post(`${API_URL}/auth/login`, {
    data: { email: CREDENCIAIS.admin.email, password: CREDENCIAIS.admin.senha },
  });
  expect(auth.ok(), "login administrativo de limpeza falhou").toBeTruthy();
  const { accessToken } = await auth.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const lista = await request.get(`${API_URL}/vulnerabilities?search=${encodeURIComponent(prefixo)}&pageSize=100`, { headers });
  expect(lista.ok(), "listagem de limpeza do E2E falhou").toBeTruthy();
  const body = (await lista.json()) as { data?: Array<{ id: string; title: string }> };
  for (const finding of body.data ?? []) {
    if (!finding.title.startsWith(prefixo)) continue;
    const removido = await request.delete(`${API_URL}/vulnerabilities/${finding.id}`, { headers });
    expect(removido.status(), await removido.text()).toBe(204);
  }
}

const ROTULO_COLUNA: Record<"OPEN" | "IN_PROGRESS" | "FIXED", string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  FIXED: "Corrigido",
};

function rotuloDaTransicao(
  de: "OPEN" | "IN_PROGRESS" | "FIXED",
  para: "OPEN" | "IN_PROGRESS" | "FIXED",
): string {
  if (de === "IN_PROGRESS" && para === "OPEN") return "Devolver ao backlog";
  if (de === "FIXED" && para === "IN_PROGRESS") return "Reprovar validação";
  if (para === "IN_PROGRESS") return "Iniciar correção";
  return "Marcar como corrigido";
}

/** Move um cartão e prova o efeito no retrato único que alimenta o quadro. */
async function moverNoQuadro(
  page: Page,
  findingId: string,
  titulo: string,
  de: "OPEN" | "IN_PROGRESS" | "FIXED",
  para: "OPEN" | "IN_PROGRESS" | "FIXED",
  aoSolicitar?: () => void,
): Promise<void> {
  const origem = page.getByRole("region", { name: new RegExp(`^${ROTULO_COLUNA[de]}:`) });
  const cartao = origem.locator("article").filter({ hasText: titulo });
  await expect(cartao).toHaveCount(1);

  const gatilho = cartao.getByRole("button", { name: /mover para/i });
  await gatilho.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  const item = menu.getByRole("menuitem", { name: rotuloDaTransicao(de, para), exact: true });
  await expect(item).toBeVisible();

  const transicao = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/vulnerabilities/${findingId}/transition` &&
      response.status() === 200,
  );
  await item.click();
  // O callback marca a mutação antes de aguardar a resposta, permitindo que
  // o teste restaure a base mesmo se a UI falhar depois do clique.
  aoSolicitar?.();
  await transicao;

  const destino = page.getByRole("region", { name: new RegExp(`^${ROTULO_COLUNA[para]}:`) });
  await expect(destino.locator("article").filter({ hasText: titulo })).toHaveCount(1);
  await expect(origem.locator("article").filter({ hasText: titulo })).toHaveCount(0);
}

test.describe("Exposure & Remediation Management", () => {
  test("E2E-EXP-01 o catálogo OWASP está no produto, com as dez categorias", async ({ page }) => {
    await login(page, "pentester");
    await page.getByRole("link", { name: "Playbooks" }).click();
    await page.waitForURL(/\/playbooks/);

    await expect(page.getByRole("heading", { name: /playbooks de remediação/i })).toBeVisible();

    // As dez categorias do Top 10 2021, cada uma como seção do catálogo.
    for (const categoria of ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"]) {
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
    expect(data.length, "precondição impossível: nenhum finding A03 na base de demonstração").toBeGreaterThan(0);

    await login(page, "pentester");
    await page.goto(`/findings/${data[0].id}`);

    const bloco = page.getByRole("region", { name: /como corrigir/i });
    await expect(bloco).toBeVisible();
    // O playbook resolvido pela categoria do finding, com conteúdo de verdade.
    await expect(bloco.getByText(/OWASP Foundation/i)).toBeVisible();
  });

  test("E2E-EXP-05 salvar a busca atual e reabrir por ela", async ({ page, request }) => {
    const marcador = marcadorDaExecucao("E2E-EXP-05");
    const nome = `${marcador} críticas`;
    await limparBuscasDeTeste(request, marcador);
    try {
      await login(page, "pentester");
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
    } finally {
      await limparBuscasDeTeste(request, marcador);
    }
  });

  test("E2E-EXP-06 watchlist fixada aparece na barra lateral e navega", async ({ page, request }) => {
    const marcador = marcadorDaExecucao("E2E-EXP-06");
    const nome = `${marcador} fixada`;
    await limparBuscasDeTeste(request, marcador);
    try {
      await login(page, "pentester");
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
    } finally {
      await limparBuscasDeTeste(request, marcador);
    }
  });

  test("E2E-EXP-07 o quadro de remediação mostra colunas e move um finding", async ({ page, request }) => {
    const prefixo = `E2E-EXP-07-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      // Fica dentro do try para que até uma falha após o POST seja limpa pelo
      // prefixo exclusivo desta execução.
      const findingId = await criarFindingDoRun(request, prefixo);
      await login(page, "pentester");
      await page.getByRole("link", { name: "Remediação" }).click();
      await page.waitForURL(/\/remediation/);

      await expect(page.getByRole("heading", { name: /quadro de remediação/i })).toBeVisible();
      // As três colunas de trabalho; `CLOSED` NÃO está aqui, de propósito.
      for (const coluna of ["Aberto", "Em andamento", "Corrigido"]) {
        await expect(page.getByRole("heading", { name: coluna, exact: true })).toBeVisible();
      }
      await expect(page.getByRole("heading", { name: /encerrado/i })).toHaveCount(0);

      const cartao = page.locator(`a[href="/findings/${findingId}"]`).locator("xpath=ancestor::article[1]");
      await expect(cartao).toBeVisible();
      const titulo = (await cartao.getByRole("link").first().innerText()).trim();
      const href = await cartao.getByRole("link").first().getAttribute("href");
      expect(href).toBe(`/findings/${findingId}`);
      const secaoOrigem = cartao.locator("xpath=ancestor::section[1]");
      const rotuloOrigem = await secaoOrigem.getAttribute("aria-label");
      const origem = rotuloOrigem?.startsWith("Aberto")
        ? ("OPEN" as const)
        : rotuloOrigem?.startsWith("Em andamento")
          ? ("IN_PROGRESS" as const)
          : ("FIXED" as const);
      const destino =
        origem === "OPEN" ? ("IN_PROGRESS" as const) : origem === "IN_PROGRESS" ? ("FIXED" as const) : ("IN_PROGRESS" as const);

      // Esperar a rede sossegar ANTES de abrir o menu. Ao chegar por navegação
      // SPA, a busca do quadro ainda pode estar revalidando; um re-render no
      // instante do clique remonta o cartão e o menu recém-aberto vai junto.
      await page.waitForLoadState("networkidle");
      await moverNoQuadro(page, findingId, titulo, origem, destino);

      // A mesma mudança precisa aparecer no filtro da listagem global, que
      // usa a API como fonte — não apenas no estado local do Kanban.
      await page.goto(`/findings?status=${destino}`);
      await expect(page.getByRole("link", { name: titulo, exact: true })).toBeVisible();
    } finally {
      // O finding temporário é o único dado mutável criado pelo teste. A
      // exclusão é deliberada; AuditLog é append-only e não é "restaurado".
      await limparFindingsDoRun(request, prefixo);
    }
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
    await expect(gatilho).toBeVisible();

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
