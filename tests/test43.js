// test43: navegação contextual das notificações da bolha + botão "Acessar" + layout dos cards. Chromium real (Pixel 7), temas claro e escuro, reinício.
// Audita CADA tipo de notificação (rem, plano, hipo, hiper, basal, jantar, insrem, ca, conq, bkp, drv, mem, ex, confirmações) e garante que nenhum vai às telas de configuração de alertas.
process.removeAllListeners('warning');
const path = require('path'), fs = require('fs'), os = require('os');
let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('test43 ignorado: playwright não está instalado'); process.exit(0); }
const SRC = process.env.HTML || path.join(__dirname, '../www/index.html'); if (!fs.existsSync(SRC)) { console.log('test43 ignorado: compile o app web antes'); process.exit(0); }
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } }; const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'acb43-'));
/* cópia do app em que acSources() devolve também os alertas de localStorage['__live'] (objetos completos, como acSources os produz) */
const HTML = DIR + '-app.html'; { let h = fs.readFileSync(SRC, 'utf8'); const k = 'function acSources() {'; if (!h.includes(k)) throw new Error('acSources não encontrada'); h = h.replace(k, k + " let __L = []; try { __L = JSON.parse(localStorage.getItem('__live') || '[]'); } catch (e) { } if (__L.length) return __L.map(x => Object.assign({ cat: 'lembrete', prio: 1, occ: '', rec: '', nav: null, key: x.src + '|' + x.title }, x));"); fs.writeFileSync(HTML, h); }
const CFG = ['lembretes', 'alertasp'];
async function open(file, extra) { const ctx = await chromium.launchPersistentContext(extra && extra.dir || DIR, Object.assign({}, devices['Pixel 7'], extra && extra.vp ? { viewport: extra.vp } : {})), pg = ctx.pages()[0] || await ctx.newPage(); pg._errs = []; pg.on('pageerror', e => pg._errs.push(e.message)); await pg.route('**/fonts.*/**', r => r.abort()); if (extra && extra.time) await pg.clock.setFixedTime(extra.time); await pg.goto('file://' + (file || HTML)); await pg.waitForSelector('#view'); await sleep(1500); await pg.evaluate(() => { for (const i of ['tb-gate', 'tb-splash']) { const e = document.getElementById(i); if (e) e.remove(); } S.irReady = true; }); return [ctx, pg]; }
const B = (t, x) => `<div class="banner"><span><b>${t}.</b> ${x}</span></div>`;
const live = (pg, arr) => pg.evaluate(a => { localStorage.setItem('__live', JSON.stringify(a)); acSync(); }, arr);
const st = pg => pg.evaluate(() => ({ route: S.route, list: acList().map(x => x.title), it: S.ac.items.map(x => ({ t: x.title, r: !!x.read, d: !!x.dismissed })), sheet: !!document.getElementById('sheet-bg'), rec: !!document.getElementById('rec-form'), hypo: !!document.getElementById('hypo-form'), ctx: (document.getElementById('f-ctx') || {}).value, meal: (document.getElementById('f-meal') || {}).value, open: AC.open }));
(async () => {
  let [ctx, pg] = await open();
  await pg.evaluate(() => { acSetMode('bubble'); S.ac.hidden = false; acRefresh(); }); await sleep(300);
  const recId = await pg.evaluate(async () => { const r = { id: 'rec-ca-1', date: isoDate(new Date()), time: '08:00', ts: Date.now() - 3600e3, glucose: 120, context: 'jejum', meal: 'cafe', marks: ['perna'] }; await Store.put('records', r); await loadAll(); return r.id; });
  await pg.evaluate(() => { S.ir.items.push({ id: 'ir-t1', itemId: '', type: 'basal', meal: '', time: '22:00', src: '', days: [], on: true, name: 'Basal teste', flag: '' }); });
  const day = await pg.evaluate(() => isoDate(new Date()));
  /* tipo -> alerta + destino esperado + efeito observável */
  const T = [
    { k: 'rem', o: { src: 'rem', cat: 'lembrete', prio: 2, title: 'Medição', text: 'Ainda sem glicemia antes do almoço hoje (janela 10:00–12:00).', nav: { ctx: 'antes', meal: 'almoco' } }, dest: d => d.a === 'new' && d.p.ctx === 'antes' && d.p.meal === 'almoco' && !d.r, eff: s => s.rec && s.ctx === 'antes' && s.meal === 'almoco' },
    { k: 'plano-medir', o: { src: 'plano', cat: 'plano', prio: 2, title: 'Medir', text: 'Glicemia em jejum · 07:00', nav: { ctx: '', meal: '' } }, dest: d => d.a === 'new', eff: s => s.rec },
    { k: 'plano-trat', o: { src: 'plano', cat: 'plano', prio: 2, title: 'Hora do tratamento', text: 'Metformina · 08:00' }, dest: d => d.r === 'painel' && !d.a, eff: s => s.route === 'painel' && !s.sheet },
    { k: 'hipo', o: { src: 'hipo', cat: 'hipo', prio: 3, title: 'Glicemia baixa', text: '55 mg/dL às 08:00, registrada como hipoglicemia.' }, dest: d => d.a === 'hypo', eff: s => s.hypo },
    { k: 'hiper', o: { src: 'hiper', cat: 'glic', prio: 3, title: 'Glicemia muito elevada', text: '400 mg/dL às 08:00.' }, dest: d => d.a === 'new', eff: s => s.rec },
    { k: 'basal', o: { src: 'basal', cat: 'plano', prio: 2, title: 'Basal', text: 'Já passaram 24 h desde a última dose de basal.' }, dest: d => d.r === 'painel' && d.s === '#ins-basal', eff: s => s.route === 'painel' && !s.sheet },
    { k: 'jantar', o: { src: 'jantar', cat: 'glic', prio: 2, title: 'Pré-jantar', text: 'Sua medição das 17:00 foi 180 mg/dL.' }, dest: d => d.r === 'painel' && d.s === '#ins-r-dinner', eff: s => s.route === 'painel' && !s.sheet },
    { k: 'insrem', o: { src: 'insrem', cat: 'lembrete', prio: 2, title: 'Hora da insulina', text: 'Basal teste · Basal · 22:00', occ: `ir:${day}|ir-t1@22:00` }, dest: d => d.r === 'insrem' && d.a === 'irsheet' && d.p.id === 'ir-t1' && d.p.day === day, eff: s => s.route === 'insrem' && s.sheet },
    { k: 'ca', o: { src: 'ca', cat: 'pers', prio: 2, title: 'Dia de perna', text: 'Confira a medição.', occ: 'ca:regra1|123', rec: recId }, dest: d => d.a === 'record' && d.p.id === recId, eff: s => s.route === 'historico' && s.sheet },
    { k: 'ca-sem-registro', o: { src: 'ca', cat: 'pers', prio: 2, title: 'Meu alerta', text: 'Confira.', occ: 'ca:regra2|456' }, dest: d => d.r === 'historico' && !d.a, eff: s => s.route === 'historico' && !s.sheet },
    { k: 'conq', o: { src: 'conq', cat: 'conquista', prio: 1, title: 'Nova conquista', text: 'Primeira semana.' }, dest: d => d.r === 'conquistas', eff: s => s.route === 'conquistas' },
    { k: 'bkp', o: { src: 'bkp', cat: 'backup', prio: 2, title: 'Cópia', text: 'Faz 9 dias desde a última cópia.' }, dest: d => d.r === 'backup', eff: s => s.route === 'backup' },
    { k: 'drv', o: { src: 'drv', cat: 'backup', prio: 2, title: 'A cópia no Drive falhou', text: 'Sem conexão.' }, dest: d => d.r === 'backup', eff: s => s.route === 'backup' },
    { k: 'mem', o: { src: 'mem', cat: 'atencao', prio: 2, title: 'Armazenamento', text: 'O armazenamento não está disponível.' }, dest: d => d.r === 'backup', eff: s => s.route === 'backup' },
    { k: 'ex', o: { src: 'ex', cat: 'info', prio: 1, title: 'Dados de exemplo', text: 'Eles somem sozinhos.' }, dest: d => d.a === 'new', eff: s => s.rec }
  ];
  for (const how of ['content', 'acessar']) for (const t of T) {
    const title = t.o.title + ' [' + how + '/' + t.k + ']', o = Object.assign({}, t.o, { title, html: B(title, t.o.text) });
    await pg.evaluate(() => { try { closeSheet(); } catch (e) { } go('mais'); }); await sleep(120);
    await live(pg, [o]); await sleep(250); await pg.evaluate(() => { AC.only = null; acOpen(60000); }); await sleep(300);
    const id = await pg.evaluate(t => S.ac.items.find(x => x.title === t).id, title), d = await pg.evaluate(t => S.ac.items.find(x => x.title === t).dest, title);
    ok(d && t.dest(d), `D(${how}/${t.k}): destino gravado correto ${JSON.stringify(d)}`);
    ok(!d || !CFG.includes(d.r), `D(${how}/${t.k}): não aponta para configuração de alertas`);
    const before = await st(pg); ok(before.list.includes(title), `L(${how}/${t.k}): está na lista ativa antes do toque`);
    await pg.click(`#acp [data-ac="${how === 'content' ? 'open' : 'go'}"][data-id="${id}"]`); await sleep(500);
    const s = await st(pg), me = s.it.find(x => x.t === title);
    ok(me && me.r && me.d && !s.list.includes(title), `A(${how}/${t.k}): marcada como lida e removida da lista ativa`);
    ok(t.eff(s), `N(${how}/${t.k}): chegou ao destino certo ${JSON.stringify({ route: s.route, sheet: s.sheet, rec: s.rec, hypo: s.hypo, ctx: s.ctx, meal: s.meal })}`);
    ok(!CFG.includes(s.route), `N(${how}/${t.k}): fora da configuração de alertas (${s.route})`);
    ok(!s.open, `N(${how}/${t.k}): painel recolhido`);
  }
  ok(pg._errs.length === 0, 'E1: sem erros de script: ' + pg._errs.slice(0, 2).join(' | '));
  /* ---- confirmações: voltam à tela onde aconteceram ---- */
  await pg.evaluate(() => { try { closeSheet(); } catch (e) { } go('backup'); S.ac.hidden = false; acToast('Cópia salva de teste.'); go('mais'); }); await sleep(400);
  { const it = await pg.evaluate(() => S.ac.items.find(x => x.text === 'Cópia salva de teste.')); ok(it && it.dest && it.dest.r === 'backup', 'T1: confirmação grava a tela de origem como destino ' + JSON.stringify(it && it.dest));
    await pg.evaluate(() => { AC.only = null; acOpen(60000); }); await sleep(300); await pg.click(`#acp [data-ac="go"][data-id="${it.id}"]`); await sleep(400); const s = await st(pg); ok(s.route === 'backup' && !s.list.includes('Cópia salva de teste.'), 'T2: "Acessar" numa confirmação volta à tela de origem e remove (' + s.route + ')'); }
  /* ---- independência dos três botões ---- */
  await pg.evaluate(() => { go('mais'); S.ac.items = []; }); await live(pg, [1, 2, 3].map(i => ({ src: 'bkp', cat: 'backup', prio: 2, title: 'Ind' + i, text: 'Item ' + i, html: B('Ind' + i, 'Item ' + i), key: 'bkp|Ind' + i }))); await sleep(300); await pg.evaluate(() => { AC.only = null; acOpen(60000); }); await sleep(300);
  const ids = await pg.evaluate(() => ['Ind1', 'Ind2', 'Ind3'].map(t => S.ac.items.find(x => x.title === t).id));
  await pg.click(`#acp [data-ac="read"][data-id="${ids[0]}"]`); await sleep(250); let s = await st(pg);
  ok(s.route === 'mais' && s.list.includes('Ind1') && s.it.find(x => x.t === 'Ind1').r && !s.it.find(x => x.t === 'Ind1').d, 'I1: "Marcar como lida" só marca: continua na lista e não navega');
  await pg.click(`#acp [data-ac="dismiss"][data-id="${ids[1]}"]`); await sleep(600); s = await st(pg);
  ok(s.route === 'mais' && !s.list.includes('Ind2') && s.it.find(x => x.t === 'Ind2').d && !s.sheet, 'I2: "Remover da lista" só remove: não navega e não abre tela');
  const hist = await pg.evaluate(() => { go('alertashist'); const t = document.body.innerText.includes('Ind2'); go('mais'); return t; }); ok(hist, 'I3: histórico geral preserva o item removido');
  /* ---- destino inválido e item legado ---- */
  await pg.evaluate(() => { { AC.only = null; acOpen(60000); }; }); await sleep(300);
  await pg.evaluate(id => { const it = S.ac.items.find(x => x.id === id); it.dest = { v: 2, r: 'rota-inexistente', p: {} }; }, ids[2]);
  await pg.click(`#acp [data-ac="go"][data-id="${ids[2]}"]`); await sleep(400); s = await st(pg);
  ok(s.route === 'mais' && !s.list.includes('Ind3') && s.it.find(x => x.t === 'Ind3').d && pg._errs.length === 0, 'F1: destino inválido: lê e remove, não navega para tela alternativa, não quebra');
  const mig = await pg.evaluate(() => { const L = [
      { id: 'lg1', key: 'rem|x', src: 'rem', cat: 'lembrete', prio: 2, title: 'Medição', text: 'Ainda sem glicemia em jejum hoje (janela 04:00–08:00).', ts: Date.now(), read: false, dismissed: false, active: false, dest: { r: 'lembretes', p: {} } },
      { id: 'lg2', key: 'plano|y', src: 'plano', cat: 'plano', prio: 2, title: 'Medir', text: 'Glicemia · 07:00', ts: Date.now(), read: false, dismissed: false, active: false, dest: { r: 'esquemas', p: {} } },
      { id: 'lg3', key: 'ca|z', src: 'ca', cat: 'pers', prio: 2, title: 'Meu alerta', text: 'x', ts: Date.now(), read: false, dismissed: false, active: false, dest: { r: 'alertasp', p: {} } },
      { id: 'lg4', key: 'rem|w', src: 'rem', cat: 'lembrete', prio: 2, title: 'Medição', text: 'Ainda sem glicemia antes do jantar hoje.', ts: Date.now(), read: false, dismissed: false, active: false }];
    acLoad({ mode: 'bubble', items: L }); return S.ac.items.map(x => x.dest); });
  ok(mig[0] && mig[0].a === 'new' && mig[0].p.ctx === 'jejum' && mig[0].p.meal === 'cafe', 'G1: item antigo "Medição" (dest lembretes) é corrigido para nova glicemia em jejum: ' + JSON.stringify(mig[0]));
  ok(mig[1] && mig[1].a === 'new', 'G2: item antigo "Medir" vai para nova glicemia');
  ok(mig[2] && mig[2].r === 'historico' && !CFG.includes(mig[2].r), 'G3: item antigo de alerta personalizado não vai mais à configuração');
  ok(mig[3] && mig[3].a === 'new' && mig[3].p.ctx === 'antes' && mig[3].p.meal === 'jantar', 'G4: item antigo sem destino ganha destino pelo conteúdo do aviso (antes do jantar)');
  /* ---- layout dos cards: temas e larguras ---- */
  for (const th of ['light', 'dark']) for (const w of [320, 360, 412]) {
    await pg.setViewportSize({ width: w, height: 800 }); await pg.evaluate(t => { document.documentElement.dataset.theme = t; go('painel'); S.ac.items = []; S.ac.hidden = false; }, th);
    await live(pg, [1, 2].map(i => ({ src: 'rem', cat: 'lembrete', prio: 2, title: 'Medição', text: 'Ainda sem glicemia antes do almoço hoje (janela 10:00–12:00). Faça a medição agora e registre o resultado para manter o controle do dia em ordem.' + i, html: B('Medição', 'texto ' + i), nav: { ctx: 'antes', meal: 'almoco' }, key: 'rem|L' + i }))); await sleep(250);
    await pg.evaluate(() => { acCollapse(true); { AC.only = null; acOpen(60000); }; }); await sleep(400);
    const m = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#acp .acr')], p = document.getElementById('acp').getBoundingClientRect(), k = (document.getElementById('acb')._k || 1);
      const R = rows.map(r => { const bs = [...r.querySelectorAll('.acr-b')].map(b => { const q = b.getBoundingClientRect(); return { t: b.textContent.trim(), x: q.left, y: q.top, w: q.width, h: q.height, r: q.right, b: q.bottom, fs: parseFloat(getComputedStyle(b).fontSize), ov: b.scrollWidth > b.clientWidth + 1 }; }), m = r.querySelector('.acr-m'), q = r.getBoundingClientRect(); return { top: q.top, bottom: q.bottom, h: q.height, bs, mfs: parseFloat(getComputedStyle(m).fontSize), mtext: m.getBoundingClientRect().height }; });
      return { R, pl: p.left, pr: p.right, k, vw: innerWidth }; });
    const tag = `(${th}, ${w}px)`;
    ok(m.R.length === 2 && m.R.every(r => r.bs.map(b => b.t).join('|') === 'Marcar como lida|Acessar|Remover da lista'), 'V1' + tag + ': três botões com texto, na ordem certa');
    ok(m.R.every(r => r.bs.every(b => b.h / m.k >= 43.5 && b.w / m.k >= 90 && b.fs >= 14 && !b.ov)), 'V2' + tag + ': botões com área de toque ≥ 44px, texto ≥ 14px e sem corte: ' + JSON.stringify(m.R[0].bs.map(b => [Math.round(b.w / m.k), Math.round(b.h / m.k)])));
    const ov = m.R.every(r => r.bs.every((a, i) => r.bs.every((b, j) => i >= j || a.r <= b.x + .5 || b.r <= a.x + .5 || a.b <= b.y + .5 || b.b <= a.y + .5))); ok(ov, 'V3' + tag + ': botões não se sobrepõem');
    ok(m.R.every(r => r.bs.every(b => b.x >= m.pl && b.r <= m.pr)), 'V4' + tag + ': botões dentro do painel');
    ok(m.R[1].top - m.R[0].bottom >= 10 * m.k - 1, 'V5' + tag + ': separação entre cards ≥ 10px (' + ((m.R[1].top - m.R[0].bottom) / m.k).toFixed(1) + ')');
    ok(m.R.every(r => r.mfs >= 15), 'V6' + tag + ': texto da mensagem ≥ 15px (' + m.R[0].mfs + ')');
    if (w === 360) await pg.screenshot({ path: path.join(os.tmpdir(), `acp43-${th}.png`) });
  }
  await pg.setViewportSize({ width: 412, height: 915 });
  /* ---- persistência: lida + removida por Acessar não volta depois de reiniciar ---- */
  await pg.evaluate(() => { go('painel'); S.ac.items = []; document.documentElement.dataset.theme = 'light'; }); await live(pg, [{ src: 'bkp', cat: 'backup', prio: 2, title: 'Persist P', text: 'Cópia pendente', html: B('Persist P', 'Cópia pendente'), key: 'bkp|Persist P' }]); await sleep(300);
  await pg.evaluate(() => { AC.only = null; acOpen(60000); }); await sleep(300); await pg.click(`#acp [data-ac="go"][data-id="${await pg.evaluate(() => S.ac.items.find(x => x.title === 'Persist P').id)}"]`); await sleep(500);
  await ctx.close(); [ctx, pg] = await open(); await sleep(600);
  s = await st(pg); const pp = s.it.find(x => x.t === 'Persist P');
  ok(pp && pp.r && pp.d && !s.list.includes('Persist P'), 'P1: depois de reiniciar, o item acessado continua lido e fora da lista (fonte ainda ativa)');
  ok(pg._errs.length === 0, 'E2: sem erros de script: ' + pg._errs.slice(0, 2).join(' | '));
  await ctx.close();
  /* ---- fontes REAIS (sem injeção): faixas do próprio app geram o destino certo ---- */
  const DIR2 = fs.mkdtempSync(path.join(os.tmpdir(), 'acb43r-'));
  [ctx, pg] = await open(SRC, { dir: DIR2, time: new Date(new Date().setHours(10, 30, 0, 0)) });
  await pg.evaluate(async () => { acSetMode('bubble'); S.ac.hidden = false; S.irReady = true; await Store.put('records', { id: 'rr1', date: isoDate(new Date()), time: '08:00', ts: mkTs(isoDate(new Date()), '08:00'), glucose: 52, context: 'jejum', meal: 'cafe' }); await loadAll(); acSync(); }); await sleep(600);
  const real = await pg.evaluate(() => S.ac.items.filter(x => x.active).map(x => ({ src: x.src, title: x.title, dest: x.dest })));
  const rm = real.find(x => x.src === 'rem'), hp = real.find(x => x.src === 'hipo');
  ok(rm && rm.dest && rm.dest.a === 'new' && !rm.dest.r, 'Z1: faixa real "Medição" gera destino nova glicemia: ' + JSON.stringify(real.map(x => [x.src, x.dest && (x.dest.r || x.dest.a)])));
  ok(hp && hp.dest && hp.dest.a === 'hypo', 'Z2: faixa real de hipoglicemia gera o protocolo de hipoglicemia');
  if (rm) { await pg.evaluate(() => { try { closeSheet(); } catch (e) { } AC.only = null; acOpen(60000); }); await sleep(300); await pg.click(`#acp [data-ac="go"][data-id="${await pg.evaluate(() => S.ac.items.find(x => x.src === 'rem').id)}"]`); await sleep(500); const z = await st(pg); ok(z.rec && !CFG.includes(z.route), 'Z3: "Acessar" na faixa real "Medição" abre o formulário de nova glicemia (' + z.route + ', ctx=' + z.ctx + ', meal=' + z.meal + ')'); }
  ok(pg._errs.length === 0, 'E3: sem erros de script (fontes reais): ' + pg._errs.slice(0, 2).join(' | '));
  await ctx.close(); fs.rmSync(DIR, { recursive: true, force: true }); fs.rmSync(DIR2, { recursive: true, force: true });
  console.log(fail ? `${fail} falha(s) em ${n}` : `test43 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
