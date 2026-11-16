/**
 * Mede o orçamento da cena da landing (ADR-054), no mesmo espírito de
 * `output/web-motion-3d/diag-desenhos.cjs`: quadros por segundo, quadros
 * acima de 25 ms, long tasks (> 50 ms) e tempo de GPU por quadro da cena
 * (EXT_disjoint_timer_query_webgl2, quando o navegador expõe).
 *
 * Trechos medidos: parado no ato 0 (ASCII), parado no ato 3,5 (pintura),
 * rolagem da página inteira e a virada do ato 3 (progresso 2,4 → 3,6).
 *
 * Uso: node medir.cjs [base] [dpr] [saida.json]   (Chrome com janela, GPU real)
 * Só leitura; precisa do app no ar.
 */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');

const [base = 'http://localhost:5179', dpr = '1'] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.CHROME || path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    args: ['--window-size=1460,1000', '--enable-webgl-draft-extensions'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(dpr) });
  await ctx.addInitScript(() => {
    sessionStorage.setItem('vulnera:boot-visto', '1');
    const d = (window.__m = { quadros: 0, intervalos: [], desenhos: 0, longas: [], gpuNs: 0, gpuAmostras: 0, gl: null, ext: null, pendentes: [], ativa: false });
    new PerformanceObserver((lista) => lista.getEntries().forEach((e) => d.longas.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] });
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
      const c = get.call(this, tipo, ...resto);
      if (c && tipo === 'webgl2' && !d.gl) { d.gl = c; d.ext = c.getExtension('EXT_disjoint_timer_query_webgl2'); }
      return c;
    };
    // Um "desenho" = um clear do framebuffer da tela (um quadro da cena).
    const clear = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function (mascara) {
      if ((mascara & 0x4000) && !this.getParameter(this.FRAMEBUFFER_BINDING)) d.desenhos += 1;
      return clear.call(this, mascara);
    };
    // Cada callback de RAF roda dentro de uma consulta de tempo de GPU.
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((agora) => {
      const { gl, ext } = d;
      let consulta = null;
      if (gl && ext && !d.ativa && !gl.isContextLost()) {
        consulta = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, consulta);
        d.ativa = true;
      }
      try { cb(agora); } finally {
        if (consulta) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          d.ativa = false;
          d.pendentes.push(consulta);
        }
        if (gl && ext) {
          d.pendentes = d.pendentes.filter((q) => {
            if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
            const ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
            if (ns > 0 && !gl.getParameter(ext.GPU_DISJOINT_EXT)) { d.gpuNs += ns; d.gpuAmostras += 1; }
            gl.deleteQuery(q);
            return false;
          });
        }
      }
    });
    let anterior = 0;
    const contar = (agora) => { d.quadros += 1; if (anterior) d.intervalos.push(agora - anterior); anterior = agora; raf(contar); };
    raf(contar);
  });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas[data-landing-scene][data-ready="true"]');
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const gl = window.__m.gl;
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'desconhecida', timerQuery: !!window.__m.ext, dpr: devicePixelRatio, canvas: [gl.canvas.width, gl.canvas.height] };
  });
  console.log('MAQUINA', JSON.stringify(info));

  const zerar = () => page.evaluate(() => Object.assign(window.__m, { quadros: 0, intervalos: [], desenhos: 0, longas: [], gpuNs: 0, gpuAmostras: 0, t0: performance.now() }));
  const ler = (rotulo) => page.evaluate((r) => {
    const d = window.__m;
    const s = (performance.now() - d.t0) / 1000;
    return {
      trecho: r,
      segundos: +s.toFixed(2),
      fpsDoMonitor: +(d.quadros / s).toFixed(1),
      fpsDaCena: +(d.desenhos / s).toFixed(1),
      acima25ms: d.intervalos.filter((x) => x > 25).length,
      maiorIntervaloMs: Math.round(Math.max(0, ...d.intervalos)),
      longTasks: d.longas.length,
      maiorLongTaskMs: Math.max(0, ...d.longas),
      gpuMsPorQuadroDaCena: d.desenhos && d.gpuNs ? +(d.gpuNs / 1e6 / d.desenhos).toFixed(3) : null,
    };
  }, rotulo);
  const irPara = (p) => page.evaluate((prog) => {
    const topo = (a) => (a === 0 ? 0 : Math.max(0, document.querySelector(`section[data-ato="${a}"]`).getBoundingClientRect().top + scrollY - innerHeight / 2));
    const a = Math.min(4, Math.floor(prog));
    scrollTo({ top: topo(a) + (topo(a + 1) - topo(a)) * (prog - a), behavior: 'instant' });
    return scrollY;
  }, p);
  const rolar = async (ate) => {
    await page.mouse.move(720, 450);
    for (;;) {
      const y = await page.evaluate(() => scrollY);
      if (y >= ate - 5) break;
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(50);
      if ((await page.evaluate(() => scrollY)) === y) break;
    }
  };

  const resultados = [];
  for (const [rotulo, p] of [['parado-ato0-ascii', 0], ['parado-ato2-ascii', 1.6], ['parado-ato3-pintura', 3.5], ['parado-ato5-pintura', 5]]) {
    await irPara(p);
    await page.waitForTimeout(1500);
    await zerar();
    await page.waitForTimeout(3000);
    resultados.push(await ler(rotulo));
  }

  await irPara(2.4);
  await page.waitForTimeout(1000);
  const fimDaVirada = await page.evaluate(() => {
    const topo = (a) => Math.max(0, document.querySelector(`section[data-ato="${a}"]`).getBoundingClientRect().top + scrollY - innerHeight / 2);
    return topo(3) + (topo(4) - topo(3)) * 0.6;
  });
  await zerar();
  await rolar(fimDaVirada);
  resultados.push(await ler('rolando-virada-2.4-a-3.6'));

  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1000);
  await zerar();
  await rolar(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight));
  resultados.push(await ler('rolando-pagina-inteira'));

  resultados.forEach((r) => console.log(JSON.stringify(r)));
  // Terceiro argumento: arquivo JSON com os resultados (vai para a documentação).
  if (process.argv[4]) require('node:fs').writeFileSync(process.argv[4], JSON.stringify([{ trecho: 'maquina', ...info }, ...resultados], null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
