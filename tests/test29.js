// test29: biblioteca de cards (modelos A–J) e sua aplicação nos módulos.
const fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
global.window = {}; require('../src/cards.js'); const C = window.TBCards;
/* estrutura e segurança */
for (const k of 'abcdefghij') ok(typeof C[k] === 'function', 'modelo ' + k.toUpperCase() + ' existe');
ok(C.a({ label: '<x>', value: '1"2', unit: 'u', tone: 'pos', badge: 'ok' }).includes('&lt;x&gt;') && !C.a({ label: '<x>', value: 1 }).includes('<x>'), 'A: texto é escapado');
ok(/data-tone="neg"/.test(C.b({ label: 'a', value: 1, tone: 'neg' })) && !/data-tone/.test(C.b({ label: 'a', value: 1, tone: 'hack"x' })), 'B: só tons conhecidos');
ok(/<button type="button"/.test(C.c({ el: 'button', title: 't', attrs: 'data-act="x"' })) && /data-act="x"/.test(C.c({ el: 'button', title: 't', attrs: 'data-act="x"' })), 'C: botão com ação preservada');
ok((C.d([{ label: 'a', value: 1 }, { label: 'b', value: 2 }], 'dif').match(/gx-col/g) || []).length >= 2 && /gx-foot/.test(C.d([{ label: 'a', value: 1 }], 'x')), 'D: duas colunas e rodapé');
ok(/aria-valuenow="40"/.test(C.e({ label: 'a', value: 1, progress: 40 })) && /aria-valuenow="100"/.test(C.prog(500)) && /aria-valuenow="0"/.test(C.prog(-3)), 'E: progresso limitado a 0–100');
ok(/<details/.test(C.g({ title: 't' }, 'x')) && /open/.test(C.g({ title: 't', open: true }, 'x')) && /<summary>/.test(C.g({ title: 't' }, 'x')), 'G: details nativo');
ok(/<ol/.test(C.h([{ when: '10:00', title: 'e' }])) && /role="alert"/.test(C.i({ title: 't', tone: 'neg' })), 'H e I: lista cronológica e alerta com papel');
ok((C.j({ stats: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }).match(/gx-st"/g) || []).length === 2, 'J: estatísticas');
ok(C.range(5, { min: 0, max: 10, lo: 2, hi: 8 }).includes('left:50%') && C.range(5, { min: 5, max: 5 }) === '' && C.seg([{ v: 0 }]) === '', 'faixa posiciona o valor; entradas inválidas não quebram');
ok(!/<div/.test(C.seg([{ v: 1 }, { v: 2 }])) && !/<div/.test(C.range(1, { min: 0, max: 2 })), 'seg/range são phrasing content (cabem dentro de botão)');
/* arquivos / padronização */
const css = fs.readFileSync(ROOT + '/src/cards.css', 'utf8'), bw = fs.readFileSync(ROOT + '/scripts/build-web.js', 'utf8');
ok(/'src\/ds\.js', 'src\/cards\.js'/.test(bw) && /cards\.css/.test(bw), 'build inclui cards.js e cards.css');
ok(/--gx-bar-w: 3px/.test(css) && /--gx-bar-w-lg: 4px/.test(css) && /--gx-bar-r: 0 3px 3px 0/.test(css), 'tokens da barra lateral padronizados');
ok(/prefers-reduced-motion/.test(css), 'movimento reduzido respeitado');
ok(/const K = 1\.29;/.test(bw) && fs.readFileSync(ROOT + '/scripts/patch-android.js', 'utf8').includes('setTextZoom(100)'), 'ajustes aprovados do APK intactos');
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms)); execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const seed = `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await Store.put('meta',{id:'rewards',value:{got:{},act:{},init:true}}); await removeExamples(); const d0 = new Date(), recs = [];
    for (let i = 0; i < 40; i++) { const d = new Date(d0.getTime() - i * 86400000), date = isoDate(d); recs.push({ id: 'r' + i, date, time: '07:00', ts: mkTs(date, '07:00'), glucose: 100 + (i % 7) * 20, context: 'jejum', source: 'manual' }); }
    await Store.putMany('records', recs);
    await Store.putMany('hba1c', [{ id: 'h1', date: '2026-05-01', value: 7.4, lab: 'A' }, { id: 'h2', date: '2026-10-01', value: 6.6, lab: 'A' }]);
    await Store.put('schemes', { id: 's1', name: 'Atual', basalInsulin: 'Glargina', basalDose: '12 U', rapidInsulin: 'Lispro', start: isoDate(new Date(d0.getTime() - 20 * 86400000)), end: '' });
    await Store.put('schemes', { id: 's0', name: 'Antigo', basalInsulin: 'NPH', start: isoDate(new Date(d0.getTime() - 39 * 86400000)), end: isoDate(new Date(d0.getTime() - 21 * 86400000)) });
    const it = (name, value, lo, hi, flag) => ({ name, value, unit: 'mg/dL', refLow: lo, refHigh: hi, flag });
    await Store.put('exams', { id: 'x1', addedAt: 1, hash: 'z1', fileName: 'a.pdf', title: 'Perfil', date: '2026-10-20', lab: 'L', summary: 'ok', attention: ['LDL alto'], questions: [], items: [it('Glicemia', 98, 70, 99, 'normal'), it('LDL', 142, 0, 130, 'alto'), it('Vit D', 22, 30, 100, 'baixo'), { name: 'Cor', text: 'amarelo', flag: 'indeterminado' }] });
    await loadAll(); })()`;
  const run = async (name, fn, opt = {}) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c29-')), ctx = await chromium.launchPersistentContext(dir, Object.assign({}, devices['Pixel 7'], opt)), pg = ctx.pages()[0] || await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto('file://' + ROOT + '/www/index.html'); await sleep(1000); await pg.addStyleTag({ content: '#rw-bg,#tb-gate,#tb-splash{display:none!important;pointer-events:none!important}' }); await pg.evaluate(seed); await pg.evaluate(() => { window.licAllowed = () => true; });
    try { await fn(pg); } catch (e) { ok(false, name + ': ' + e.message); } ok(errs.length === 0, name + ': sem erros de script ' + errs.slice(0, 2)); await ctx.close(); };
  const go = async (pg, r, extra) => { await pg.evaluate(([r, ex]) => { if (ex) ex(); S.route = r; render(); }, [r, null]); await sleep(300); };
  const q = (pg, s) => pg.evaluate(s => document.querySelectorAll(s).length, s);
  const over = pg => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  for (const [label, opt] of [['tela comum', {}], ['tela estreita 320 px', { viewport: { width: 320, height: 640 } }]]) await run(label, async pg => {
    await go(pg, 'exames'); ok(await q(pg, 'button.gx-ex[data-act="ex-open"]') === 1 && await q(pg, '.gx-ex .gx-ring') === 1 && await q(pg, '.gx-ex .gx-seg') === 1, label + ' exames: card categorizado com anel, distribuição e ação preservada');
    ok(await pg.evaluate(() => /fora da referência/.test(document.querySelector('.gx-ex').textContent)), label + ' exames: dados mantidos (itens fora da referência)');
    ok(await over(pg) <= 1, label + ' exames: sem rolagem horizontal');
    await pg.evaluate(() => { S.ex.id = 'x1'; S.route = 'exame'; render(); }); await sleep(300);
    ok(await q(pg, '.gx-j') === 1 && await q(pg, '.gx-exi .gx-range') >= 2 && await q(pg, '.gx-i') === 1 && await q(pg, '.gx-exi') === 4, label + ' exame: resumo J, faixas de referência, alerta I e todos os 4 itens');
    ok(await over(pg) <= 1, label + ' exame: sem rolagem horizontal');
    await go(pg, 'hba1c'); ok(await q(pg, 'button.gx-hb[data-act="hba-edit"]') === 2 && await q(pg, '.gx-d') === 1 && await q(pg, '#a1c-t') === 1, label + ' hba1c: lista cronológica, comparativo D e campo da meta preservado');
    ok(await over(pg) <= 1, label + ' hba1c: sem rolagem horizontal');
    await go(pg, 'esquemas'); ok(await q(pg, 'button.gx-sch[data-act="sch-edit"]') === 2 && await q(pg, '.gx-d') === 1 && await q(pg, 'table.t') === 1, label + ' esquemas: cards C, comparativo D e tabela completa mantida');
    ok(await over(pg) <= 1, label + ' esquemas: sem rolagem horizontal');
    await go(pg, 'historico'); ok(await q(pg, '.day-h.gx-dh .gx-seg') >= 5, label + ' histórico: barra por faixa no resumo do dia');
    await go(pg, 'conquistas'); ok(await q(pg, '.gx-cw-sum') === 1 && await q(pg, 'details.gx-g') >= 1 && await q(pg, '.cw-card') >= 3, label + ' conquistas: resumo J, regras expansíveis e cards mantidos');
    ok(await over(pg) <= 1, label + ' conquistas: sem rolagem horizontal');
    await pg.evaluate(() => { document.querySelector('details.gx-g > summary').click(); }); await sleep(100); ok(await pg.evaluate(() => document.querySelector('details.gx-g').open), label + ' conquistas: expande e recolhe');
  }, opt);
  await run('temas', async pg => {
    await go(pg, 'exame'); await pg.evaluate(() => { S.ex.id = 'x1'; S.route = 'exame'; render(); }); await sleep(200);
    for (const th of ['dark', 'light']) { await pg.evaluate(t => setTheme(t), th); await sleep(200);
      const d = await pg.evaluate(() => { const L = a => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255, rgb = s => s.match(/\d+/g).map(Number), el = document.querySelector('.gx-exi .gx-sub'), bg = getComputedStyle(document.querySelector('.gx-exi')).backgroundColor; return Math.abs(L(rgb(getComputedStyle(el).color)) - L(rgb(bg))); });
      ok(d > .25, 'tema ' + th + ': contraste do texto secundário nos cards (' + d.toFixed(2) + ')'); }
    const bar = await pg.evaluate(() => { const c = getComputedStyle(document.querySelector('.gx-exi'), '::before'); return [c.width, c.borderTopRightRadius]; }); ok(Math.abs(parseFloat(bar[0]) - 3 * 0.7752) < 0.35 || Math.abs(parseFloat(bar[0]) - 3) < .1, 'barra lateral com 3 px (' + bar + ')');
  });
  end();
})();
function end() { console.log(fail ? `${fail} falha(s) em ${n}` : `test29 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
