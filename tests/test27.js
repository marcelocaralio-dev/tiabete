// test27: tela Início (centro de acompanhamento): lógica pura (inicio-core.js) e, se o Playwright existir, a interface no navegador.
const C = require('../src/inicio-core.js'), L = require('../src/logic.js'), fs = require('fs'), path = require('path'), os = require('os');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const NOW = new Date(2026, 10, 20, 23, 30, 0).getTime(), DAYMS = 86400000, iso = ms => L.isoDate(new Date(ms));
let id = 0; const rec = (daysAgo, hm, g, o = {}) => { const d = iso(NOW - daysAgo * DAYMS), ts = L.mkTs(d, hm); return { id: 'r' + (++id), date: d, time: hm, ts, glucose: g, context: 'antes', source: 'manual', ...o }; };
/* ---- preferências ---- */
let p = C.inCleanPrefs(null);
ok(C.inIsDefault(p) && p.order.length === C.IN_CARDS.length && p.hidden.join() === C.IN_HIDDEN_DEF.join() && C.IN_HIDDEN_DEF.length === 4 && p.v === 2, 'prefs: padrão (indicadores extras começam em Cards disponíveis)');
p = C.inCleanPrefs({ v: 2, order: ['dist', 'xx', 'dist', 'hoje'], hidden: ['hoje', 'lixo'] });
ok(p.order[0] === 'dist' && p.order[1] === 'hoje' && p.order.length === C.IN_CARDS.length && new Set(p.order).size === p.order.length, 'prefs: chaves inválidas somem, duplicadas colapsam, as que faltam voltam ao fim');
ok(p.hidden.join() === 'hoje', 'prefs: ocultos higienizados');
ok(C.inCleanPrefs({ v: 2 }).order.length === C.IN_CARDS.length && C.inParsePrefs('{quebrado').order.length === C.IN_CARDS.length && C.inIsDefault(C.inParsePrefs('{quebrado')), 'prefs: vazio/lixo volta ao padrão sem erro');
let q = C.inMove(C.inCleanPrefs(null), 'hba', -1); ok(q.order.indexOf('hba') === C.IN_DEF().order.indexOf('hba') - 1 && q.order.indexOf('hoje') === C.IN_DEF().order.indexOf('hoje') + 1, 'prefs: subir');
ok(C.inMove(C.inMove(C.inCleanPrefs(null), 'per', -1), 'per', -1).order[0] === 'per' && C.inMove(C.inCleanPrefs(null), 'dist', 1).order.at(-1) === 'dist', 'prefs: limites do mover não quebram');
q = C.inToggleHidden(C.inCleanPrefs(null), 'min'); ok(q.hidden.includes('min') && !C.inVisible(q).includes('min') && C.inVisible(q).length === C.IN_CARDS.length - C.IN_HIDDEN_DEF.length - 1, 'prefs: ocultar');
ok(!C.inToggleHidden(q, 'min').hidden.includes('min') && C.inToggleHidden(q, 'ult').hidden.length === C.IN_HIDDEN_DEF.length + 1, 'prefs: reexibir; "ult"/essenciais não são ocultáveis');
const allInd = C.IN_IND.map(i => C.inIndId(i.k));
q = allInd.reduce((a, k) => C.inHide(a, k), C.inCleanPrefs(null)); ok(allInd.every(k => q.hidden.includes(k)) && !C.inVisible(q).some(k => allInd.includes(k)) && C.inVisible(q).length === C.IN_CARDS.length - allInd.length, 'prefs: todos os indicadores podem ser ocultados (não há mínimo)');
q = C.inShow(q, 'ind-hipo'); ok(q.order.at(-1) === 'ind-hipo' && !q.hidden.includes('ind-hipo') && q.hidden.length === allInd.length - 1, 'prefs: indicador oculto volta pelo Cards disponíveis, no fim');
ok(C.IN_TOP.every(c => C.IN_CARDS.some(x => x.k === c.k)) && ['per', 'atalhos', 'eventos'].every(k => C.IN_CARDS.some(x => x.k === k)) && allInd.length === 8 && C.inCleanPrefs(null).order.slice(0, 11).join() === ['per'].concat(allInd.slice(0, 8), ['atalhos', 'eventos']).join(), 'prefs: período, indicadores, atalhos e acontecimentos são cards personalizáveis, no topo por padrão');
/* migração do formato antigo (v1: 14 cards + pri): nada se perde e o que era fixo entra no topo */
const OLD14 = C.IN_CARDS.map(c => c.k).filter(k => !C.IN_TOP.some(t => t.k === k));
let mg = C.inCleanPrefs({ v: 1, order: OLD14.slice().reverse(), hidden: ['min'], pri: ['hipo', 'media'] });
ok(mg.v === 2 && mg.order.slice(0, 11).join() === ['per', 'ind-hipo', 'ind-media', 'ind-tend', 'ind-var', 'ind-faixa', 'ind-hiper', 'ind-comp', 'ind-hba', 'atalhos', 'eventos'].join() && mg.order.slice(11).join() === OLD14.slice().reverse().join(), 'migração v1: ordem antiga mantida, fixos no topo, indicadores escolhidos na mesma ordem');
ok(mg.hidden.includes('min') && !mg.hidden.includes('ind-hipo') && !mg.hidden.includes('ind-media') && ['ind-tend', 'ind-var', 'ind-faixa', 'ind-hiper', 'ind-comp', 'ind-hba'].every(k => mg.hidden.includes(k)), 'migração v1: ocultos mantidos e indicadores não escolhidos passam a ocultos');
ok(C.inIsDefault({ v: 1, order: OLD14, hidden: [], pri: ['media', 'tend', 'var', 'faixa'] }) && C.inIsDefault({ order: OLD14 }), 'migração v1: configuração antiga padrão equivale ao padrão novo');

ok(!C.inIsDefault(q) && C.inIsDefault(C.inCleanPrefs(JSON.parse(JSON.stringify(C.IN_DEF())))), 'prefs: restaurar = padrão');
/* ---- situação: muitos, poucos, nenhum registro ---- */
const many = []; for (let i = 0; i < 60; i++) [['07:00', 110 + (i % 5) * 4], ['12:30', 150], ['19:00', 170 + (i % 3) * 20]].forEach(([t, g]) => many.push(rec(i, t, g)));
let m = C.inSituation(many, NOW, 30, null);
ok(m.sc.n === 90 && m.sp.n === 90 && m.trend && m.trend.dir && m.vari && m.vari.sd > 0 && !m.stale && m.tir != null, 'situação: muitos registros calcula período, anterior, tendência e variabilidade');
ok(/Última medição/.test(m.summary) && /Média de 30 dias/.test(m.summary) && !/hipoglic|diagn|trat/i.test(m.summary), 'situação: resumo descreve fatos, sem diagnóstico');
const few = [rec(0, '08:00', 100), rec(1, '08:00', 120)]; m = C.inSituation(few, NOW, 30, null);
ok(m.few && m.trend === null && m.vari === null && /Poucas medições/.test(m.summary), 'situação: poucos registros → sem tendência/variabilidade e com aviso de cautela');
ok(C.inIndicator('tend', m).v === '—' && C.inIndicator('var', m).v === '—' && C.inIndicator('comp', m).v === '—' && C.inIndicator('hba', m).v === '—', 'indicadores: sem base mostram "—", nunca número inventado');
const old = [rec(9, '08:00', 100), rec(10, '09:00', 130)]; m = C.inSituation(old, NOW, 7, null);
ok(m.stale && m.sc.n === 0 && /Sem medições nos últimos 7 dias/.test(m.summary) && /Sem medições recentes/.test(m.summary) && C.inIndicator('media', m).v === '—', 'situação: ausência de medições recentes é dita com clareza');
m = C.inSituation([], NOW, 30, null); ok(m.last === null && /Registre uma medição/.test(m.summary), 'situação: sem registros não quebra');
const withEx = many.concat([rec(0, '10:00', 30, { source: 'exemplo' })]); ok(C.inSituation(withEx, NOW, 30, null).sc.n === 90 && C.inSituation(withEx, NOW, 30, null).last.source !== 'exemplo', 'dados de exemplo não entram nas estatísticas nem como "última medição" quando há registros reais');
m = C.inSituation([rec(0, '10:00', 150, { source: 'exemplo' })], NOW, 30, null); ok(m.last && m.sc.n === 1, 'pessoa nova: sem registros reais, o exemplo é a base única (tela coerente)');
/* ---- tendência ---- */
const up = []; for (let i = 0; i < 7; i++) { up.push(rec(i, '08:00', 160)); up.push(rec(i + 7, '08:00', 120)); }
ok(C.inTrend(up, NOW).dir === 'up' && C.inTrend(up, NOW).diff === 40, 'tendência: subindo (média 7 dias vs 7 anteriores)');
const flat = []; for (let i = 0; i < 14; i++) flat.push(rec(i, '08:00', 120 + (i % 2)));
ok(C.inTrend(flat, NOW).dir === 'flat' && C.inTrend(up.slice(0, 6), NOW) === null, 'tendência: estável dentro de ±10; sem dados suficientes devolve null');
/* ---- acontecimentos ---- */
const hy = many.slice().concat([rec(1, '03:10', 58), rec(1, '03:40', 62), rec(1, '04:30', 95), rec(4, '14:00', 66)]);
let ev = C.inEvents({ records: hy, hba: [], exams: [], now: NOW, period: 30 });
ok(ev[0].kind === 'hipo' && ev.filter(e => e.kind === 'hipo').length === 2 && ev[0].act.type === 'open' && ev[0].tone === 'bad', 'eventos: hipoglicemias recentes primeiro, com acesso ao registro');
ok(/58 mg\/dL/.test(ev[0].text) && /2 medições seguidas/.test(ev[0].text), 'eventos: episódio agrupa medições seguidas e mostra o menor valor');
ok(!C.inEvents({ records: many, hba: [], exams: [], now: NOW, period: 30 }).some(e => e.kind === 'hipo'), 'eventos: sem hipoglicemia, sem evento de hipoglicemia');
ok(C.inEvents({ records: hy.concat([rec(2, '12:00', 40, { source: 'exemplo' })]), hba: [], exams: [], now: NOW, period: 30 }).filter(e => e.kind === 'hipo').length === 2, 'eventos: exemplo não gera acontecimento');
ok(C.inEvents({ records: [], hba: [], exams: [], now: NOW, period: 30 }).length === 0 && C.inEvents({ records: few, hba: [], exams: [], now: NOW, period: 30 }).length === 0, 'eventos: sem dados, nada de notificação de enchimento');
const shift = []; for (let i = 0; i < 30; i++) { shift.push(rec(i, '08:00', 200)); shift.push(rec(i + 30, '08:00', 140)); }
ev = C.inEvents({ records: shift, hba: [], exams: [], now: NOW, period: 30 }); const em = ev.find(e => e.kind === 'media');
ok(em && /em alta/.test(em.title) && /60 mg\/dL/.test(em.text) && em.tone === 'warn', 'eventos: alteração relevante na média');
ok(!C.inEvents({ records: flat.concat(flat.map(x => ({ ...x, id: 'z' + x.id, ts: x.ts - 30 * DAYMS, date: iso(x.ts - 30 * DAYMS) }))), hba: [], exams: [], now: NOW, period: 30 }).some(e => e.kind === 'media'), 'eventos: média estável não gera evento');
const vr = []; for (let i = 0; i < 20; i++) { vr.push(rec(i, '08:00', i % 2 ? 60 + 100 : 60 + 20)); vr.push(rec(i + 30, '08:00', 118 + (i % 2))); }
ok(C.inEvents({ records: vr, hba: [], exams: [], now: NOW, period: 30 }).some(e => e.kind === 'var'), 'eventos: mudança de variabilidade (desvio-padrão)');
const ex1 = { id: 'e1', date: iso(NOW - 2 * DAYMS), addedAt: NOW - 2 * DAYMS, title: 'Hemograma', items: [{}, {}, {}] }, ex0 = { id: 'e0', date: iso(NOW - 80 * DAYMS), addedAt: NOW - 80 * DAYMS, title: 'Antigo', items: [] };
ev = C.inEvents({ records: many, hba: [{ id: 'ex-e1', examId: 'e1', source: 'exame', date: ex1.date, value: 6.8 }], exams: [ex1, ex0], now: NOW, period: 30 });
ok(ev.filter(e => e.kind === 'exame').length === 1 && ev.find(e => e.kind === 'exame').act.type === 'exam' && /HbA1c 6,8%/.test(ev.find(e => e.kind === 'exame').text) && !ev.some(e => e.kind === 'hba'), 'eventos: exame novo (14 dias) com HbA1c junto, sem duplicar; exame antigo ignorado');
ev = C.inEvents({ records: many, hba: [{ id: 'h0', source: 'manual', date: iso(NOW - 120 * DAYMS), value: 7.4 }, { id: 'h1', source: 'manual', date: iso(NOW - 5 * DAYMS), value: 6.9 }], exams: [], now: NOW, period: 30 });
ok(ev.some(e => e.kind === 'hba' && /6,9%/.test(e.text) && /7,4%/.test(e.text)), 'eventos: novo resultado de HbA1c compara com o anterior');
ok(!C.inEvents({ records: many, hba: [{ id: 'h2', source: 'exemplo', date: iso(NOW), value: 9 }], exams: [{ ...ex1, source: 'exemplo' }], now: NOW, period: 30 }).some(e => e.kind === 'hba' || e.kind === 'exame'), 'eventos: exame/HbA1c de exemplo não geram acontecimento');
const rc = []; for (let i = 1; i < 45; i++) rc.push(rec(i, '08:00', 120)); rc.push(rec(1, '20:00', 330));
ev = C.inEvents({ records: rc, hba: [], exams: [], now: NOW, period: 30 }); ok(ev.some(e => e.kind === 'recorde' && /Maior glicemia/.test(e.title) && e.act.type === 'open'), 'eventos: recorde histórico (maior glicemia) só com histórico suficiente');
ok(!C.inEvents({ records: rc.slice(-10), hba: [], exams: [], now: NOW, period: 30 }).some(e => e.kind === 'recorde'), 'eventos: sem histórico suficiente, sem recorde');
const seq = []; for (let i = 0; i < 40; i++) { seq.push(rec(i, '08:00', 120)); seq.push(rec(i, '14:00', 130)); }
ok(C.inEvents({ records: seq, hba: [], exams: [], now: NOW, period: 30 }).some(e => e.kind === 'recorde' && /sequência/i.test(e.title)), 'eventos: maior sequência de dias na faixa');
const lows = []; for (let i = 0; i < 40; i++) lows.push(rec(i, i % 2 ? '02:00' : '03:00', 62 + (i % 3)), rec(i, '12:00', 130)); lows.forEach(x => { x.ts = L.mkTs(x.date, x.time); });
ev = C.inEvents({ records: lows, hba: [], exams: [], now: NOW, period: 30 }); ok(ev.some(e => e.kind === 'padrao' && e.act.id === 'padroes'), 'eventos: padrão recorrente do aplicativo (horário das baixas)');
ok(ev.map(e => e.kind).indexOf('hipo') < ev.map(e => e.kind).indexOf('padrao'), 'eventos: hipoglicemia vem antes de padrão');
/* ---- evolução do dia ---- */
const day = [rec(0, '07:00', 62, { context: 'jejum' }), rec(0, '09:30', 150), rec(0, '19:00', 210), rec(0, '23:10', 140), rec(0, '12:00', 100, { noTime: true })];
const D = C.inDay(day, iso(NOW), [{ date: iso(NOW), text: 'Gripe' }, { date: '2000-01-01', text: 'x' }]);
ok(D.n === 5 && D.items[0].out === 'low' && D.items.some(i => i.out === 'high') && D.out >= 2 && D.events.length === 1, 'dia: fora da faixa identificado e eventos do dia relacionados');
const timed = D.timed; ok(timed.every(i => !i.r.noTime) && D.untimed === 1, 'dia: sem horário fica fora do gráfico e é contado');
ok(timed[1].gapMin === 150 && timed[1].joinPrev && timed[2].gapMin === 570 && !timed[2].joinPrev && D.maxGapMin >= 570, 'dia: intervalos reais entre medições; mais de 6 h não liga os pontos (nada é interpolado)');
ok(C.inDay([], iso(NOW)).n === 0 && C.inDay(day, '1999-01-01').n === 0 && C.inGap(75) === '1 h 15 min' && C.inGap(45) === '45 min', 'dia: vazio e formatação de intervalos');
/* ---- atalhos ---- */
const base = { records: many, exams: [], now: NOW, remWin: null, planN: 0, irN: 0 };
ok(!C.inShortcuts(base).length, 'atalhos: nada em contexto neutro (sem ruído)');
let sc = C.inShortcuts({ ...base, records: many.concat([rec(0, '23:00', 130)]) }); ok(sc[0].act === 'in-hist' && sc[0].d === iso(NOW), 'atalhos: depois de registrar glicemia, acesso ao histórico');
sc = C.inShortcuts({ ...base, records: many.concat([rec(0, '21:10', 130, { meal: 'jantar' })]) }); ok(sc.some(s => s.act === 'new' && s.ctx === 'depois' && s.meal === 'jantar'), 'atalhos: depois de refeição, acompanhamento posterior (registro "depois")');
sc = C.inShortcuts({ ...base, records: many.concat([rec(0, '21:10', 130, { meal: 'jantar' }), rec(0, '22:40', 140, { context: 'depois', meal: 'jantar' })]) }); ok(!sc.some(s => s.k === 'meal'), 'atalhos: já acompanhado, não sugere de novo');
sc = C.inShortcuts({ ...base, exams: [{ id: 'e1', addedAt: NOW - DAYMS, title: 'Lipídios' }] }); ok(sc[0].act === 'ex-open' && sc[0].id === 'e1', 'atalhos: exame novo leva aos resultados');
sc = C.inShortcuts({ ...base, irN: 1 }); ok(sc[0].act === 'in-rem' && /Lembrete pendente/.test(sc[0].label), 'atalhos: lembrete pendente leva ao aviso (não confirma sozinho)');
sc = C.inShortcuts({ ...base, remWin: { t: 'em jejum', ctx: 'jejum', meal: '' } }); ok(sc[0].act === 'new' && sc[0].ctx === 'jejum', 'atalhos: medição pendente abre o registro já no contexto');
ok(C.inShortcuts({ ...base, irN: 2, planN: 1, remWin: { t: 'x', ctx: 'a' }, records: many.concat([rec(0, '22:40', 130, { meal: 'jantar' })]), exams: [{ id: 'e', addedAt: NOW - 1000 }] }).length <= 3, 'atalhos: no máximo 3, discretos');
ok(!C.inShortcuts({ ...base, records: [rec(0, '23:00', 130, { source: 'exemplo' })] }).length, 'atalhos: exemplo não dispara atalho');
/* ---- escala ---- */
const sc2 = C.inScale([55, 300], 70, 180); ok(sc2.pos(55) === (55 - 40) / (sc2.max - sc2.min) * 100 && sc2.pos(300) <= 100 && sc2.pos(0) === 0, 'escala: posições dentro de 0–100');
/* ---- integração com o app (sem navegador): build e ordem ---- */
const ROOT = path.join(__dirname, '..'), bw = fs.readFileSync(ROOT + '/scripts/build-web.js', 'utf8'), ps = fs.readFileSync(ROOT + '/src/persist.js', 'utf8');
ok(/'src\/painel2\.js', 'src\/inicio-core\.js', 'src\/inicio\.js'/.test(bw) && /inicio\.css/.test(bw), 'build: núcleo, interface e CSS do Início entram no pacote, depois do painel');
ok(/'tb-inicio'/.test(ps), 'persistência: preferências do Início têm cópia durável no banco');
const ui = fs.readFileSync(ROOT + '/src/inicio.js', 'utf8'), core = fs.readFileSync(ROOT + '/src/inicio-core.js', 'utf8');
ok(!/innerHTML\s*=\s*[^;]*\$\{(?:e|x)\.(?:text|title)\}/.test(ui) && /esc\(e\.title\)/.test(ui) && /esc\(e\.text\)/.test(ui), 'segurança: textos dos acontecimentos passam por esc()');
ok(!/Math\.random|interpol/i.test(core.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'honestidade: nenhuma interpolação ou valor aleatório no núcleo');

/* ---- navegador ---- */
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada: playwright ausente'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms));
  execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const HTML = 'file://' + ROOT + '/www/index.html';
  const noGate = pg => pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } });
  const run = async (name, seedFn, fn, opt = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in27-')), ctx = await chromium.launchPersistentContext(dir, Object.assign({}, devices['Pixel 7'], opt)), pg = ctx.pages()[0] || await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); await pg.goto(HTML); await sleep(1000); try { await pg.getByText('Continuar sem conta').click({ timeout: 1500 }); } catch (e) { } await noGate(pg);
    await pg.evaluate(seedFn); await sleep(350); await fn(pg); ok(!errs.length, name + ': sem erros de JavaScript' + (errs.length ? ' (' + errs[0] + ')' : '')); await ctx.close();
  };
  const seedBase = `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const recs = [], today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 59; i >= 1; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const date = isoDate(d); [['07:00', 118 + (i % 4) * 6], ['12:30', 150], ['19:00', 190]].forEach(([t, g], j) => recs.push({ id: 'b' + i + '_' + j, date, time: t, ts: mkTs(date, t), glucose: g, context: 'antes', source: 'manual' })); }
    recs.push({ id: 'low1', date: isoDate(new Date(today.getTime() - 86400000)), time: '03:10', ts: mkTs(isoDate(new Date(today.getTime() - 86400000)), '03:10'), glucose: 58, context: 'antes', source: 'manual' });
    await Store.putMany('records', recs); await loadAll(); S.route = 'painel'; render(); })()`;
  await run('muitos registros', seedBase, async pg => {
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s), txt = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
    ok(await q('.in-hero') === 1 && await q('.in-hero .in-ind') === 0 && await q('.pn-grid > .in-ind') === 4 && await q('.in-pc .in-ind') === 0 && await q('.pn-grid > .in-pc') === 1 && await q('.in-hero [data-pm]') === 0 && await q('.in-pc [data-act="period"]') === 3 && await q('.in-hero [data-act="period"]') === 0 && await q('.pn-dia') === 0, 'ui: Resumo glicêmico sem indicadores/filtro; período de análise e 4 indicadores padrão como cards editáveis, fora do Resumo');
    ok(await q('.in-ev .in-evi') >= 1 && /Hipoglicemia/.test(await txt('.in-ev')), 'ui: card de acontecimentos mostra a hipoglicemia recente');
    ok(await q('.in-day') === 1 && await q('.in-day .in-pt') >= 0, 'ui: evolução do dia presente');
    ok(await q('.pn-grid > *') >= 13 && await q('.mt-blk') === 1 && await q('.nav-in') === 1, 'ui: cartões, bloco de métricas e navegação preservados');
    await pg.click('.in-ev .in-evi'); await sleep(250); ok(await q('#sheet-bg') === 1 || /Registro|Medição|Editar/i.test(await txt('#sheet-bg')) || await q('.sheet') >= 1, 'ui: acontecimento abre o registro relacionado');
    await pg.evaluate(() => closeSheet()); await sleep(100);
    await pg.click('.in-ind[data-pm="med"], .in-ind'); await sleep(250); ok(await q('#pm-bg') === 1, 'ui: indicador abre os detalhes'); await pg.evaluate(() => pmClose(true));
    /* personalização: mover, ocultar, indicador, persistir, restaurar */
    const keys = () => pg.evaluate(() => inVisible(inPrefs()).join(','));
    const before = await keys(); await pg.click('[data-act="in-cust"]'); await sleep(250);
    ok(await q('.in-grip') === 21 && await q('.in-hide') === 21 && await q('.pn-ed[data-ed="per"] .in-grip') === 1 && await q('.pn-ed[data-ed="eventos"] .in-hide') === 1 && await q('.pn-ed[data-ed="ind-media"] .in-grip') === 1 && await q('.in-hero .in-grip, .mt-blk .in-grip, .in-hero .in-hide, .mt-blk .in-hide') === 0, 'ui: modo de edição no Início: alça e ocultar em todos os cards (período, indicadores e acontecimentos inclusive), nenhum nos dois estruturais');
    await pg.focus('.in-grip[data-grip="dist"]'); await pg.keyboard.press('ArrowUp'); await pg.click('.in-hide[data-k="min"]'); await sleep(250);
    await pg.click('[data-act="in-done"]'); await sleep(250);
    const after = await keys(); ok(after !== before && !after.split(',').includes('min') && after.split(',').indexOf('dist') < before.split(',').indexOf('dist'), 'ui: reordenar e ocultar valem na hora');
    /* indicadores do painel: cada um é um card; todos podem ser ocultados, movidos e readicionados */
    await pg.click('[data-act="in-cust"]'); await sleep(250);
    for (const k of ['ind-media', 'ind-tend', 'ind-var', 'ind-faixa']) await pg.click(`.in-hide[data-k="${k}"]`);
    await sleep(250); ok(await q('.pn-ed .in-ind') === 0 && await q('.in-grip') === 16, 'ui: todos os indicadores podem ser ocultados (inclusive o último)');
    await pg.click('[data-act="in-done"]'); await sleep(250); ok(await q('.in-ind') === 0 && await q('.in-pc') === 1 && await q('.in-hero') === 1, 'ui: sem indicadores, o resto do Início segue normal');
    await pg.click('[data-act="in-cust"]'); await pg.click('[data-act="in-avt"]'); await sleep(350);
    ok(await q('.in-av-add[data-k="ind-hipo"]') === 1 && await q('.in-av-add[data-k="ind-media"]') === 1, 'ui: indicadores ocultos aparecem em Cards disponíveis');
    await pg.click('.in-av-add[data-k="ind-hipo"]'); await sleep(250); await pg.click('.in-av-add[data-k="ind-media"]'); await sleep(250);
    await pg.click('[data-act="in-done"]'); await sleep(250); ok(await q('.in-ind') === 2 && /Abaixo de/.test(await txt('.pn-grid')), 'ui: readicionar indicadores pelo Cards disponíveis');
    const snap = await keys(); await pg.reload(); await sleep(1000); try { await pg.getByText('Continuar sem conta').click({ timeout: 1000 }); } catch (e) { } await noGate(pg);
    const kept = await keys(); ok(kept === snap && kept !== after && await q('.in-ind') === 2 && /Abaixo de/.test(await txt('.pn-grid')), 'ui: preferências persistem depois de reabrir');
    await pg.click('[data-act="in-cust"]'); await pg.click('[data-act="in-reset"]'); await pg.click('[data-act="in-reset-ok"]'); await sleep(250); await pg.click('[data-act="in-done"]'); await sleep(200); ok(await keys() === before && !/Abaixo de/.test(await txt('.pn-grid')) && await q('.in-ind') === 4, 'ui: restaurar organização padrão');
    ok(await q('.in-hero') === 1 && await q('.in-pc') === 1 && await q('.mt-blk') === 1 && await q('.nav-in') === 1, 'ui: elementos essenciais continuam mesmo com tudo personalizável');
    /* tema claro e escuro: nenhum texto invisível nos elementos novos */
    for (const th of ['dark', 'light']) { await pg.evaluate(t => setTheme(t), th); await sleep(200);
      const bad = await pg.evaluate(() => { const bg = c => { const m = c.match(/[\d.]+/g).map(Number); return m; }, out = []; document.querySelectorAll('.in-hero, .in-ev, .in-sc, .in-day').forEach(el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') out.push(el.className); }); return out; }); ok(!bad.length, 'ui: tema ' + th + ': blocos visíveis');
      const lum = await pg.evaluate(() => { const c = getComputedStyle(document.querySelector('.in-sum')).color.match(/\d+/g).map(Number), b = (() => { for (let e = document.querySelector('.in-sum'); e; e = e.parentElement) { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number); if (m.length < 4 || m[3] > 0.9) return m; } return [255, 255, 255]; })(); const L = a => (0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]) / 255; return Math.abs(L(c) - L(b)); }); ok(lum > 0.5, 'ui: tema ' + th + ': contraste do texto do resumo (' + lum.toFixed(2) + ')'); }
    await pg.evaluate(() => setTheme('dark'));
    /* atualização após novo registro: a última glicemia e o resumo mudam */
    const b0 = await txt('.in-last-v'); await pg.evaluate(async () => { const d = isoDate(new Date()), t = new Date(); const hm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); await Store.put('records', { id: 'new1', date: d, time: hm, ts: mkTs(d, hm), glucose: 233, context: 'antes', meal: 'almoco', source: 'manual' }); await loadAll(); render(); }); await sleep(1300); /* o número do Resumo glicêmico sobe até o valor em 1 s */
    ok(/233/.test(await txt('.in-last-v')) && await txt('.in-last-v') !== b0 && /1\s*$/.test((await txt('.in-rs-m .in-rs-c:nth-child(2) b')).trim()) && /233/.test(await txt('.in-rs-m .in-rs-c:first-child b')), 'ui: Resumo glicêmico atualiza depois de um novo registro (última, média e registros do dia)');
    ok(await q('.in-sc [data-act="in-hist"]') === 1 && await q('.in-sc [data-act="new"][data-ctx="depois"]') === 1, 'ui: atalhos contextuais aparecem depois do registro (histórico e acompanhamento da refeição)');
    await pg.click('.in-sc [data-act="in-hist"]'); await sleep(400); ok(await pg.evaluate(() => S.route) === 'historico', 'ui: atalho leva ao histórico');
  });
  await run('poucos registros', `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const d = isoDate(new Date(Date.now() - 20 * 86400000)); await Store.putMany('records', [{ id: 'f1', date: d, time: '08:00', ts: mkTs(d, '08:00'), glucose: 105, context: 'jejum', source: 'manual' }, { id: 'f2', date: d, time: '12:00', ts: mkTs(d, '12:00'), glucose: 140, source: 'manual' }]); await loadAll(); S.route = 'painel'; render(); })()`, async pg => {
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s), txt = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
    ok(await q('.in-hero') === 1 && await q('.in-stale') === 1 && /Sem medições há/.test(await txt('.in-stale')), 'ui: sem medições recentes → aviso discreto com atalho para nova medição');
    ok(!await q('.in-ev'), 'ui: sem acontecimentos relevantes, o card não aparece (nada de enchimento)');
    const indTxt = await pg.evaluate(() => [...document.querySelectorAll('.in-ind')].map(e => e.textContent).join(' | ')); ok(/—/.test(indTxt) && /sem dados suficientes|precisa de|sem medições/.test(indTxt), 'ui: indicadores sem base mostram "—" e explicam');
    ok(await q('.in-exa') === 1 && /Nenhum exame/.test(await txt('.in-exa')), 'ui: ausência de exames tratada');
    ok(await q('.in-day') === 1 && /Nenhuma medição hoje/.test(await txt('.in-day')), 'ui: dia sem medições');
  });
  await run('dados incompletos', `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const t = new Date(), d = isoDate(t), hm = String(t.getHours()).padStart(2, '0') + ':00'; await Store.putMany('records', [{ id: 'n1', date: d, time: '', noTime: true, ts: mkTs(d, '12:00'), glucose: 99, source: 'manual' }, { id: 'n2', date: d, time: hm, ts: mkTs(d, hm), glucose: 301, source: 'manual' }]); await Store.put('exams', { id: 'x1', date: d, title: 'Exame', items: [], addedAt: Date.now() }); await loadAll(); S.route = 'painel'; render(); })()`, async pg => {
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s);
    ok(await q('.in-hero') === 1 && await q('.in-day .in-tli') === 2 && await q('.in-exa') === 1, 'ui: registro sem horário e exame sem itens não quebram a tela');
    ok(await q('.in-sc [data-act="ex-open"]') === 1, 'ui: exame novo → atalho para ver os resultados');
  });
  await run('tela estreita', seedBase, async pg => {
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(over <= 1, 'responsivo: sem rolagem horizontal em 320 px (' + over + ')');
    const clip = await pg.evaluate(() => [...document.querySelectorAll('.in-ind, .in-evi, .in-chip')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'hidden').length); ok(clip === 0, 'responsivo: nada estoura a largura (' + clip + ')');
  }, { viewport: { width: 320, height: 640 } });
  end();
})();
function end() { console.log(fail ? `${fail} falha(s) em ${n}` : `test27 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
