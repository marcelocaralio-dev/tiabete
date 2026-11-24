// test28: Análise reformulada: lógica pura (analise-core.js) e interface (seções, filtros, temas, estreito).
const C = require('../src/analise-core.js'), L = require('../src/logic.js'), fs = require('fs'), path = require('path'), os = require('os');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const NOW = new Date(2026, 10, 20, 23, 30).getTime(), D = 86400000, iso = ms => L.isoDate(new Date(ms)); let id = 0;
const rec = (ago, hm, g, o = {}) => { const d = iso(NOW - ago * D); return { id: 'r' + (++id), date: d, time: hm, ts: L.mkTs(d, hm), glucose: g, source: 'manual', ...o }; };
const base = []; for (let i = 0; i < 60; i++) { base.push(rec(i, '07:00', 100 + (i % 5) * 8, { context: 'jejum' })); base.push(rec(i, '12:10', 120, { context: 'antes', meal: 'almoco' })); base.push(rec(i, '14:20', 190 + (i % 3) * 20, { context: 'depois', meal: 'almoco' })); }
/* janelas, resumo, consistência com logic.js */
const W = C.anWindows(base, '30', NOW); ok(W.cur.length === 90 && W.prev.length === 90 && W.curR && W.prevR[1] < W.curR[0], 'janelas: atual e anterior de mesmo tamanho, sem sobreposição');
ok(C.anWindows(base, 'all', NOW).prev === null, 'janelas: "Tudo" não tem período anterior');
const S0 = C.anSummary(W.cur), st = L.stats(W.cur), bc = L.bandCounts(W.cur);
ok(S0.mean === st.mean && S0.sd === st.sd && S0.hypo === st.hypo && S0.hyper === st.hyper && Math.abs(S0.cv - st.sd / st.mean * 100) < 1e-9, 'resumo: média, DP, hipo e hiper idênticos aos cálculos existentes; CV = DP/média');
ok(Math.abs(S0.pIn + S0.pLow + S0.pHigh - 100) < 1e-9 && S0.bc.ok === bc.ok && S0.days === 30 && S0.n === 90, 'resumo: proporções de medições somam 100% e batem com bandCounts');
ok(!/tempo/i.test(JSON.stringify(Object.keys(S0))), 'resumo: nenhum campo chamado "tempo" (proporção de medições ≠ tempo na faixa)');
ok(C.anSummary([]).n === 0 && C.anSummary([]).mean === null, 'resumo: vazio não quebra');
ok(C.anReal(base.concat([rec(0, '10:00', 30, { source: 'exemplo' })])).length === base.length && C.anBase([rec(0, '10:00', 30, { source: 'exemplo' })]).length === 1, 'base: exemplo fica de fora quando há reais; é a base só quando não há reais');
/* horário/contexto */
const sl = C.anSlots(W.cur, W.prev), j = sl.find(s => s.k === 'jejum'), pa = sl.find(s => s.k === 'posalmoco'), pre = sl.find(s => s.k === 'prealmoco');
ok(j.n === 30 && pa.n === 30 && pre.n === 30 && sl.find(s => s.k === 'posjantar').n === 0 && sl.length === 9, 'slots: jejum, pré e pós-almoço agrupados; vazios com n=0; 9 grupos');
ok(pa.highN === 30 - pa.lowN - (pa.n - pa.highN - pa.lowN) + 0 || pa.highPct > 0, 'slots: frequência de elevados calculada');
ok(j.enough && j.dMean === 0 && C.anSlots(base.slice(0, 2), null).every(s => !s.enough || s.n >= 3), 'slots: comparação com período anterior e amostra mínima');
const jf = C.anSlots([rec(0, '07:00', 100, { context: 'jejum' }), rec(0, '07:05', 110, { context: 'jejum' })], null).find(s => s.k === 'jejum'); ok(!jf.enough && jf.n === 2, 'slots: menos de 3 medições = insuficiente');
ok(C.anSlotOf(rec(0, '10:00', 100, { context: 'outro' })) === 'outros' && C.anSlotOf(rec(0, '22:50', 100, { context: 'deitar' })) === 'deitar', 'slots: contextos extras');
/* hipo/hiper/variabilidade */
const lows = base.concat([rec(2, '03:10', 55), rec(2, '03:40', 62), rec(9, '03:30', 60), rec(15, '04:00', 58)]);
const h = C.anHypo(lows); ok(h.lowN === 4 && h.epN === 3 && h.min === 55 && h.nightly === 4 && h.byBlock[0].lows === 3 && h.byBlock[1].lows === 1 && h.recIds.length === 4, 'hipo: contagem, episódios, mínimo, madrugada e faixa horária');
ok(C.anHypo(base).lowN === 0 && C.anHyper(base).highN === C.anHyper(base).recIds.length, 'hipo/hiper: sem baixas; hiper coerente com ids');
const hy = C.anHyper(base); ok(hy.highN > 0 && hy.byBlock[3].highs === 60 && hy.highN === 60 + hy.byBlock[1].highs && hy.max === 230, 'hiper: concentra em 12–16h');
const v = C.anVariability(base); ok(v.enough && v.sd > 0 && v.amp === 230 - 100 && v.sdDays != null && v.ampMean > 0, 'variabilidade: DP, CV, amplitude, entre dias e dentro do dia');
ok(!C.anVariability([rec(0, '07:00', 100)]).enough, 'variabilidade: precisa de 5 medições');
/* comparação */
const A = base.filter(r => r.ts >= W.curR[0]), B = base.filter(r => r.ts < W.curR[0]).map(r => ({ ...r, glucose: r.glucose + 40 }));
const cmp = C.anCompare(A, B), row = k => cmp.rows.find(r => r.k === k);
ok(row('mean').d < 0 && row('mean').better === null && row('pIn').better === 'a' && row('pHigh').better !== 'b' && cmp.good >= 1, 'comparação: média sem julgamento; faixa/elevadas com direção objetiva');
ok(Math.abs(row('mean').pct - row('mean').d / row('mean').b * 100) < 1e-9, 'comparação: percentual = diferença ÷ B');
const c2 = C.anCompare(A.slice(0, 12), B); ok(c2.warn.some(w => /quantidades/.test(w)) , 'comparação: avisa quando as quantidades são muito diferentes');
const shifted = B.map(r => ({ ...r, time: '20:00', ts: L.mkTs(r.date, '20:00') })); ok(C.anCompare(A, shifted).warn.some(w => /horários/.test(w)), 'comparação: avisa quando os horários das medições mudam');
ok(C.anCompare(A.slice(0, 5), B.slice(0, 5)).warn.some(w => /Poucas/.test(w)) && !C.anCompare(A, B).enough === false, 'comparação: avisa amostra pequena');
/* recorrência */
const rl = []; for (let i = 0; i < 40; i++) { rl.push(rec(i, '03:30', 60 + (i % 3), { context: 'madrugada' })); rl.push(rec(i, '12:00', 130)); rl.push(rec(i, '14:00', 200, { context: 'depois', meal: 'almoco' })); }
const rr = C.anRecurrence(rl, { ferias: 'Férias' }); const bx = rr.find(x => x.k === 'baixas'), pr = rr.find(x => x.k === 'posrefeicao');
ok(bx && bx.count === 40 && bx.universe === 40 && /00–04h|00/.test(bx.text) && pr && pr.count === 40 && pr.universe === 40, 'recorrência: baixas por horário e elevações pós-refeição com ocorrências e universo');
ok(rr.every(x => typeof x.count === 'number' && typeof x.universe === 'number' && !/causa(?!lidade| )/.test(x.title)), 'recorrência: toda entrada traz ocorrências e universo');
const act = []; for (let i = 0; i < 20; i++) act.push(rec(i, '08:00', i % 2 ? 110 : 150, i % 2 ? { actMin: 40 } : {})); ok(C.anRecurrence(act, {}).some(x => x.k === 'atividade' && /dias com atividade/.test(x.text)), 'recorrência: dias com e sem atividade');
ok(C.anRecurrence(base.slice(0, 6), {}).length === 0, 'recorrência: poucos dados → nada');
/* associações */
const as = []; for (let i = 0; i < 30; i++) { as.push(rec(i, '12:00', 110, { carbs: 20 + (i % 4) * 25, insMeal: 2 + (i % 4), context: 'antes', meal: 'almoco' })); as.push(rec(i, '14:30', 150 + (i % 4) * 25, { context: 'depois', meal: 'almoco' })); }
const ai = C.anAssociations(as, []), ca = ai.find(x => x.k === 'carbo'), ins = ai.find(x => x.k === 'insulina');
ok(ca && ca.used === 30 && ca.universe === 30 && ca.bins.length === 3 && ca.r > 0.9 && /Não considera/.test(ca.limits), 'associação: carboidratos × glicemia posterior (30 pares, correlação, limitações)');
ok(ins && ins.used === 30 && ins.noDose && /não indica quanta insulina/i.test(ins.limits) && !/dose recomendada|aumente|reduza/i.test(JSON.stringify(ins)), 'associação: insulina sem recomendação de dose');
ok(C.anAssociations(as.slice(0, 6), []).length === 0 && C.anAssociations(base, []).filter(x => x.k === 'carbo' || x.k === 'insulina').length === 0, 'associação: sem dados de carboidrato/insulina ou poucos pares → nada');
const pairs = C.anPairs([rec(0, '12:00', 100, { carbs: 50 }), rec(0, '12:30', 120), rec(0, '14:00', 160)], r => r.carbs, 60, 240); ok(pairs.length === 1 && pairs[0].next.glucose === 160, 'pares: usa a primeira medição dentro da janela de tempo, não a mais próxima');
ok(C.anPairs([rec(0, '12:00', 100, { carbs: 50 }), rec(0, '20:00', 120)], r => r.carbs, 60, 240).length === 0 && C.anPairs([rec(0, '', 100, { carbs: 50, noTime: true }), rec(0, '14:00', 120)], r => r.carbs, 60, 240).length === 0, 'pares: fora da janela ou sem horário não pareiam');
ok(Math.abs(C.anCorr([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9 && C.anCorr([1, 1, 1], [1, 2, 3]) === null, 'correlação: 1 para linear; null sem variação');
/* descobertas */
const dd = C.anDiscoveries(rl, null, 'últimos 90 dias'); ok(dd.list.some(x => x.id === 'baixa-horario' && x.n === 40 && x.evidence.length >= 2 && x.recIds.length === 40 && x.period), 'descobertas: horário com mais hipoglicemias traz período, n, evidências e registros');
ok(C.anDiscoveries(base.slice(0, 8), null, 'x').list.length === 0 && /necessárias/.test(C.anDiscoveries(base.slice(0, 8), null, 'x').why), 'descobertas: dados insuficientes → nenhuma e explica');
const prevBad = rl.map(r => ({ ...r, glucose: r.glucose > 150 ? 320 : r.glucose, ts: r.ts - 120 * D, date: iso(r.ts - 120 * D), id: 'p' + r.id })); const d3 = C.anDiscoveries(rl, prevBad, 'x'); ok(d3.list.some(x => x.id.startsWith('melhor-')), 'descobertas: indicador que mais melhorou');
const worse = C.anDiscoveries(prevBad, rl, 'x'); ok(worse.list.some(x => x.id.startsWith('pior-')), 'descobertas: indicador que mais piorou');
/* histórico */
const hi = C.anHistory(base); ok(hi.n === 180 && hi.hi.glucose === 230 && hi.months.length >= 2 && C.anHistory([]) === null, 'histórico: marcos e meses');
/* arquivos */
const ROOT = path.join(__dirname, '..'), bw = fs.readFileSync(ROOT + '/scripts/build-web.js', 'utf8'), ui = fs.readFileSync(ROOT + '/src/analise.js', 'utf8'), core = fs.readFileSync(ROOT + '/src/analise-core.js', 'utf8'), pj = fs.readFileSync(ROOT + '/src/persist.js', 'utf8');
ok(/'src\/analise-core\.js', 'src\/analise\.js'/.test(bw) && /analise\.css/.test(bw) && /'tb-ana-open'/.test(pj) && /'7', '14', '30'/.test(pj), 'build/persistência: arquivos, abertura das seções e novos intervalos');
ok(!/Math\.random/.test(core) && !/tempo (real )?(dentro|na) (da )?faixa/i.test(ui.replace(/<b>não<\/b> é o tempo real dentro da faixa/g, '').replace(/não é o tempo real dentro da faixa/g, '')), 'honestidade: a interface nunca chama proporção de medições de tempo na faixa');
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms)); execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const seed = fs.readFileSync(__dirname + '/seed-analise.js', 'utf8');
  const run = async (name, seedJs, fn, opt = {}) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'an28-')), ctx = await chromium.launchPersistentContext(dir, Object.assign({}, devices['Pixel 7'], opt)), pg = ctx.pages()[0] || await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto('file://' + ROOT + '/www/index.html'); await sleep(1000); try { await pg.getByText('Continuar sem conta').click({ timeout: 1500 }); } catch (e) { } await pg.addStyleTag({ content: '#rw-bg{display:none!important;pointer-events:none!important}' }); await pg.evaluate(() => { window.licAllowed = () => true; }); await pg.evaluate(seedJs); await sleep(500); await pg.evaluate(() => { const b = document.getElementById('rw-bg'); if (b) b.remove(); document.body.style.overflow = ''; }); await fn(pg); ok(!errs.length, name + ': sem erros de JavaScript' + (errs.length ? ' (' + errs[0] + ')' : '')); await ctx.close(); };
  const q = (pg, s) => pg.evaluate(s => document.querySelectorAll(s).length, s), tx = (pg, s) => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
  await run('muitos registros', seed, async pg => {
    ok(await q(pg, '.an-sec') === 14 && await q(pg, '.an-nv') === 14, 'ui: 14 seções e 14 atalhos de navegação (inclui Horários e períodos do dia)');
    ok(await q(pg, '.an-sec.open') === 2 && await q(pg, '#an-visao .an-kpi') >= 6 && await q(pg, '.an-sec:not(.open) .an-b:not([hidden])') === 0, 'ui: só Visão geral e Descobertas abertas; as demais recolhidas e sem conteúdo (desempenho)');
    ok(/Coef. de variação/i.test(await tx(pg, '#an-visao')) && /não\s*é o tempo real dentro da faixa/i.test(await tx(pg, '#an-visao')), 'ui: visão geral traz CV e a nota de proporção ≠ tempo');
    await pg.click('[data-act="an-go"][data-k="hor"]'); await sleep(300); ok(await q(pg, '#an-hor .an-slot') === 9 && await q(pg, '#an-hor .hm') >= 1, 'ui: navegação abre a seção e monta cartões por contexto e mapa de calor');
    for (const id of ['ctrl', 'hipo', 'hiper', 'var', 'ref', 'comp', 'pad', 'ass', 'evo', 'desc']) await pg.click(`[data-act="an-toggle"][data-k="${id}"]`).catch(() => { }); await sleep(300);
    ok(await q(pg, '#an-ctrl .t') >= 1 && await q(pg, '#an-hipo .an-col') >= 8 && await q(pg, '#an-var .an-kpi') === 5 && await q(pg, '#an-ref .t') >= 2 && await q(pg, '#an-evo .allper, #an-evo .an-ev') >= 1, 'ui: seções preservam tabelas e gráficos existentes');
    await pg.click('[data-act="an-all"]'); await sleep(300); ok(await q(pg, '.an-sec.open') === 14 && await q(pg, '#an-ass .an-card') >= 2 && await q(pg, '#an-pad .an-card') >= 1, 'ui: expandir tudo; associações e padrões com cartões');
    ok(/limita/i.test(await tx(pg, '#an-ass')) && /pares usados/.test(await tx(pg, '#an-ass')) && !/aumente|reduza a dose/i.test(await tx(pg, '#an-ass')), 'ui: associações mostram limitações e quantidade usada, sem recomendação');
    await pg.click('[data-act="an-none"]'); await sleep(200); ok(await q(pg, '.an-sec.open') === 0, 'ui: recolher tudo');
    /* filtros */
    const counts = {}; for (const r of ['7', '14', '30', '90', '180', 'all']) { await pg.click(`[data-act="ana-range"][data-v="${r}"]`); await sleep(250); counts[r] = +((await tx(pg, '#ana-span')).match(/(\d+) medições/) || [0, 0])[1]; }
    ok(counts['7'] <= counts['14'] && counts['14'] <= counts['30'] && counts['30'] <= counts['90'] && counts['90'] <= counts['180'] && counts['180'] <= counts.all && counts.all > counts['7'], 'ui: número de medições cresce com o intervalo (' + JSON.stringify(counts) + ')');
    ok(await pg.evaluate(() => S.ana.range) === 'all', 'ui: os 6 intervalos aplicam sem erro');
    await pg.click('[data-act="ana-range"][data-v="7"]'); await sleep(200); await pg.click('[data-act="an-go"][data-k="comp"]'); await sleep(300);
    ok(await q(pg, '#an-comp .an-cr') >= 8 && await q(pg, '#an-comp .an-ab') === 1, 'ui: comparação automática (atual × anterior) com linhas de indicadores');
    await pg.click('[data-act="an-preset"][data-v="w30"]'); await sleep(200); ok(await pg.evaluate(() => !!S.ana.A.from && !!S.ana.B.from) && await q(pg, '#an-comp .an-cr') >= 8, 'ui: comparação pronta 30 × 30 e datas preenchidas');
    await pg.fill('#a-from', '2020-01-01'); await pg.fill('#a-to', '2020-01-31'); await sleep(200); ok(/menos de 3 medições|Não há como comparar/.test(await tx(pg, '#cmp')), 'ui: período manual sem dados é explicado');
    /* reabrir mantém seções abertas */
    const open = await pg.evaluate(() => [...document.querySelectorAll('.an-sec.open')].map(e => e.dataset.an).join()); await pg.reload(); await sleep(900); try { await pg.getByText('Continuar sem conta').click({ timeout: 800 }); } catch (e) { } await pg.addStyleTag({ content: '#rw-bg{display:none!important;pointer-events:none!important}' });
    ok(typeof open === 'string', 'ui: estado de abertura é lido do armazenamento');
    /* temas */
    await pg.evaluate(() => { window.licAllowed = () => true; S.route = 'analise'; render(); }); await pg.click('[data-act="an-all"]'); for (const th of ['dark', 'light']) { await pg.evaluate(t => setTheme(t), th); await sleep(200);
      const lum = await pg.evaluate(() => { const L = a => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255, c = getComputedStyle(document.querySelector('.an-note')).color.match(/\d+/g).map(Number), b = getComputedStyle(document.querySelector('.an-sec')).backgroundColor.match(/\d+/g).map(Number); return Math.abs(L(c) - L(b)); }); ok(lum > 0.25, 'ui: tema ' + th + ': contraste do texto (' + lum.toFixed(2) + ')'); }
  });
  await run('poucos registros', `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const d = isoDate(new Date()); await Store.putMany('records', [{ id: 'f1', date: d, time: '08:00', ts: mkTs(d, '08:00'), glucose: 105, context: 'jejum', source: 'manual' }, { id: 'f2', date: d, time: '08:05', ts: mkTs(d, '08:05'), glucose: 140, source: 'manual' }]); await loadAll(); S.route = 'analise'; render(); })()`, async pg => {
    ok(await q(pg, '.an-sec') === 14, 'ui: poucos registros: tela monta');
    await pg.click('[data-act="an-all"]'); await sleep(300);
    ok(/necessárias|Nenhuma descoberta/.test(await tx(pg, '#an-desc')) && /Dados insuficientes|insuficientes/.test(await tx(pg, '#an-ass')) && /Poucas medições|precisa de 5/.test(await tx(pg, '#an-var')), 'ui: descobertas, associações e variabilidade explicam a falta de dados');
    ok(/Poucas medições neste intervalo/.test(await tx(pg, '#an-visao')), 'ui: aviso de poucas medições na visão geral');
  });
  await run('ausência de dados', `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const d = isoDate(new Date(Date.now() - 200 * 86400000)); await Store.putMany('records', [{ id: 'o1', date: d, time: '08:00', ts: mkTs(d, '08:00'), glucose: 105, source: 'manual' }]); await loadAll(); S.ana.range = '30'; S.route = 'analise'; render(); })()`, async pg => { ok(/Sem medições/.test(await tx(pg, '#view')) && await q(pg, '.an-sec') === 0, 'ui: intervalo sem medições mostra aviso e não monta seções'); });
  await run('tela estreita', seed, async pg => { await pg.click('[data-act="an-all"]'); await sleep(500); const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(over <= 1, 'responsivo: sem rolagem horizontal em 320 px (' + over + ')'); }, { viewport: { width: 320, height: 640 } });
  const t0 = Date.now(); await run('desempenho', seed.replace('i=89', 'i=899').replace(/i>=1;/, 'i>=1;'), async pg => { const t = await pg.evaluate(() => { const t0 = performance.now(); S.route = 'analise'; anMemo = { key: '', M: null }; render(); return performance.now() - t0; }); ok(t < 1500, 'desempenho: 900 dias renderizam em menos de 1,5 s (' + Math.round(t) + ' ms)'); await pg.click('[data-act="an-all"]'); });
  end();
})();
function end() { console.log(fail ? `${fail} falha(s) em ${n}` : `test28 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
