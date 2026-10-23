/**
 * exportar-excel.spec.ts (e2e)
 *
 * A exportação Excel de findings, dirigida num Chrome de verdade contra a stack
 * REAL (`http://localhost:8086`): clicar no botão baixa uma planilha cujo conteúdo
 * bate com o que a tela mostrava.
 *
 * O que estes testes pegam que Vitest e Supertest não pegam:
 *   • o download CROSS-ORIGIN: web em :8086, API em :3001. O nome do arquivo só
 *     chega ao navegador porque a API EXPÕE `Content-Disposition` via CORS. Se
 *     alguém tirar `exposedHeaders`, o nome cai no padrão gerado no front
 *     (`findings_AAAA-MM-DD_HHmm.xlsx`, sem o escopo) — e o teste falha;
 *   • a fiação do botão na página `/findings` e na aba Findings do projeto;
 *   • o retry de verdade (rede interceptada), com o toast e o botão reais.
 *
 *   E2E-XLS-01  ADMIN, sem filtro: o arquivo tem TODOS os findings da tela
 *   E2E-XLS-02  PENTESTER, com filtro na URL: só o recorte DELE, e a contagem bate com a tela
 *   E2E-XLS-03  recorte vazio: botão desabilitado e aviso visível
 *   E2E-XLS-04  CLIENT exporta pela aba Findings do projeto
 *   E2E-XLS-05  falha de rede → toast com "Tentar novamente" → o retry baixa o arquivo
 *
 * ⚠️ RODE A SUÍTE SOZINHA e com a stack de pé (ver `playwright.config.ts`):
 *      docker compose up -d --build
 * ⚠️ O ESCOPO `export` do rate limit é por USUÁRIO (6/min, burst 2). Por isso os testes se
 *    revezam entre ADMIN, PENTESTER e CLIENT: três exportações seguidas do mesmo usuário, em
 *    segundos, esbarram no limite — e a tela mostra exatamente o toast "Muitas exportações seguidas".
 * ⚠️ Cada exportação grava UM registro FINDINGS_EXPORTED no AuditLog (append-only,
 *    sem cleanup — mesma convenção dos outros specs). Os testes só LEEM findings.
 */

import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { login } from "./helpers";

/* ==========================================================================
   Ler o xlsx baixado — sem dependência nova: um .xlsx é um zip.
   ========================================================================== */

/** Entradas do zip (nome → bytes descomprimidos), lidas pelo diretório central. */
function lerZip(buf: Buffer): Map<string, Buffer> {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("não é um zip");
  const total = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);

  const entradas = new Map<string, Buffer>();
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error("diretório central corrompido");
    const metodo = buf.readUInt16LE(pos + 10);
    const tamanho = buf.readUInt32LE(pos + 20);
    const nomeLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const comentarioLen = buf.readUInt16LE(pos + 32);
    const local = buf.readUInt32LE(pos + 42);
    const nome = buf.toString("utf8", pos + 46, pos + 46 + nomeLen);

    const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const dados = buf.subarray(inicio, inicio + tamanho);
    entradas.set(nome, metodo === 0 ? dados : inflateRawSync(dados));
    pos += 46 + nomeLen + extraLen + comentarioLen;
  }
  return entradas;
}

interface Planilha {
  partes: string[];
  /** Linhas de dados da aba Findings (sem o cabeçalho). */
  linhas: number;
  /** Valores de uma coluna da aba Findings (sem o cabeçalho). */
  coluna(letra: string): string[];
  abas: string[];
}

async function abrirPlanilha(caminho: string): Promise<Planilha> {
  const zip = lerZip(await readFile(caminho));
  const findings = zip.get("xl/worksheets/sheet2.xml")?.toString("utf8");
  const workbook = zip.get("xl/workbook.xml")?.toString("utf8");
  if (!findings || !workbook) throw new Error("o arquivo não tem as abas esperadas");

  return {
    partes: [...zip.keys()],
    linhas: (findings.match(/<row /g) ?? []).length - 1,
    abas: [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]!),
    coluna: (letra) =>
      [...findings.matchAll(new RegExp(`<c r="${letra}(\\d+)"[^>]*>(?:<f>.*?</f>)?<v>([^<]*)</v>`, "g"))]
        .filter((m) => m[1] !== "1")
        .map((m) => m[2]!.replace(/&amp;/g, "&")),
  };
}

/* ==========================================================================
   Tela
   ========================================================================== */

/** O número grande do cabeçalho de /findings ("N findings no recorte atual"). */
async function totalDaPagina(page: Page): Promise<number> {
  const numero = page.locator(".findings-total [data-numeric]");
  await expect(numero).not.toHaveText("—", { timeout: 30_000 });
  return Number((await numero.innerText()).replace(/\./g, ""));
}

const botaoExcel = (page: Page) => page.getByRole("button", { name: "Exportar Excel" });

/**
 * Carregar /findings dispara ~10 chamadas à API e esgota o bucket POR USUÁRIO do rate limit
 * (1 req/s, burst 10). Um clique em "Exportar" colado no carregamento cairia nele e a tela
 * (corretamente) mostraria "Muitas exportações seguidas". Uma pessoa lê a página antes de clicar;
 * o teste espera o bucket reabastecer.
 */
async function esperarCotaDoUsuario(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3_000);
}

test.describe("Exportação Excel de findings", () => {
  test("E2E-XLS-01 ADMIN sem filtro: o arquivo tem todos os findings da tela e as abas combinadas", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/findings");
    const total = await totalDaPagina(page);
    expect(total).toBeGreaterThan(0);

    await expect(botaoExcel(page)).toBeEnabled();
    await esperarCotaDoUsuario(page);
    const [download] = await Promise.all([page.waitForEvent("download"), botaoExcel(page).click()]);

    // O nome tem o escopo — só chega assim se o Content-Disposition atravessou o CORS.
    expect(download.suggestedFilename()).toMatch(/^findings_todos_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);

    const planilha = await abrirPlanilha((await download.path())!);
    expect(planilha.abas).toEqual(["Resumo", "Findings", "Dashboard", "Acompanhamento", "Auxiliar"]);
    expect(planilha.linhas).toBe(total);
    for (const parte of ["xl/charts/chart1.xml", "xl/charts/chart2.xml", "xl/drawings/drawing1.xml"]) {
      expect(planilha.partes).toContain(parte);
    }

    await expect(page.getByRole("region", { name: "Notificações" }).getByText("Planilha exportada")).toBeVisible();
    // O botão volta ao normal.
    await expect(botaoExcel(page)).toBeEnabled();
  });

  test("E2E-XLS-02 PENTESTER com filtro na URL: só o recorte, com a mesma contagem da tela", async ({ page }) => {
    await login(page, "pentester");
    await page.goto("/findings?severity=CRITICAL,HIGH");
    const total = await totalDaPagina(page);
    expect(total).toBeGreaterThan(0);

    await esperarCotaDoUsuario(page);
    const [download] = await Promise.all([page.waitForEvent("download"), botaoExcel(page).click()]);
    expect(download.suggestedFilename()).toMatch(/^findings_filtrado_/);

    const planilha = await abrirPlanilha((await download.path())!);
    expect(planilha.linhas).toBe(total);
    // Coluna C = Severidade: nada fora do recorte entrou no arquivo.
    const severidades = new Set(planilha.coluna("C"));
    expect([...severidades].every((s) => s === "Crítica" || s === "Alta")).toBe(true);
    expect(severidades.size).toBeGreaterThan(0);
  });

  test("E2E-XLS-03 recorte vazio: botão desabilitado e o motivo VISÍVEL", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/findings?search=zzz-nada-casa-com-isto-zzz");
    await expect(page.getByText("Nenhum finding no recorte atual")).toBeVisible({ timeout: 30_000 });

    await expect(botaoExcel(page)).toBeDisabled();
    await expect(page.getByText("Nenhum finding para exportar")).toBeVisible();
  });

  test("E2E-XLS-04 CLIENT exporta pela aba Findings do projeto — só os findings da própria empresa", async ({ page }) => {
    await login(page, "cliente");
    await page.goto("/projects");
    await page.getByRole("link", { name: "Pentest API — Integração B2B" }).first().click();
    await page.getByRole("button", { name: "Findings", exact: true }).click();

    // A contagem que a própria aba anuncia (região sr-only).
    const anuncio = page.getByRole("status").filter({ hasText: /finding.* no recorte atual/ });
    await expect(anuncio).toHaveText(/\d+ findings? no recorte atual/, { timeout: 30_000 });
    const total = Number((await anuncio.innerText()).match(/^(\d+)/)![1]);
    expect(total).toBeGreaterThan(0);

    await expect(botaoExcel(page)).toBeEnabled();
    await esperarCotaDoUsuario(page);
    const [download] = await Promise.all([page.waitForEvent("download"), botaoExcel(page).click()]);

    // Um projeto só: o nome do arquivo é o slug do projeto.
    expect(download.suggestedFilename()).toMatch(/^findings_pentest-api-integracao-b2b_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/);
    const planilha = await abrirPlanilha((await download.path())!);
    expect(planilha.linhas).toBe(total);
    // Coluna F = Projeto: todos do projeto aberto.
    expect(new Set(planilha.coluna("F"))).toEqual(new Set(["Pentest API — Integração B2B"]));
  });

  test("E2E-XLS-05 falha de rede: toast com 'Tentar novamente'; o retry baixa a planilha", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/findings");
    await totalDaPagina(page);

    // A primeira chamada falha (servidor fora); as seguintes passam direto.
    let chamadas = 0;
    await page.route("**/vulnerabilities/export.xlsx*", async (route) => {
      chamadas += 1;
      if (chamadas === 1) return route.abort("failed");
      return route.continue();
    });

    await esperarCotaDoUsuario(page);
    await botaoExcel(page).click();
    const alerta = page.getByRole("alert").filter({ hasText: "Não foi possível exportar" });
    await expect(alerta).toBeVisible({ timeout: 30_000 });
    await expect(botaoExcel(page)).toBeEnabled(); // o botão não ficou preso em "Exportando…"

    const [download] = await Promise.all([page.waitForEvent("download"), alerta.getByRole("button", { name: "Tentar novamente" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^findings_todos_/);
    expect(chamadas).toBe(2);
    await expect(alerta).toBeHidden();
  });
});
