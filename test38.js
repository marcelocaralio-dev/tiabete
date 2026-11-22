// test38: recorde pessoal de dias seguidos em cada conquista (0.37.0). Navegador real (Chromium), app compilado.
const fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* estático */
const cw = rd('src/conquistas2.js'), lg = rd('src/logic.js');
ok(/best, bestEnd/.test(lg) && /best, bestEnd/.test(cw), 'cálculo devolve a maior sequência histórica (padrão e personalizadas)');
ok(/S\.rw\.rec\[chave\]/.test(cw) && /rwRecSync/.test(rd('src/extras.js')), 'recorde guardado por chave dentro de S.rw (backup/Drive) e atualizado por rewardCheck');
ok(/conquistas-rec\.css/.test(rd('scripts/build-web.js')), 'CSS incluído no build');
ok(!/rec\[[^\]]+\]\s*=\s*\{\s*n:\s*0/.test(cw) && !/delete (st|s|cur)\.rec\s*[;\n]/.test(cw), 'nunca grava recorde zero nem apaga o mapa inteiro');
(async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada: playwright ausente'); console.log(fail ? 'test38 FALHOU (' + fail + ')' : 'test38 ok (' + n + ' verificações, sem navegador)'); process.exit(fail ? 1 : 0); } const { execSync } = require('child_process'); execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c38-'));
  const open = async w => { const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: w || 400, height: 860 } }), pg = ctx.pages()[0] || await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
    await pg.goto('file://' + ROOT + '/www/index.html'); await pg.waitForFunction(() => typeof S !== 'undefined' && S.irReady === true, null, { timeout: 15000 }); await sleep(600); await pg.addStyleTag({ content: '#rw-bg,#tb-gate,#tb-splash{display:none!important;pointer-events:none!important}*{transition:none!important;animation:none!important}' }); await pg.evaluate(() => { window.__day = o => isoDate(new Date(addDays(Date.now(), -o))); }); return { ctx, pg }; };
  let { ctx, pg } = await open();
  /* histórico: A = 10 dias bons (com um dia de glicemia 200 no meio, que quebra só "até 180"), 1 dia sem medição, e depois 4 dias bons até ontem */
  const seed = () => pg.evaluate(() => {
    const day = o => isoDate(new Date(addDays(Date.now(), -o))), recs = []; let i = 0;
    const add = (o, g, ctxo) => recs.push({ id: 'r' + (i++), date: day(o), time: '08:00', ts: mkTs(day(o), '08:00'), glucose: g, context: ctxo || 'antes', source: 'manual' });
    for (let o = 34; o >= 25; o--) add(o, o === 30 ? 200 : 100); for (let o = 4; o >= 1; o--) add(o, 100);
    S.records = recs; window.__day = day;
  });
  await seed();
  const ev = () => pg.evaluate(() => { const e = rwEval(); return { hypo: [e.hypo.streak, e.hypo.best], norm: [e.norm.streak, e.norm.best], fast: [e.fast.streak, e.fast.best] }; });
  let e = await ev();
  ok(e.hypo[0] === 4 && e.hypo[1] === 10, 'sem hipoglicemia: atual 4, recorde 10 (' + e.hypo + ')');
  ok(e.norm[0] === 4 && e.norm[1] === 5, 'até 180: atual 4, recorde 5; um dia de 200 quebra só esta conquista (' + e.norm + ')');
  ok(e.fast[0] === 0 && e.fast[1] === 0, 'jejum: sem medições de jejum, sem recorde (' + e.fast + ')');
  await pg.evaluate(() => { const s = rwState(); s.off = {}; return rewardCheck(); }); await sleep(900);
  let rec = await pg.evaluate(() => JSON.parse(JSON.stringify(S.rw.rec || {})));
  ok(rec.hypo && rec.hypo.n === 10 && rec.norm && rec.norm.n === 5 && !rec.fast, 'recordes gravados por conquista, independentes (' + JSON.stringify(Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.n]))) + ')');
  ok(rec.hypo.end === await pg.evaluate(() => __day(25)), 'guarda o último dia da melhor sequência');
  /* tela */
  await pg.evaluate(() => { S.route = 'conquistas'; render(); }); await sleep(300);
  const CARDS = () => [...document.querySelectorAll('.cw-card')].map(c => ({ t: c.querySelector('[data-k]').dataset.k, rec: (c.querySelector('.rw-rec') || {}).textContent || null, cur: c.querySelector('div.num') && c.querySelector('div.num').textContent }));
  const cards = await pg.evaluate(CARDS), byT = t => cards.find(c => c.t === t);
  ok(/Recorde\s*10 dias/.test(byT('hypo').rec) && byT('hypo').cur.trim() === '4', 'card "Sem hipoglicemia": sequência atual 4 e recorde 10 dias, separados');
  ok(/Recorde\s*5 dias/.test(byT('norm').rec), 'card "Glicemia até 180": recorde 5 (não herda o de outra conquista)');
  ok(/Recorde\s*—/.test(byT('fast').rec), 'card sem histórico mostra recorde vazio');
  ok(await pg.evaluate(() => !!document.querySelector('.rw-rec svg') && document.querySelector('.rw-rec').getAttribute('aria-label').includes('Recorde pessoal')), 'troféu e rótulo acessível');
  /* perder a sequência atual não mexe no recorde */
  await pg.evaluate(() => { S.records.push({ id: 'bad', date: __day(0), time: '07:00', ts: mkTs(__day(0), '07:00'), glucose: 55, context: 'jejum', source: 'manual' }); });
  await pg.evaluate(() => rewardCheck()); await sleep(600); e = await ev();
  ok(e.hypo[0] === 0, 'hipoglicemia hoje zera a sequência atual');
  rec = await pg.evaluate(() => S.rw.rec); ok(rec.hypo.n === 10, 'recorde continua 10 depois de perder a sequência');
  await pg.evaluate(() => { S.route = 'conquistas'; render(); }); await sleep(200);
  ok(/10 dias/.test(await pg.evaluate(() => document.querySelector('.cw-card .rw-rec').textContent)), 'tela continua mostrando 10');
  /* apagar registros antigos (que gerariam o recorde) também não reduz o valor guardado */
  await pg.evaluate(() => { S.records = S.records.filter(r => r.id === 'bad'); return rewardCheck(); }); await sleep(600);
  ok(await pg.evaluate(() => S.rw.rec.hypo.n) === 10 && /10 dias/.test(await pg.evaluate(() => { S.route = 'conquistas'; render(); return document.querySelector('.cw-card .rw-rec').textContent; })), 'recorde sobrevive mesmo sem os registros antigos');
  /* fechar e reabrir */
  await ctx.close(); ({ ctx, pg } = await open());
  ok(await pg.evaluate(() => S.rw && S.rw.rec && S.rw.rec.hypo && S.rw.rec.hypo.n) === 10, 'depois de fechar e reabrir o app o recorde continua salvo');
  await pg.evaluate(() => { S.route = 'conquistas'; render(); }); await sleep(300);
  ok(/10 dias/.test(await pg.evaluate(() => document.querySelector('.cw-card .rw-rec').textContent)), 'e aparece na tela depois de reabrir');
  /* superar: nova sequência de 12 dias */
  await pg.evaluate(() => { const day = o => isoDate(new Date(addDays(Date.now(), -o))); S.records = []; for (let o = 12; o >= 1; o--) S.records.push({ id: 'n' + o, date: day(o), time: '08:00', ts: mkTs(day(o), '08:00'), glucose: 110, context: 'antes', source: 'manual' }); return rewardCheck(); }); await sleep(800);
  rec = await pg.evaluate(() => JSON.parse(JSON.stringify(S.rw.rec)));
  ok(rec.hypo.n === 12 && rec.norm.n === 12, 'superar o recorde atualiza o valor (12)');
  await pg.evaluate(() => { S.route = 'conquistas'; render(); }); await sleep(250);
  ok(await pg.evaluate(() => document.querySelector('.cw-card .rw-rec.now') !== null), 'sequência atual igual ao recorde ganha o destaque "now"');
  /* personalizadas: histórico próprio, regra mudou recalcula, excluir remove, "acumular" não tem recorde */
  await pg.evaluate(() => { cwList().push(cwClean({ id: 'cwA', name: 'Faixa estreita', type: 'seq', goal: 3, lo: 90, hi: 120, from: __day(40) })); cwList().push(cwClean({ id: 'cwB', name: 'Acumular', type: 'cont', goal: 5, lo: 70, hi: 180, from: __day(40) })); return rewardCheck(); }); await sleep(800);
  rec = await pg.evaluate(() => JSON.parse(JSON.stringify(S.rw.rec)));
  ok(rec['c:cwA'] && rec['c:cwA'].n === 12 && !rec['c:cwB'], 'personalizada de sequência tem recorde próprio; "acumular medições" não tem');
  await pg.evaluate(() => { S.records.forEach(r => { if (r.id === 'n5') r.glucose = 150; }); return rewardCheck(); }); await sleep(600);
  rec = await pg.evaluate(() => JSON.parse(JSON.stringify(S.rw.rec)));
  ok(rec['c:cwA'].n === 12 && rec.hypo.n === 12, 'a personalizada e a padrão não se misturam (a faixa estreita quebra, a padrão não)');
  await pg.evaluate(() => { S.route = 'conquistas'; render(); }); await sleep(250);
  const cardsC = await pg.evaluate(CARDS);
  ok(cardsC.find(c => c.t === 'c:cwA').rec && !cardsC.find(c => c.t === 'c:cwB').rec, 'tela: recorde na personalizada de sequência e nenhum na de acumular');
  await pg.evaluate(() => { const c = cwFind('cwA'); const L = cwList(); L[L.indexOf(c)] = cwClean({ ...c, lo: 60, hi: 200 }); return rewardCheck(); }); await sleep(600);
  ok(await pg.evaluate(() => S.rw.rec['c:cwA'].sig) === '' + await pg.evaluate(() => rwRecSigOf(cwFind('cwA'))), 'mudar a regra de contagem recalcula o recorde com a regra nova');
  /* restauração: recorde nunca diminui */
  await pg.evaluate(() => cwRestore({ got: {}, rec: { hypo: { n: 40, end: '2026-01-01', sig: '', u: 1 }, norm: { n: 2, end: '2026-01-01', sig: '', u: 1 }, bogus: { n: 9, sig: '' }, fast: { n: -3, sig: '' } } }, false));
  rec = await pg.evaluate(() => JSON.parse(JSON.stringify(S.rw.rec)));
  ok(rec.hypo.n === 40 && rec.norm.n === 12 && !rec.bogus && !rec.fast, 'restaurar backup: vale o maior de cada conquista; chaves e valores inválidos são ignorados');
  await pg.evaluate(() => { const s = rwState(); delete s.cust; s.cust = []; cwList().push(cwClean({ id: 'cwA', name: 'X', type: 'seq', goal: 3, lo: 90, hi: 120 })); });
  await pg.evaluate(() => { cwRestore({ got: {}, cust: [{ id: 'cwA', name: 'X', type: 'seq', goal: 3, lo: 90, hi: 120 }], rec: { 'c:cwA': { n: 7, end: null, sig: 'seq|90|120|todas|1|' + isoDate(new Date()), u: 5 } } }, true); });
  ok(await pg.evaluate(() => Object.keys(S.rw.rec).join()) === 'c:cwA', 'restaurar substituindo: só o que veio do backup');
  /* layout */
  for (const w of [320, 360, 412]) {
    await ctx.close(); ({ ctx, pg } = await open(w)); await pg.evaluate(() => { S.rw.rec = { hypo: { n: 365, end: null, sig: '', u: 1 }, norm: { n: 90, end: null, sig: '', u: 1 } }; S.route = 'conquistas'; render(); }); await sleep(300);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, w + ' px: sem rolagem horizontal');
    ok(await pg.evaluate(() => [...document.querySelectorAll('.rw-rec')].every(r => { const c = r.closest('.cw-card').getBoundingClientRect(), b = r.getBoundingClientRect(); return b.right <= c.right + 0.5 && b.left >= c.left; })), w + ' px: o selo do recorde cabe dentro do cartão');
  }
  ok(!pg.errs.length, 'sem erros de página ' + pg.errs.join(';'));
  await ctx.close();
  console.log(fail ? 'test38 FALHOU (' + fail + ')' : 'test38 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
