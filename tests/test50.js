// test50: Resumo glicêmico redesenhado (só o dia atual, recolhido/expandido) e filtro de período independente.
const C = require('../src/inicio-core.js'), L = require('../src/logic.js'), fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
/* ---- lógica pura: inToday ---- */
const NOW = new Date(2026, 10, 24, 17, 30, 0).getTime(), D = 86400000, iso = ms => L.isoDate(new Date(ms));
let id = 0; const rec = (daysAgo, hm, g, o = {}) => { const d = iso(NOW - daysAgo * D), ts = L.mkTs(d, hm); return { id: 'r' + (++id), date: d, time: hm, ts, glucose: g, context: 'antes', source: 'manual', ...o }; };
let T = C.inToday([], NOW);
ok(T.n === 0 && T.last === null && T.mean === null && T.min === null && T.max === null && T.inN === 0 && T.outN === 0 && T.items.length === 0, 'dia vazio: nada é inventado');
T = C.inToday([rec(1, '10:00', 300), rec(2, '10:00', 50)], NOW); ok(T.n === 0 && T.last === null, 'medições de outros dias não entram');
T = C.inToday([rec(0, '08:00', 143, { context: 'depois' })], NOW);
ok(T.n === 1 && T.last.glucose === 143 && T.mean === 143 && T.min === 143 && T.max === 143 && T.inN === 1 && T.outN === 0, 'uma medição: média, menor e maior iguais ao registro');
const day = [rec(0, '07:00', 95, { context: 'jejum' }), rec(0, '16:45', 134), rec(0, '12:30', 210), rec(0, '15:00', 62), rec(0, '09:30', 160, { context: 'depois' }), rec(0, '11:00', 30, { source: 'exemplo' }), rec(1, '23:59', 400), rec(-1, '00:00', 90)];
T = C.inToday(day, NOW);
ok(T.n === 5 && T.last.time === '16:45' && T.items.map(r => r.time).join() === '16:45,15:00,12:30,09:30,07:00', 'várias: só hoje, só reais, ordem decrescente (mais recente primeiro)');
ok(Math.abs(T.mean - 132.2) < 1e-9 && T.min === 62 && T.max === 210 && T.inN === 3 && T.outN === 2, 'várias: média, menor/maior e dentro/fora da faixa configurada');
ok(C.inToday(day, L.mkTs(iso(NOW + D), '00:01')).n === 1 && C.inToday(day, L.mkTs(iso(NOW + D), '00:01')).last.glucose === 90 && C.inToday(day, L.mkTs(iso(NOW), '23:59')).n === 5, 'virada do dia: a data local define o conjunto (00:01 do dia seguinte só enxerga o dia seguinte)');
const m0 = C.inSituation(day, NOW, 30, null);
ok(/Última medição/.test(C.inSummary(m0)) && !/Última medição/.test(C.inSummary(m0, { noLast: true })) && /Média de 30 dias/.test(C.inSummary(m0, { noLast: true })), 'texto do período não repete a última medição, mas mantém a parte histórica');
const si = fs.readFileSync(ROOT + '/src/inicio.js', 'utf8'), sc = fs.readFileSync(ROOT + '/src/inicio.css', 'utf8'), pn = fs.readFileSync(ROOT + '/src/painel2.js', 'utf8');
ok(/inHero\(\) \+ inStale\(M\) \+ `<div class="pn-grid/.test(pn) && /C\.per = inPeriodo\(M\)/.test(pn) && require('../src/inicio-core.js').IN_DEF().order[0] === 'per', 'tela: filtro (card Período de análise) é o primeiro card, logo abaixo do Resumo glicêmico');
const heroFn = si.slice(si.indexOf('function inHero()'), si.indexOf('function inStale'));
ok(!/S\.period|data-act="period"|inSituation|inModel/.test(heroFn), 'Resumo glicêmico não lê o período (7/30/90)');
ok(/gzFrac\('ult'/.test(si) && /GZ_ZONES/.test(si) && !/Math\.random/.test(si), 'barra reaproveita a lógica do mostrador existente (GZ, GZ_ZONES, gzFrac)');

/* ---- navegador ---- */
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada: playwright ausente'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms));
  execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const HTML = 'file://' + ROOT + '/www/index.html';
  const run = async (name, seedFn, fn, opt = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'in50-')), ctx = await chromium.launchPersistentContext(dir, Object.assign({}, devices['Pixel 7'], opt)), pg = ctx.pages()[0] || await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); await pg.goto(HTML); await sleep(1000); try { await pg.getByText('Continuar sem conta').click({ timeout: 1500 }); } catch (e) { }
    await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } });
    await pg.evaluate(seedFn); await sleep(400); await fn(pg); ok(!errs.length, name + ': sem erros de JavaScript' + (errs.length ? ' (' + errs[0] + ')' : '')); await ctx.close();
  };
  const SEED = `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const today = new Date(); today.setHours(0, 0, 0, 0); const recs = [];
    for (let i = 89; i >= 1; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const date = isoDate(d); const g = i <= 7 ? 100 : i <= 30 ? 160 : 220; [['07:00', g], ['12:30', g + 10]].forEach(([t, v], j) => recs.push({ id: 'o' + i + '_' + j, date, time: t, ts: mkTs(date, t), glucose: v, context: 'antes', source: 'manual' })); }
    const date = isoDate(today), mk = (idn, t, g, o = {}) => ({ id: idn, date, time: t, ts: mkTs(date, t), glucose: g, source: 'manual', ...o });
    recs.push(mk('t1', '07:00', 95, { context: 'jejum' }), mk('t2', '09:30', 160, { context: 'depois', meal: 'cafe' }), mk('t3', '12:30', 210, { context: 'antes', meal: 'almoco' }), mk('t4', '15:00', 62, { context: 'antes' }), mk('t5', '16:45', 134, { context: 'antes', meal: 'lanche' }));
    await Store.putMany('records', recs); await loadAll(); S.route = 'painel'; S.period = 7; render(); })()`;
  await run('com medições hoje', SEED, async pg => {
    /* toque real: centraliza o alvo e clica nas coordenadas (o cartão usa uma área de toque esticada, que o click() por seletor recusa) */
    const tap = async s => { await pg.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), s); await sleep(120); const b = await pg.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, s); await pg.mouse.click(b.x, b.y); await sleep(760); /* trava anti-toque duplo dos botões (0,7 s) */ };
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s), txt = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s), vis = s => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.height > 4 && cs.visibility !== 'hidden'; }, s);
    await sleep(1400); /* o número sobe até o valor em ~1 s */
    /* recolhido */
    ok(/Resumo glicêmico/.test(await txt('.in-rs-t')) && /Hoje/.test(await txt('.in-rs-d')), 'recolhido: título e identificação do dia atual');
    ok(/Última glicemia registrada/.test(await txt('.in-last-k')) && /^134/.test((await txt('.in-last-v')).trim()) && /mg\/dL/.test(await txt('.in-last-v')), 'recolhido: última glicemia identificada, em destaque, com unidade (134, a mais recente de hoje)');
    ok(/16:45/.test(await txt('.in-when')) && /Antes/i.test(await txt('.in-when .tag')) && await q('.in-last .badge') === 1, 'recolhido: horário, contexto e classificação');
    ok(await q('.in-hero .in-rb') === 1 && await q('.in-rb-mk') === 1 && await q('.in-rb-z') === 5 && (await txt('.in-rb-t')).replace(/\s/g, '') === '701802504 00'.replace(/\s/g, ''), 'barra: 5 segmentos, marcador único e marcações 70 · 180 · 250 · 400');
    const pos = await pg.evaluate(() => document.querySelector('.in-rb').style.getPropertyValue('--p')); ok(Math.abs(parseFloat(pos) - (134 - 30) / 570 * 100) < 0.05, 'barra: marcador na posição da última glicemia (' + pos + ')');
    ok(/132,2/.test(await txt('.in-rs-m .in-rs-c:nth-child(1)')) && /^5/.test((await txt('.in-rs-m .in-rs-c:nth-child(2) b')).trim()), 'recolhido: média do dia (não a última) e quantidade de registros');
    ok(!(await vis('.in-rs-list .rec')) && await pg.getAttribute('.in-rs-tg', 'aria-expanded') === 'false', 'recolhido: lista escondida');
    const hCol = await pg.evaluate(() => document.querySelector('.in-hero').getBoundingClientRect().height);
    ok(await q('.in-hero [data-act="period"]') === 0 && await q('.in-hero .seg') === 0 && await q('.in-hero .in-sum') === 0 && await q('.in-hero .in-ind') === 0, 'recolhido: sem filtro, médias históricas, tendência, variabilidade, % na faixa ou texto automático dentro do card');
    /* o filtro é independente e vem logo abaixo */
    ok(await pg.evaluate(() => { const h = document.querySelector('.in-hero'), p = document.querySelector('.in-pc'); const g = document.querySelector('.pn-grid'); return !h.contains(p) && !!p.querySelector('.seg') && g.firstElementChild === p && (h.nextElementSibling === g || h.nextElementSibling.nextElementSibling === g); }), 'filtro: fora do card, logo abaixo');
    /* toque em qualquer ponto do cartão expande, sem navegar */
    const route0 = await pg.evaluate(() => S.route), y0 = await pg.evaluate(() => scrollY);
    await tap('.in-hero .in-rb-t'); await sleep(450);
    ok(await pg.getAttribute('.in-rs-tg', 'aria-expanded') === 'true' && await vis('.in-rs-list .rec') && await pg.evaluate(() => S.route) === route0, 'expandido: toque na barra expande o cartão sem trocar de página');
    ok(await q('.in-rs-list .rec') === 5 && (await pg.evaluate(() => [...document.querySelectorAll('.in-rs-list .rec .tm')].map(e => e.textContent.trim()).join())) === '16:45,15:00,12:30,09:30,07:00', 'expandido: todos os registros de hoje, do mais recente ao mais antigo');
    const row = await txt('.in-rs-list .rec:nth-child(3)'); ok(/12:30/.test(row) && /210/.test(row) && /Elevada/.test(row) && /Antes/i.test(row) && /Almoço/i.test(row), 'expandido: horário, valor, classificação e contexto (' + row.replace(/\s+/g, ' ').trim() + ')');
    ok(await q('.in-hero .in-rb') === 1 && await q('.in-hero .in-last') === 1 && await q('.in-hero .in-rs-m') === 1, 'expandido: elementos do recolhido preservados, sem duplicar a barra');
    const st = await txt('.in-rs-st').then(s => s.replace(/\s+/g, ' '));
    ok(/Menor\s*62/.test(st) && /Maior\s*210/.test(st) && /Na faixa\s*3/.test(st) && /Fora da faixa\s*2/.test(st), 'expandido: menor, maior, dentro e fora da faixa (' + st.trim() + ')');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'expandido: sem rolagem horizontal');
    /* filtro: três opções, sem mexer no Resumo */
    const heroTxt = await pg.evaluate(() => document.querySelector('.in-hero').innerText), ranges = [], periods = [];
    for (const p of [30, 90, 7]) {
      await pg.click(`.in-pc [data-act="period"][data-p="${p}"]`); await sleep(350);
      periods.push(await pg.evaluate(() => S.period)); ranges.push(await txt('.in-per-r'));
      ok(await pg.evaluate(p => document.querySelector(`.in-pc [data-act="period"][data-p="${p}"]`).getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.in-pc [aria-pressed="true"]').length === 1, p), 'filtro ' + p + ' dias: opção selecionada e destacada');
      ok(await pg.evaluate(() => document.querySelector('.in-hero').innerText) === heroTxt && await pg.getAttribute('.in-rs-tg', 'aria-expanded') === 'true', 'filtro ' + p + ' dias: Resumo glicêmico não muda (nem recolhe)');
      const sub = await txt('.in-ind .in-ind-s'), med = await txt('.pn-med'); ok(new RegExp(p + ' dias').test(sub + (await txt('.in-sum'))) && new RegExp(p + ' dias').test(med + (await txt('.pn-evo'))), 'filtro ' + p + ' dias: indicadores e cartões históricos acompanham o período');
    }
    ok(periods.join() === '30,90,7' && new Set(ranges).size === 3 && ranges.every(r => /\d\d\/\d\d\s*–\s*\d\d\/\d\d/.test(r)), 'filtro: intervalo de datas muda com o período (' + ranges.join(' | ') + ')');
    const mean7 = await pg.evaluate(() => document.querySelector('.in-ind .in-ind-v') && document.querySelector('.in-ind .in-ind-v').textContent);
    await pg.click('.in-pc [data-act="period"][data-p="90"]'); await sleep(300); ok(await pg.evaluate(() => document.querySelector('.in-ind .in-ind-v').textContent) !== mean7, 'filtro: a média do período muda de 7 para 90 dias');
    /* recolher */
    await tap('.in-rs-less'); await sleep(450); ok(await pg.getAttribute('.in-rs-tg', 'aria-expanded') === 'false' && !(await vis('.in-rs-list .rec')), 'controle: "Recolher" fecha o cartão');
    await tap('.in-rs-tg'); await sleep(400); ok(await pg.getAttribute('.in-rs-tg', 'aria-expanded') === 'true', 'controle: o título também expande'); await tap('.in-hero .in-last-v'); await sleep(400); ok(await pg.getAttribute('.in-rs-tg', 'aria-expanded') === 'false', 'controle: novo toque recolhe');
    /* abrir um registro da lista abre a edição, não recolhe por engano */
    await tap('.in-rs-tg'); await sleep(400); await tap('.in-rs-list .rec:nth-child(2)'); await sleep(500); ok(await q('#sheet-bg') === 1 || await pg.evaluate(() => S.route) !== 'painel', 'lista: tocar num registro abre os detalhes dele'); await pg.evaluate(() => { try { closeSheet(); } catch (e) { } });
    /* atualização automática: inclusão, edição e exclusão */
    await pg.evaluate(async () => { const d = isoDate(new Date()); await Store.put('records', { id: 't6', date: d, time: '17:10', ts: mkTs(d, '17:10'), glucose: 301, context: 'depois', source: 'manual' }); await loadAll(); render(); }); await sleep(1300);
    ok(/301/.test(await txt('.in-last-v')) && /^6/.test((await txt('.in-rs-m .in-rs-c:nth-child(2) b')).trim()) && await q('.in-rs-list .rec') === 6, 'inclusão: última, registros e lista atualizam');
    await pg.evaluate(async () => { const r = S.records.find(x => x.id === 't6'); await Store.put('records', { ...r, glucose: 111 }); await loadAll(); render(); }); await sleep(1300);
    ok(/111/.test(await txt('.in-last-v')) && /128,7/.test(await txt('.in-rs-m .in-rs-c:nth-child(1) b')), 'edição: valor e média do dia atualizam');
    await pg.evaluate(async () => { await Store.del('records', 't6'); await Store.del('records', 't5'); await loadAll(); render(); }); await sleep(1300);
    ok(/^62/.test((await txt('.in-last-v')).trim()) && /^4/.test((await txt('.in-rs-m .in-rs-c:nth-child(2) b')).trim()) && await q('.in-rs-list .rec') === 4, 'exclusão: a última passa a ser a anterior e a contagem cai');
    /* tamanhos de tela */
    for (const [w, h] of [[320, 640], [360, 740], [412, 915], [768, 1024]]) {
      await pg.setViewportSize({ width: w, height: h }); await sleep(250);
      for (const open of [false, true]) {
        await pg.evaluate(o => { const s = document.querySelector('.in-hero'); if (s.classList.contains('open') !== o) s.querySelector('.in-rs-tg').click(); }, open); await sleep(400);
        const r = await pg.evaluate(() => { const hh = document.querySelector('.in-hero').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, l: hh.left, r: hh.right, over: [...document.querySelectorAll('.in-hero *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).length }; });
        ok(r.sw <= r.iw && r.over === 0, `tela ${w}px ${open ? 'expandido' : 'recolhido'}: sem estouro horizontal`);
      }
    }
    await pg.setViewportSize({ width: 412, height: 915 }); await pg.evaluate(() => { const s = document.querySelector('.in-hero'); if (s.classList.contains('open')) s.querySelector('.in-rs-tg').click(); }); await sleep(450);
    for (const th of ['dark', 'light']) { await pg.evaluate(t => setTheme(t), th); await sleep(300); await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: path.join(process.env.SHOT_DIR || os.tmpdir(), `rs-${th}-recolhido.png`) }); }
    ok(hCol > 0, 'altura recolhida medida: ' + Math.round(hCol) + 'px');
  });
  await run('sem medições hoje', `(async () => { await Store.put('meta', { id: 'seeded', at: 1 }); await removeExamples(); const t = new Date(Date.now() - 3 * 86400000), d = isoDate(t); await Store.putMany('records', [{ id: 'a1', date: d, time: '08:00', ts: mkTs(d, '08:00'), glucose: 150, context: 'antes', source: 'manual' }, { id: 'a2', date: d, time: '12:00', ts: mkTs(d, '12:00'), glucose: 180, source: 'manual' }]); await loadAll(); S.route = 'painel'; render(); })()`, async pg => {
    const q = s => pg.evaluate(s => document.querySelectorAll(s).length, s), txt = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s);
    ok(/Nenhuma medição hoje/.test(await txt('.in-hero')) && /Última glicemia registrada/.test(await txt('.in-hero')), 'vazio: estado apropriado, sem inventar valor');
    ok(await q('.in-rb.none') === 1 && await q('.in-rb-mk') === 0 && await q('.in-rb-z.on') === 0 && await q('.in-rb-z') === 5, 'vazio: barra neutra e sem marcador');
    ok(/—/.test(await txt('.in-rs-m .in-rs-c:nth-child(1) b')) && /^0/.test((await txt('.in-rs-m .in-rs-c:nth-child(2) b')).trim()), 'vazio: média "—" e 0 registros');
    ok(await q('.in-rs-tg') === 0 && await q('.in-rs-list') === 0 && !/Menor/.test(await txt('.in-hero')), 'vazio: nada para expandir, sem estatísticas inventadas');
    ok(await q('.in-pc [data-act="period"]') === 3, 'vazio: filtro continua acessível'); await pg.click('.in-pc [data-act="period"][data-p="30"]'); await sleep(300); ok(await pg.evaluate(() => S.period) === 30 && /Nenhuma medição hoje/.test(await txt('.in-hero')), 'vazio: filtro funciona e o Resumo continua só com hoje');
  });
  await run('dia anterior na Evolução do dia', SEED, async pg => {
    const tap = async s => { await pg.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), s); await sleep(120); const b = await pg.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, s); await pg.mouse.click(b.x, b.y); await sleep(760); /* trava anti-toque duplo dos botões (0,7 s) */ };
    await sleep(1400); const txt = s => pg.evaluate(s => (document.querySelector(s) || {}).textContent || '', s), before = await pg.evaluate(() => document.querySelector('.in-hero').innerText);
    await tap('.in-day [data-act="day-prev"]'); await sleep(350);
    ok(await pg.evaluate(() => document.querySelector('.in-hero').innerText) === before && /Hoje/.test(await txt('.in-rs-d')), 'navegar para ontem na Evolução do dia não muda o Resumo glicêmico (continua em hoje)');
  });
  end();
  function end() { console.log(fail ? `test50: ${fail} falha(s) em ${n}` : `test50 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
})();
