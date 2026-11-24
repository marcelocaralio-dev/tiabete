// test51: Início personalizável (modo de edição no próprio painel): lógica pura + arrastar (mouse e toque), ocultar, cards disponíveis, restaurar, persistência e cards estruturais fixos.
const C = require('../src/inicio-core.js'), fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), ALL = C.IN_CARDS.map(c => c.k);
/* ---- lógica pura ---- */
ok(ALL.length === 14 && new Set(ALL).size === 14 && C.IN_CARDS.every(c => c.t && c.d), 'catálogo: ids estáveis, únicos, com nome e descrição');
ok(!ALL.includes('resumo') && !ALL.includes('metricas') && same(C.IN_FIXED.map(x => x.k + ':' + x.pos), ['resumo:top', 'metricas:bottom']), 'estruturais fora do catálogo personalizável');
const dirty = C.inCleanPrefs({ order: ['resumo', 'metricas', 'dist', 'dist', 'x'], hidden: ['resumo', 'metricas', 'min', 'min'] });
ok(!dirty.order.includes('resumo') && !dirty.order.includes('metricas') && !dirty.hidden.includes('resumo') && !dirty.hidden.includes('metricas') && dirty.order.length === 14 && new Set(dirty.order).size === 14 && same(dirty.hidden, ['min']), 'estruturais nunca entram em ordem/ocultos; sem duplicações');
let p = C.IN_DEF(); p = C.inHide(p, 'min'); p = C.inHide(p, 'max'); p = C.inHide(p, 'resumo');
ok(same(p.hidden, ['min', 'max']) && C.inVisible(p).length === 12, 'ocultar vários; ocultar estrutural é ignorado');
ok(same(C.inHiddenCards(p).map(c => c.k), ['min', 'max']), 'cards disponíveis = ocultos');
const mv = C.inMoveVisible(p, 'n', -1); ok(mv.order.indexOf('n') < mv.order.indexOf('cmp') && same(mv.hidden, p.hidden), 'mover pula os ocultos');
const ro = C.inReorder(p, ['dist', 'hoje']); ok(ro.order[0] === 'dist' && ro.order[1] === 'hoje' && ro.order.length === 14 && same(ro.hidden, p.hidden) && ro.order.indexOf('min') > 0, 'reordenar mantém ocultos e todos os cartões (sem perda)');
const sh = C.inShow(p, 'min'); ok(sh.order[sh.order.length - 1] === 'min' && !sh.hidden.includes('min') && sh.order.length === 14, 'readicionar vai para o fim da lista personalizável');
ok(C.inIsDefault(C.IN_DEF()) && !C.inIsDefault(p), 'padrão reconhecido');
const old = C.inCleanPrefs({ v: 1, order: ALL.filter(k => k !== 'dist').reverse(), hidden: ['hoje'], pri: ['media'] });
ok(old.order[old.order.length - 1] === 'dist' && old.order[0] === 'hiper' && same(old.hidden, ['hoje']), 'novo card futuro entra no fim sem sobrescrever a escolha do usuário');
/* ---- navegador ---- */
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada: playwright ausente'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms));
  execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const HTML = 'file://' + ROOT + '/www/index.html';
  const SEED = `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const today = new Date(); today.setHours(0, 0, 0, 0); const recs = [];
    for (let i = 89; i >= 1; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const date = isoDate(d); const g = i <= 7 ? 100 : i <= 30 ? 160 : 220; [['07:00', g], ['12:30', g + 10]].forEach(([t, v], j) => recs.push({ id: 'o' + i + '_' + j, date, time: t, ts: mkTs(date, t), glucose: v, context: 'antes', source: 'manual' })); }
    const date = isoDate(today), mk = (idn, t, g, o = {}) => ({ id: idn, date, time: t, ts: mkTs(date, t), glucose: g, source: 'manual', ...o });
    recs.push(mk('t1', '07:00', 95, { context: 'jejum' }), mk('t2', '09:30', 160, { context: 'depois', meal: 'cafe' }), mk('t3', '12:30', 210, { context: 'antes', meal: 'almoco' }), mk('t4', '15:00', 62, { context: 'antes' }), mk('t5', '16:45', 134, { context: 'antes', meal: 'lanche' }));
    await Store.putMany('records', recs); await loadAll(); S.route = 'painel'; S.period = 7; render(); })()`;
  const run = async (name, fn, opt = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in51-')), ctx = await chromium.launchPersistentContext(dir, Object.assign({}, devices['Pixel 7'], opt)), pg = ctx.pages()[0] || await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); await pg.goto(HTML); await sleep(1000); try { await pg.getByText('Continuar sem conta').click({ timeout: 1500 }); } catch (e) { }
    await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } });
    await pg.evaluate(SEED); await sleep(500); await fn(pg, ctx); ok(!errs.length, name + ': sem erros de JavaScript' + (errs.length ? ' (' + errs[0] + ')' : '')); await ctx.close();
  };
  await run('edição', async (pg, ctx) => {
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s), txt = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
    const keys = () => pg.evaluate(() => [...document.querySelectorAll('.pn-grid > *')].map(e => e.dataset.ed || e.dataset.pm || (e.classList.contains('in-day') ? 'hoje' : e.classList.contains('in-exa') ? 'exa' : '')).join(','));
    const stored = () => pg.evaluate(() => localStorage.getItem('tb-inicio'));
    const grip = async k => { await pg.evaluate(k => document.querySelector(`.in-grip[data-grip="${k}"]`).scrollIntoView({ block: 'center' }), k); await sleep(250); return pg.evaluate(k => { const r = document.querySelector(`.in-grip[data-grip="${k}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, k); };
    const DEF = await keys();
    ok(await q('[data-act="in-cust"]') === 1 && /Personalizar/.test(await txt('.in-pbtn')) && await q('.in-grip') === 0 && await q('.in-hide') === 0, 'botão Personalizar visível, sem alças fora da edição');
    const heroH = await pg.evaluate(() => document.querySelector('.in-hero').offsetHeight), cardH = await pg.evaluate(() => document.querySelector('.pn-med').offsetHeight);
    await pg.click('[data-act="in-cust"]'); await sleep(300);
    ok(await q('.in-grip') === 14 && await q('.in-hide') === 14 && await q('.in-ed-ok') === 1 && await q('.in-ed-rs') === 1 && await q('.in-av-add') === 0, 'edição: alça e ocultar nos 14 personalizáveis; Concluir e Restaurar padrão');
    ok(await q('.in-hero .in-grip, .in-hero .in-hide, .mt-blk .in-grip, .mt-blk .in-hide, .in-hero [data-grip], .mt-blk [data-grip]') === 0 && await q('.in-fixrow') === 2 && await q('.in-hero') === 1 && await q('.mt-blk') === 1, 'edição: Resumo glicêmico e Central de Métricas visíveis, sem alça nem ocultar, com marca discreta de fixo');
    ok(await pg.evaluate(() => document.querySelector('.in-hero').offsetHeight) === heroH && await pg.evaluate(() => document.querySelector('.pn-ed[data-ed="med"] .pn-med').offsetHeight) === cardH, 'edição: altura do Resumo e dos cards não aumenta');
    ok(await pg.evaluate(() => { const els = [...document.querySelectorAll('.in-ed-p')]; return els.length === 2 && /Cards disponíveis/.test(els[0].textContent); }) && !(await pg.evaluate(() => !!document.querySelector('.in-ed-p.open'))), 'edição: Cards disponíveis recolhido por padrão');
    await pg.click('[data-act="in-avt"]'); await sleep(350); ok(/Nenhum card oculto/.test(await txt('#in-av-b')), 'Cards disponíveis: avisa quando não há ocultos'); await pg.click('[data-act="in-avt"]'); await sleep(200);
    /* tocar no cartão não abre detalhes */
    const r = await pg.evaluate(() => { document.querySelector('.pn-ed[data-ed="med"]').scrollIntoView({ block: 'center' }); const b = document.querySelector('.pn-ed[data-ed="med"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await pg.mouse.click(r.x, r.y); await sleep(200); ok(await q('#pm-bg') === 0, 'edição: tocar no cartão não abre os detalhes');
    /* arrastar com mouse: para baixo */
    let g = await grip('hba'); await pg.mouse.move(g.x, g.y); await pg.mouse.down(); for (let i = 1; i <= 24; i++) { await pg.mouse.move(g.x, g.y + i * 12); await sleep(16); }
    ok(await q('.pn-ph') === 1 && await q('.pn-ed.dragging') === 1, 'arraste: marcador de destino e cartão flutuante');
    await pg.mouse.up(); await sleep(300); let k1 = await keys(); ok(k1.split(',').indexOf('hba') > 1 && k1.split(',').length === 14 && new Set(k1.split(',')).size === 14 && await q('.pn-ph') === 0 && await q('.pn-ed.dragging') === 0, 'mouse: arrastar para baixo (' + k1 + ')');
    /* para cima */
    g = await grip('hba'); await pg.mouse.move(g.x, g.y); await pg.mouse.down(); for (let i = 1; i <= 40; i++) { await pg.mouse.move(g.x, Math.max(130, g.y - i * 12)); await sleep(16); } await pg.mouse.up(); await sleep(300);
    let k2 = await keys(); ok(k2.split(',').indexOf('hba') < k1.split(',').indexOf('hba') && k2.split(',').length === 14, 'mouse: arrastar para cima (' + k2 + ')');
    ok(await stored() != null && same(JSON.parse(await stored()).order, k2.split(',')), 'ordem do arraste salva na hora');
    /* toque (Android): gesto real */
    const cdp = await ctx.newCDPSession(pg), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    g = await grip('dist'); await touch('touchStart', g.x, g.y); await sleep(40); for (let i = 1; i <= 24; i++) { await touch('touchMove', g.x, g.y - i * 14); await sleep(16); } await touch('touchEnd'); await sleep(300);
    const k3 = await keys(); ok(k3.split(',').indexOf('dist') < k2.split(',').indexOf('dist') && k3.split(',').length === 14, 'toque: arrastar pela alça reordena (' + k3 + ')');
    ok(await pg.evaluate(() => getComputedStyle(document.querySelector('.in-grip')).touchAction) === 'none', 'alça não rola a página (touch-action: none)');
    /* rolagem automática */
    await pg.evaluate(() => scrollTo(0, 0)); g = await grip('hoje'); await pg.evaluate(() => scrollTo(0, 400)); await sleep(150); g = await grip('hoje');
    const y0 = await pg.evaluate(() => scrollY); await pg.mouse.move(g.x, g.y); await pg.mouse.down(); await pg.mouse.move(g.x, g.y + 60, { steps: 3 }); await pg.mouse.move(g.x, 780, { steps: 4 }); await sleep(900);
    const y1 = await pg.evaluate(() => scrollY); await pg.mouse.up(); await sleep(200); ok(y1 > y0 + 60, 'rolagem automática ao arrastar perto da borda inferior (' + y0 + ' → ' + y1 + ')');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal');
    /* o estrutural não pode ser arrastado nem derrubado: soltar acima do Resumo/abaixo da Central mantém dentro da grade */
    const kk = (await keys()).split(','); ok(kk.length === 14 && new Set(kk).size === 14 && ALL.every(k => kk.includes(k)), 'nenhum cartão perdido ou duplicado');
    ok(await pg.evaluate(() => { const h = document.querySelector('.in-hero'), gr = document.querySelector('.pn-grid'), m = document.querySelector('.mt-blk'); return h.getBoundingClientRect().top < gr.getBoundingClientRect().top && (h.compareDocumentPosition(gr) & 4) && (gr.compareDocumentPosition(m) & 4) && !gr.contains(h) && !gr.contains(m); }), 'estrutura: Resumo → personalizáveis → Central de Métricas');
    /* ocultar vários */
    await pg.evaluate(() => scrollTo(0, 0)); for (const k of ['min', 'max', 'n']) { await pg.click(`.in-hide[data-k="${k}"]`); await sleep(250); }
    ok(await q('.pn-ed') === 11 && await q('.pn-ed[data-ed="min"], .pn-ed[data-ed="max"], .pn-ed[data-ed="n"]') === 0 && /^3$/.test((await txt('.in-ed-p .in-count')).trim()), 'ocultar vários: sai da tela na hora e entra em Cards disponíveis');
    ok(await pg.evaluate(() => !!document.querySelector('.in-hero') && !!document.querySelector('.mt-blk')), 'ocultar vários: estruturais intactos');
    await pg.click('[data-act="in-avt"]'); await sleep(350); ok(await q('.in-av-i') === 3 && /Menor/.test(await txt('.in-av-l')) && /Menor glicemia/.test(await txt('.in-av-l')) && await q('.in-av-add') === 3, 'Cards disponíveis: nome, descrição e "Adicionar à tela inicial"');
    const before = await keys(); await pg.click('[data-act="in-add"][data-k="max"]'); await sleep(300);
    const after = (await keys()).split(','); ok(after[after.length - 1] === 'max' && after.length === 12 && await q('.in-av-i') === 2, 'adicionar: volta ao fim dos personalizáveis, acima da Central');
    /* sair, reabrir, persistir */
    await pg.click('[data-act="in-done"]'); await sleep(300); ok(await q('.in-grip') === 0 && await q('.in-edit') === 0 && await q('.in-pbtn') === 1, 'Concluir encerra a edição');
    const saved = await keys(), raw = await stored(); await pg.reload(); await sleep(1000); try { await pg.getByText('Continuar sem conta').click({ timeout: 1000 }); } catch (e) { } await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } });
    ok(await keys() === saved && await stored() === raw, 'persistência: ordem e ocultos iguais depois de atualizar');
    /* cópia durável no banco (reabertura sem localStorage) */
    await pg.evaluate(async () => { await psFlush(); }); await sleep(200);
    await pg.evaluate(() => localStorage.removeItem('tb-inicio')); await pg.evaluate(async () => { await psRestore(); inPrefsCache = null; render(); }); await sleep(300);
    ok(await keys() === saved, 'persistência: restaurada da cópia durável (banco) quando o localStorage some');
    /* restaurar padrão */
    await pg.click('[data-act="in-cust"]'); await sleep(250); await pg.click('[data-act="in-reset"]'); await sleep(200);
    ok(await q('#sheet-bg') === 1 && /substituída/.test(await txt('#sheet-bg')) && await stored() === raw, 'restaurar padrão: pede confirmação antes de mudar');
    await pg.click('[data-act="close"]'); await sleep(150); ok(await stored() === raw, 'restaurar padrão: cancelar não altera');
    await pg.click('[data-act="in-reset"]'); await pg.click('[data-act="in-reset-ok"]'); await sleep(300); await pg.click('[data-act="in-done"]'); await sleep(250);
    ok(await keys() === DEF && await stored() == null && await q('.in-hero') === 1 && await q('.mt-blk') === 1, 'restaurar padrão: ordem original, tudo visível, estruturais intactos');
    ok(await pg.evaluate(async () => (await Store.all('records')).length) > 100, 'dados glicêmicos intactos');
    /* Central de Métricas continua levando às Métricas */
    await pg.click('.mt-blk'); await sleep(300); ok(await pg.evaluate(() => S.route) === 'metricas', 'Central de Métricas continua navegando');
  });
  for (const [w, hh] of [[320, 640], [768, 1024]]) await run('viewport ' + w, async pg => {
    await pg.click('[data-act="in-cust"]'); await sleep(300);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await pg.evaluate(() => document.querySelectorAll('.in-grip').length) === 14, 'tela ' + w + 'px: edição sem rolagem horizontal');
    const bad = await pg.evaluate(() => [...document.querySelectorAll('.in-ed-bar .btn, .in-grip, .in-hide')].filter(e => { const r = e.getBoundingClientRect(); return r.width < 22 || r.height < 22; }).length); ok(!bad, 'tela ' + w + 'px: controles com tamanho de toque');
  }, { viewport: { width: w, height: hh }, isMobile: w < 600, hasTouch: true });
  end();
})();
function end() { console.log(fail ? `test51 FALHOU (${fail} de ${n})` : `test51 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
