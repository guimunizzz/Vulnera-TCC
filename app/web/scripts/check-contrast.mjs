/**
 * check-contrast.mjs
 *
 * O QUE FAZ
 * Lê os tokens de cor de `src/styles/tokens.css`, resolve os aliases
 * (semântico → primitivo), converte OKLCH → sRGB e calcula o contraste WCAG 2.1
 * de cada par (texto sobre fundo) nos dois temas. Imprime uma tabela e sai com
 * código 1 se algum par ficar abaixo do mínimo exigido.
 *
 * POR QUE EXISTE
 * O CLAUDE.md exige contraste AA nos dois temas, e "medi no olho" não é prova.
 * As cores de severidade foram calibradas para fundo escuro na Fase 3; ao criar
 * o tema claro elas precisam de variantes próprias, e a única forma de saber se
 * uma variante serve é medir. Esta é a régua — roda no CI e vira evidência para
 * a banca.
 *
 * QUEM USA
 * `npm run check:contrast` (chamado por `npm run check`) e a documentação
 * (docs/DESIGN_SYSTEM.md cola a saída desta ferramenta).
 *
 * MÍNIMOS (WCAG 2.1 AA)
 *   - texto normal ................ 4.5:1
 *   - texto grande (≥24px ou ≥19px bold) . 3.0:1
 *   - elemento gráfico / borda de controle . 3.0:1
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = resolve(AQUI, "../src/styles/tokens.css");

// ---------------------------------------------------------------------------
// Conversão de cor
// ---------------------------------------------------------------------------

/**
 * OKLCH → OKLab. H em graus.
 * A matemática vem do artigo original do Björn Ottosson (2020); reimplementada
 * aqui à mão de propósito, para não trazer uma dependência de cor só pra isso.
 */
function oklchParaOklab(L, C, H) {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

/** OKLab → sRGB linear (ainda sem gamma, ainda podendo estourar o gamut). */
function oklabParaLinearSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

const gammaCodifica = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const gammaDecodifica = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

/**
 * OKLCH → sRGB 8-bit.
 *
 * O clamp importa e é reportado: uma cor OKLCH fora do gamut sRGB é exibida
 * pelo navegador em outra cor que não a pedida. Se medíssemos o contraste da
 * cor teórica em vez da exibida, a medição seria mentira. `foraDeGamut` avisa.
 */
function oklchParaSrgb(L, C, H) {
  const linear = oklabParaLinearSrgb(oklchParaOklab(L, C, H));
  const cru = [linear.r, linear.g, linear.b].map(gammaCodifica);
  const foraDeGamut = cru.some((v) => v < -0.0005 || v > 1.0005);
  const clamped = cru.map((v) => Math.min(1, Math.max(0, v)));
  return {
    rgb: clamped.map((v) => Math.round(v * 255)),
    foraDeGamut,
    // luminância relativa é calculada a partir do que É EXIBIDO (pós-clamp)
    luminancia:
      0.2126 * gammaDecodifica(clamped[0]) +
      0.7152 * gammaDecodifica(clamped[1]) +
      0.0722 * gammaDecodifica(clamped[2]),
  };
}

const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

/** Razão de contraste WCAG 2.1 entre duas luminâncias relativas. */
function contraste(l1, l2) {
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

// ---------------------------------------------------------------------------
// Leitura dos tokens
// ---------------------------------------------------------------------------

/**
 * Os tokens guardam só os componentes ("0.62 0.19 292"), não a função oklch()
 * inteira. Isso é o que permite ao Tailwind aplicar opacidade
 * (`oklch(var(--x) / <alpha-value>)`) sem precisar de relative color syntax.
 * Ver docs/DESIGN_SYSTEM.md §Tokens.
 */
function lerBlocos(cssBruto) {
  // Comentários saem ANTES de qualquer coisa: o cabeçalho deste arquivo de
  // tokens cita `:root[data-theme]` em prosa, e sem remover comentário o
  // regex de bloco casa com a citação e captura um seletor inexistente.
  const css = cssBruto.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocos = [];
  // Casa `:root {`, `:root, [data-theme="dark"] {` e `[data-theme="light"] {`.
  // O seletor de tema NÃO leva `:root` na frente (ver tokens.css §8), para que
  // uma subárvore possa ser temada — daí o regex aceitar as duas formas.
  const re = /((?::root|\[data-theme)[^{}]*)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const seletor = m[1].trim();
    const corpo = m[2];
    const vars = {};
    const reVar = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let v;
    while ((v = reVar.exec(corpo)) !== null) vars[v[1]] = v[2].trim();
    blocos.push({ seletor, vars, indice: m.index });
  }
  return blocos;
}

/** Resolve `var(--outro)` em cadeia até chegar num literal "L C H". */
function resolver(nome, escopo, profundidade = 0) {
  if (profundidade > 12) throw new Error(`ciclo de var em ${nome}`);
  const bruto = escopo[nome];
  if (!bruto) return null;
  const m = bruto.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (m) return resolver(m[1], escopo, profundidade + 1);
  const partes = bruto.split(/\s+/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  return partes;
}

// ---------------------------------------------------------------------------
// Pares auditados
// ---------------------------------------------------------------------------

/**
 * Cada linha é um par que existe DE FATO na interface. Auditar pares que nunca
 * aparecem juntos infla a tabela e esconde o que importa.
 * tipo: "texto" (4.5) | "texto-grande" (3.0) | "grafico" (3.0)
 */
const PARES = [
  // --- texto base sobre os três fundos -------------------------------------
  ["--color-text-primary", "--color-bg-canvas", "texto", "Texto principal / fundo da página"],
  ["--color-text-primary", "--color-bg-surface", "texto", "Texto principal / superfície"],
  ["--color-text-primary", "--color-bg-raised", "texto", "Texto principal / superfície elevada"],
  ["--color-text-secondary", "--color-bg-surface", "texto", "Texto secundário / superfície"],
  ["--color-text-muted", "--color-bg-surface", "texto", "Texto atenuado / superfície"],
  ["--color-text-muted", "--color-bg-canvas", "texto", "Texto atenuado / fundo da página"],

  // --- ação ---------------------------------------------------------------
  ["--color-accent-fg", "--color-accent", "texto", "Texto do botão primário"],
  ["--color-accent-ink", "--color-bg-surface", "texto", "Link / texto de ação sobre superfície"],
  ["--color-accent-ink", "--color-bg-canvas", "texto", "Link / texto de ação sobre a página"],
  ["--color-focus-ring", "--color-bg-canvas", "grafico", "Anel de foco / fundo da página"],
  ["--color-focus-ring", "--color-bg-surface", "grafico", "Anel de foco / superfície"],

  // --- bordas (elementos gráficos: 3:1) -----------------------------------
  ["--color-border-strong", "--color-bg-surface", "grafico", "Borda de controle / superfície"],
  ["--color-border-strong", "--color-bg-canvas", "grafico", "Borda de controle / página"],

  // --- severidade: texto do chip sobre o fundo tingido do chip -------------
  ["--color-severity-critical-ink", "--color-severity-critical-surface", "texto", "Chip CRITICAL (texto/fundo)"],
  ["--color-severity-high-ink", "--color-severity-high-surface", "texto", "Chip HIGH (texto/fundo)"],
  ["--color-severity-medium-ink", "--color-severity-medium-surface", "texto", "Chip MEDIUM (texto/fundo)"],
  ["--color-severity-low-ink", "--color-severity-low-surface", "texto", "Chip LOW (texto/fundo)"],
  ["--color-severity-info-ink", "--color-severity-info-surface", "texto", "Chip INFO (texto/fundo)"],

  // --- severidade: texto colorido direto sobre superfície ------------------
  ["--color-severity-critical-ink", "--color-bg-surface", "texto", "Texto CRITICAL / superfície"],
  ["--color-severity-high-ink", "--color-bg-surface", "texto", "Texto HIGH / superfície"],
  ["--color-severity-medium-ink", "--color-bg-surface", "texto", "Texto MEDIUM / superfície"],
  ["--color-severity-low-ink", "--color-bg-surface", "texto", "Texto LOW / superfície"],
  ["--color-severity-info-ink", "--color-bg-surface", "texto", "Texto INFO / superfície"],

  // --- severidade: preenchimento de gráfico (donut, barras) ---------------
  ["--color-severity-critical", "--color-bg-surface", "grafico", "Fatia CRITICAL / superfície"],
  ["--color-severity-high", "--color-bg-surface", "grafico", "Fatia HIGH / superfície"],
  ["--color-severity-medium", "--color-bg-surface", "grafico", "Fatia MEDIUM / superfície"],
  ["--color-severity-low", "--color-bg-surface", "grafico", "Fatia LOW / superfície"],
  ["--color-severity-info", "--color-bg-surface", "grafico", "Fatia INFO / superfície"],

  // --- estados ------------------------------------------------------------
  ["--color-success-ink", "--color-bg-surface", "texto", "Texto de sucesso / superfície"],
  ["--color-warning-ink", "--color-bg-surface", "texto", "Texto de atenção / superfície"],
  ["--color-danger-ink", "--color-bg-surface", "texto", "Texto de erro / superfície"],
  ["--color-danger-fg", "--color-danger", "texto", "Texto do botão destrutivo"],
  ["--color-success", "--color-bg-surface", "grafico", "Série 'resolvidos' em gráfico"],
];

const MINIMO = { texto: 4.5, "texto-grande": 3.0, grafico: 3.0 };

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

const css = readFileSync(TOKENS_CSS, "utf8");
const blocos = lerBlocos(css);

// Escopo do tema = tudo de :root (primitivos + semânticos claros) sobrescrito
// pelo bloco do tema. É exatamente a cascata que o navegador aplica.
const base = {};
for (const b of blocos) if (b.seletor === ":root") Object.assign(base, b.vars);

const escopoDark = { ...base };
for (const b of blocos) {
  if (b.seletor.includes('[data-theme="dark"]')) Object.assign(escopoDark, b.vars);
}
const escopoLight = { ...base };
for (const b of blocos) {
  if (b.seletor.includes('[data-theme="light"]')) Object.assign(escopoLight, b.vars);
}

const temas = [
  ["dark", escopoDark],
  ["light", escopoLight],
];

let falhas = 0;
let foraDeGamut = 0;
const linhas = [];

for (const [nomeTema, escopo] of temas) {
  for (const [fgNome, bgNome, tipo, rotulo] of PARES) {
    const fg = resolver(fgNome, escopo);
    const bg = resolver(bgNome, escopo);
    if (!fg || !bg) {
      console.error(`✗ token não resolvido: ${fgNome} ou ${bgNome} (tema ${nomeTema})`);
      falhas++;
      continue;
    }
    const cFg = oklchParaSrgb(...fg);
    const cBg = oklchParaSrgb(...bg);
    const razao = contraste(cFg.luminancia, cBg.luminancia);
    const min = MINIMO[tipo];
    const passa = razao >= min;
    if (!passa) falhas++;
    if (cFg.foraDeGamut || cBg.foraDeGamut) foraDeGamut++;

    linhas.push({
      tema: nomeTema,
      rotulo,
      tipo,
      fg: hex(cFg.rgb),
      bg: hex(cBg.rgb),
      razao,
      min,
      passa,
      gamut: cFg.foraDeGamut || cBg.foraDeGamut,
    });
  }
}

// --- auditoria de gamut de TODOS os primitivos ------------------------------
// Um par pode passar no contraste com uma cor fora do gamut, porque a medição
// usa a cor clampada (a exibida). Mas o token continua mentindo: a rampa perde
// a progressão suave e dois passos vizinhos podem virar a MESMA cor na tela.
// Por isso a varredura é separada e cobre a rampa inteira, não só os pares.
const primitivos = Object.keys(base).filter((k) => /^--(neutral|iris|red|orange|amber|blue|green)-\d+$/.test(k));
const foraDeGamutPrimitivos = [];
for (const nome of primitivos) {
  const v = resolver(nome, base);
  if (!v) continue;
  if (oklchParaSrgb(...v).foraDeGamut) foraDeGamutPrimitivos.push(nome);
}

const larguraRotulo = Math.max(...linhas.map((l) => l.rotulo.length));
let temaAtual = "";
for (const l of linhas) {
  if (l.tema !== temaAtual) {
    temaAtual = l.tema;
    console.log(`\n── tema ${temaAtual} ${"─".repeat(60)}`);
    console.log(
      `${"par".padEnd(larguraRotulo)}  ${"frente".padEnd(8)} ${"fundo".padEnd(8)} ${"razão".padStart(7)}  ${"mín".padStart(4)}  ok`,
    );
  }
  console.log(
    `${l.rotulo.padEnd(larguraRotulo)}  ${l.fg.padEnd(8)} ${l.bg.padEnd(8)} ${l.razao.toFixed(2).padStart(6)}:1  ${l.min.toFixed(1).padStart(4)}  ${l.passa ? "✓" : "✗ FALHOU"}${l.gamut ? "  ⚠ fora do gamut sRGB" : ""}`,
  );
}

console.log(
  `\n${linhas.length} pares medidos · ${falhas} falha(s) · ${primitivos.length} primitivos auditados · ${foraDeGamutPrimitivos.length} fora do gamut sRGB`,
);

if (foraDeGamutPrimitivos.length > 0) {
  console.error(
    "\n⚠ Fora do gamut sRGB (o navegador clampa — a rampa perde progressão e dois passos podem virar a mesma cor):",
  );
  for (const n of foraDeGamutPrimitivos) console.error(`   ${n}: ${base[n]}`);
  falhas += foraDeGamutPrimitivos.length;
}
if (foraDeGamut > 0) {
  console.error("⚠ Algum par medido usa cor clampada — a razão acima é a da cor EXIBIDA, não a do token.");
}
if (falhas > 0) {
  console.error(`\n✗ ${falhas} par(es) abaixo do mínimo WCAG AA.`);
  process.exit(1);
}
console.log("\n✓ Todos os pares atendem WCAG 2.1 AA nos dois temas.");
