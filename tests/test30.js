// test30: aproveitamento horizontal (0.29.0): layout por largura real, alimentos em grupos compactos, avisos e listas em grade.
const fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const css = fs.readFileSync(ROOT + '/src/layout.css', 'utf8'), bw = fs.readFileSync(ROOT + '/scripts/build-web.js', 'utf8'), bl = fs.readFileSync(ROOT + '/src/bolus.js', 'utf8'), app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
ok(/layout\.css/.test(bw), 'build inclui layout.css');
ok(/#view \{ container: vw \/ inline-size; \}/.test(css), 'conteúdo é contêiner de consulta (largura real, com a escala do APK)');
ok(/@container vw \(min-width: 640px\)/.test(css) && /\.banners/.test(css), 'avisos em duas colunas quando há espaço');
ok(/class=\\?"banners\\?"/.test(app) || /class="banners"/.test(app), 'avisos agrupados em .banners');
ok(/#h-list > :not\(\.rec\) \{ grid-column: 1 \/ -1; \}/.test(css), 'histórico: cabeçalhos do dia ocupam a linha toda');
ok(/BL_GRP/.test(bl) && /blFoodsList/.test(bl) && /<details class="bl-grp"/.test(bl), 'alimentos em categorias recolhíveis (details nativo)');
ok(/data-bl="gall"/.test(bl), 'expandir/recolher todos os grupos');
ok(!/\.nu-g > div \{[^}]*display: none/.test(css), 'nenhuma informação nutricional escondida');
ok(/const K = 1\.29;/.test(bw) && fs.readFileSync(ROOT + '/scripts/patch-android.js', 'utf8').includes('setTextZoom(100)'), 'ajustes aprovados do APK intactos');
ok(/prefers-reduced-motion/.test(css), 'movimento reduzido respeitado');
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms)); execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const seed = fs.readFileSync(ROOT + '/tests/test29.js', 'utf8').split('const seed = `')[1].split('`;')[0];
  for (const w of [320, 360, 412, 600, 800, 1024]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c30-')), ctx = await chromium.launchPersistentContext(dir, { viewport: { width: w, height: 800 }, hasTouch: true, isMobile: w < 700 }), pg = ctx.pages()[0] || await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); await pg.goto('file://' + ROOT + '/www/index.html'); await sleep(1000);
    await pg.addStyleTag({ content: '#rw-bg,#tb-gate,#tb-splash{display:none!important;pointer-events:none!important}' }); await pg.evaluate(seed); await pg.evaluate(() => { window.licAllowed = () => true; });
    for (const r of ['painel', 'historico', 'analise', 'metricas', 'exames', 'esquemas', 'hba1c', 'config', 'mais', 'b:alimentos', 'b:cafe', 'b:dia', 'b:razao']) {
      await pg.evaluate(r => { if (r.startsWith('b:')) { S.blUi.tab = r.slice(2); S.route = 'bolus'; } else S.route = r; render(); }, r); await sleep(150);
      ok(await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, w + ' px ' + r + ': sem rolagem horizontal');
    }
    await pg.evaluate(() => { S.blUi.tab = 'alimentos'; S.route = 'bolus'; render(); document.querySelectorAll('.acc-h').forEach(h => { if (h.getAttribute('aria-expanded') !== 'true') h.click(); }); }); await sleep(200);
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s);
    ok(await q('.bl-food') === await pg.evaluate(() => S.bl.foods.length), w + ' px: todos os alimentos continuam na lista');
    ok(await q('.bl-grp[open]') === 0, w + ' px: grupos começam recolhidos');
    ok(await pg.evaluate(() => document.documentElement.scrollHeight) < 4500, w + ' px: aba Alimentos curta com grupos recolhidos');
    await pg.evaluate(() => document.querySelector('[data-bl="gall"][data-v="1"]').click()); await sleep(150);
    ok(await q('.bl-grp[open]') === await q('.bl-grp'), w + ' px: expandir todos');
    ok(await pg.evaluate(() => { const f = document.querySelector('.bl-food'); return f.querySelectorAll('.nu-g dd').length >= 5 && !!f.querySelector('.nu-net'); }), w + ' px: valores nutricionais completos no card compacto');
    await pg.evaluate(() => { const s = document.querySelector('#bl-fs'); s.value = 'banana'; s.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(150);
    ok(await q('.bl-food:not([hidden])') === 1, w + ' px: busca filtra');
    ok(errs.length === 0, w + ' px: sem erros de script ' + errs.slice(0, 2)); await ctx.close();
  }
  end();
})();
function end() { console.log(fail ? `${fail} falha(s) em ${n}` : `test30 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
