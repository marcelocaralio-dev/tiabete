// test41: cabeçalho diário do Histórico (hierarquia visual). Só apresentação: números iguais aos dados, sem cortes em tela pequena, temas escuro e claro.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs'), os = require('os');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test41 ignorado: playwright não está instalado'); process.exit(0); }
const HTML = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(HTML)) { console.log('test41 ignorado: compile o app web antes'); process.exit(0); }
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dh41-'));
(async () => {
  for (const vp of [{ width: 320, height: 640 }, { width: 412, height: 915 }]) {
    const ctx = await chromium.launchPersistentContext(DIR + vp.width, Object.assign({ args: ['--no-sandbox'] }, devices['Pixel 7'], { viewport: vp })), pg = ctx.pages()[0] || await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**/fonts.*/**', r => r.abort()); await pg.goto('file://' + HTML); await pg.waitForSelector('#view'); await sleep(1500);
    await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } go('historico'); }); await sleep(800);
    for (const th of ['dark', 'light']) {
      await pg.evaluate(t => { document.documentElement.dataset.theme = t; }, th); await sleep(200);
      const r = await pg.evaluate(() => {
        const hs = [...document.querySelectorAll('#h-list .day-h.gx-dh')]; const items = histItems(); const groups = [...groupBy(items.slice(0, S.hist.limit), i => i.date)];
        const out = { n: hs.length, ng: groups.length, bad: [], over: 0, lay: new Set(), dsize: 0, csize: 0 };
        hs.forEach(h => {
          const date = h.dataset.d, its = groups.find(g => g[0] === date)[1], rs = itRecs(its), ni = its.filter(i => i.t === 'i').length, chips = [...h.querySelectorAll('.dh-c')].map(c => c.querySelector('b').textContent);
          const d = h.querySelector('.dh-d'), avg = h.querySelector('.dh-c.avg');
          if (rs.length) { if (!avg || avg.querySelector('b').textContent !== f0(stats(rs).mean) || chips[1] !== String(rs.length)) out.bad.push(date + ' média/medições'); } else if (avg) out.bad.push(date + ' média inventada');
          const ins = [...h.querySelectorAll('.dh-c')].find(c => /aplica/.test(c.textContent)); if ((ni && (!ins || ins.querySelector('b').textContent !== String(ni))) || (!ni && ins)) out.bad.push(date + ' aplicações');
          if (!/^[A-ZÀ-Ú][\wçãéáíóú-]+, \d\d\/\d\d\/\d{4}$/.test(d.textContent)) out.bad.push(date + ' data: ' + d.textContent);
          if (h.scrollWidth > h.clientWidth + 1) out.over++; h.querySelectorAll('.dh-c').forEach(c => { const cr = c.getBoundingClientRect(), hr = h.getBoundingClientRect(); if (cr.right > hr.right + 1 || cr.left < hr.left - 1) out.over++; });
          out.dsize = parseFloat(getComputedStyle(d).fontSize); if (avg) out.csize = parseFloat(getComputedStyle(avg.querySelector('b')).fontSize);
        });
        out.count = (document.querySelector('#h-list .hint') || {}).textContent; return out;
      });
      ok(r.n > 0 && r.n === r.ng, `${vp.width}/${th}: um cabeçalho novo por dia (${r.n}/${r.ng})`);
      ok(r.bad.length === 0, `${vp.width}/${th}: números do cabeçalho = dados reais, sem valores inventados ${r.bad.slice(0, 3)}`);
      ok(r.over === 0, `${vp.width}/${th}: nada cortado nem estourando a largura`);
      ok(r.dsize > r.csize * 0.9 || r.csize === 0, `${vp.width}/${th}: data não é menor que a média (${r.dsize}/${r.csize})`);
      await pg.screenshot({ path: path.join(os.tmpdir(), `dh-${vp.width}-${th}.png`) });
    }
    ok(errs.length === 0, 'sem erros de script: ' + errs.slice(0, 2));
    await ctx.close();
  }
  for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith('dh41-')) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });
  console.log(fail ? `${fail} falha(s) em ${n}` : `test41 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
