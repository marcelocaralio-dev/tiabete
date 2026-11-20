// test22: Central de Métricas Glicêmicas. Cálculos, portão de licença (só vitalícia), filtros, indicador geral, interface.
process.removeAllListeners('warning');
const vm = require('vm'), fs = require('fs'), path = require('path'), os = require('os');
const L = require('../src/logic.js');
const HELP = (() => { const c = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/charts.js'), 'utf8').split('\n').filter(l => /^const (esc|fm|f0|fn|fsign) = /.test(l)).join('\n') + '\nthis.h = { esc, fm, f0, fn, fsign };', c); return Object.assign({}, c.h, { fmtDM: ms => { const d = new Date(ms); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }, fmtDate: L.fmtDate || (iso => iso.split('-').reverse().join('/')) }); })(); const ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const close = (a, b, t = 1e-9) => Math.abs(a - b) < t;

/* ---------- 1) cálculo puro ---------- */
const ctx = vm.createContext({ ...L, ...HELP, module: { exports: {} }, localStorage: undefined, console, S: {}, VIEWS: {}, TITLES: {}, document: { addEventListener() {} }, licAllowed: () => true });
vm.runInContext(fs.readFileSync(ROOT + '/src/ambient.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(ROOT + '/src/metricas.js', 'utf8').replace('const MT_KEYS', 'var MT_KEYS'), ctx);
const M = ctx.module.exports;
const NOW = new Date(2026, 10, 19, 15, 0).getTime(), DAY = 864e5;
const mk = (vals, i0 = 0) => vals.map((g, i) => { const ts = NOW - (i0 + i) * 3600e3 * 5; return { id: 'x' + i, glucose: g, ts, date: L.isoDate(new Date(ts)), time: '08:00', source: 'manual' }; });
const G = M.mtGoals({});
let m = M.mtCalc(mk([60, 100, 100, 150, 200, 300]), G);
ok(m.n === 6 && close(m.tir, 50) && close(m.tbr, 100 / 6) && close(m.tar, 200 / 6), 'TIR/TBR/TAR: 3 de 6 na faixa, 1 abaixo, 2 acima');
ok(close(m.tir + m.tbr + m.tar, 100), 'TIR + TBR + TAR = 100');
const vals = [60, 100, 100, 150, 200, 300], mean = vals.reduce((a, b) => a + b) / 6, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / 5);
ok(close(m.mean, mean) && close(m.sd, sd) && close(m.cv, sd / mean * 100), 'DP amostral (n-1) e CV = DP ÷ média × 100');
const st = L.stats(mk(vals)); ok(close(st.sd, m.sd), 'DP igual ao stats() do app');
ok(m.cnt.vlow === 0 && m.cnt.low1 === 1 && m.cnt.ok === 3 && m.cnt.high1 === 1 && m.cnt.vhigh === 1, 'cinco faixas');
/* limites: 70 e 180 estão dentro */
m = M.mtCalc(mk([70, 180, 69, 181, 53, 251]), G); ok(m.cnt.ok === 2 && m.cnt.low1 === 1 && m.cnt.high1 === 1 && m.cnt.vlow === 1 && m.cnt.vhigh === 1, 'limites 70/180/54/250 corretos');
/* vazio, 1 medição, iguais */
m = M.mtCalc([], G); ok(m.n === 0 && m.tir === null && m.sd === null && m.cv === null && m.mean === null, 'sem dados: nada inventado, sem NaN');
ok([0, 1, 2].every(i => M.mtLevel(['tir', 'tbr', 'tar', 'dp', 'cv'][i], m, G) === -1), 'sem dados: classificação "sem dados"');
m = M.mtCalc(mk([120]), G); ok(m.n === 1 && m.tir === 100 && m.sd === null && m.cv === null && M.mtLevel('cv', m, G) === -1, '1 medição: percentuais sim, DP/CV não');
m = M.mtCalc(mk([100, 100, 100]), G); ok(m.sd === 0 && m.cv === 0 && M.mtLevel('cv', m, G) === 0, 'valores iguais: DP 0, CV 0, sem divisão inválida');
ok(m.small === true, 'poucas medições = base pequena');
/* exemplo e inválidos ficam de fora */
const rr = mk([100, 110]).concat([{ glucose: 500, ts: NOW, source: 'exemplo', date: 'x' }, { glucose: NaN, ts: NOW }, { glucose: 0, ts: NOW }, { glucose: 100, ts: 'a' }, null, { glucose: 100, ts: NOW, example: true }]);
ok(M.mtReal(rr, NOW - DAY * 30, NOW).length === 2, 'exemplos, NaN, zero e lixo não entram');
/* níveis */
const lv = (k, o) => M.mtLevel(k, Object.assign({ n: 10, cv: null }, o), G);
ok(lv('tir', { tir: 70 }) === 0 && lv('tir', { tir: 69.9 }) === 1 && lv('tir', { tir: 50 }) === 1 && lv('tir', { tir: 49.9 }) === 2, 'níveis do TIR');
ok(lv('tbr', { tbr: 3.9 }) === 0 && lv('tbr', { tbr: 4 }) === 1 && lv('tbr', { tbr: 8 }) === 2, 'níveis do TBR');
ok(lv('tar', { tar: 24.9 }) === 0 && lv('tar', { tar: 25 }) === 1 && lv('tar', { tar: 40 }) === 2, 'níveis do TAR');
ok(lv('cv', { cv: 36 }) === 0 && lv('cv', { cv: 36.1 }) === 1 && lv('cv', { cv: 50 }) === 2 && lv('dp', { cv: 50 }) === 2, 'níveis do CV e do DP');
/* perfis */
const GI = M.mtGoals({ preset: 'idoso' }), GG = M.mtGoals({ preset: 'gestacao' }), GC = M.mtGoals({ preset: 'padrao', low: 80, high: 160 });
ok(GI.tir === 50 && GI.tbr === 1 && GG.low === 63 && GG.high === 140 && GC.low === 80 && GC.high === 160 && GC.custom, 'perfis de metas');
m = M.mtCalc(mk([75, 170]), GC); ok(m.cnt.low1 === 1 && m.cnt.high1 === 1 && m.tir === 0, 'faixa personalizada muda TIR/TBR/TAR');
ok(M.mtCleanCfg({ preset: 'x', low: 5, high: 1000 }).low === null && M.mtCleanCfg({ preset: 'x' }).preset === 'padrao' && M.mtCleanCfg({ low: 70, high: 90 }).low === null && M.mtCleanCfg({ low: 65, high: 150 }).low === 65, 'validação das metas');
/* períodos e filtros */
const recs = []; for (let d = 0; d < 100; d++) for (let h = 0; h < 2; h++) { const ts = new Date(2026, 10, 19 - d, 8 + h * 6).getTime(); recs.push({ id: d + '_' + h, glucose: d < 7 ? 100 : d < 30 ? 250 : 40, ts, date: L.isoDate(new Date(ts)), time: '08:00', source: 'manual' }); }
const B = p => M.mtBuild(recs, p, NOW, {});
ok(B(7).m.n === 14 && B(14).m.n === 28 && B(30).m.n === 60 && B(90).m.n === 180, 'filtros 7/14/30/90 contam as medições do período');
ok(close(B(7).m.tir, 100) && close(B(30).m.tir, 14 / 60 * 100) && close(B(30).m.tar, 46 / 60 * 100), 'cada período recalcula os indicadores');
ok(B(30).pm.n === 60 && B(7).pm.n === 14, 'período anterior calculado');
const sr = M.mtSeries(recs, 30, NOW, G, 'tir'); ok(sr.length === 6 && sr.reduce((s, x) => s + x.n, 0) === 60, 'série de 30 dias: 6 barras que cobrem todas as medições');
ok(M.mtSeries(recs, 7, NOW, G, 'tir').length === 7 && M.mtSeries(recs, 90, NOW, G, 'tir').length === 6 && M.mtSeries(recs, 14, NOW, G, 'tir').length === 7, 'séries de 7/14/90 dias');
const gap = M.mtSeries(recs.filter(r => r.ts < NOW - 3 * DAY), 7, NOW, G, 'cv'); ok(gap.some(x => x.v === null && x.n === 0), 'dia sem medição fica vazio (não é preenchido)');
const tod = M.mtTod([{ glucose: 50, time: '02:00' }, { glucose: 50, time: '13:00' }, { glucose: 50, noTime: true }, { glucose: 100, time: '13:00' }], r => r.glucose < 70); ok(tod.rows[0].ev === 1 && tod.rows[2].ev === 1 && tod.rows[2].tot === 2 && tod.notime === 1 && tod.evNo === 1, 'distribuição por horário');
/* indicador geral */
const AMBMK = (n, pIn, pLow, days = 10) => { const r = []; let s = 3; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; for (let i = 0; i < n; i++) { const x = rnd(), g = x < pLow ? 55 : x < pLow + pIn ? 110 : 230, ts = NOW - (i % days) * DAY - i * 6e4; r.push({ id: i, glucose: g, ts, date: L.isoDate(new Date(ts)), context: 'antes', source: 'manual' }); } return r; };
const as = (r, p, g) => M.mtAmbientClassify(r, NOW, p, g || G).state;
ok(as(AMBMK(19, .9, 0)) === 'none' && as(AMBMK(40, .9, 0, 4)) === 'none', 'indicador geral: mínimo de 20 medições em 5 dias');
ok(as(AMBMK(40, .95, 0).map((r, i) => ({ ...r, glucose: 100 + (i % 7) * 8 }))) === 'ok', 'indicador geral: bom controle = ok');
ok(as(AMBMK(40, .6, .02)) === 'warn' && as(AMBMK(40, .3, .1)) === 'bad', 'indicador geral: warn e bad');
const hi = AMBMK(40, 0, 0).map((r, i) => ({ ...r, glucose: i % 2 ? 60 : 300 })); ok(as(hi) === 'bad', 'não classifica só pela média');
const tarHigh = AMBMK(40, 0, 0).map((r, i) => ({ ...r, glucose: i % 10 < 7 ? 120 : 200 })); ok(as(tarHigh) === 'warn', 'TAR elevado impede o "ok" (30% acima da faixa)');
const cvHigh = AMBMK(40, 0, 0).map((r, i) => ({ ...r, glucose: i % 2 ? 80 : 175 })); ok(M.mtCalc(cvHigh, G).cv > 36 && as(cvHigh) === 'warn', 'CV/DP elevado impede o "ok"');
const tbrHi = AMBMK(40, 0, 0).map((r, i) => ({ ...r, glucose: i % 10 === 0 ? 55 : i % 10 === 1 ? 60 : 120 })); ok(as(tbrHi) === 'bad', 'TBR de 20% sinaliza');
ok(as(AMBMK(40, .8, 0).map(r => ({ ...r, source: 'exemplo' }))) === 'none', 'exemplos não contam no indicador geral');
/* histerese */
const bs = AMBMK(40, .72, 0.0).map(r => r.glucose === 230 ? { ...r, glucose: 190 } : r);
ok(typeof as(bs, 'ok') === 'string', 'histerese roda');

/* ---------- 2) licenciamento: só vitalícia ---------- */
const lic = (st, over) => {
  const c = { console, crypto: globalThis.crypto, TextEncoder, TextDecoder, atob, btoa, VIEWS: { bolus: () => 'B' }, TITLES: {}, MI: {}, document: { addEventListener() {}, visibilityState: 'visible' }, addEventListener() {}, render() {}, banners: () => '', esc: String, go() {}, TB_DEV_MODE: false, Date, navigator: { userAgent: 'x' }, TB_LICENSE_API: 'https://w.test', TB_LICENSE_PUBKEY: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' }) };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(ROOT + '/src/licensecore.js', 'utf8') + '\n' + fs.readFileSync(ROOT + '/src/license.js', 'utf8'), c);
  c.run = s => vm.runInContext(s, c); const now = Date.now();
  c.run(`LK.loaded = true; LK.payload = ${JSON.stringify(st ? Object.assign({ v: 1, iat: now - 1000, vexp: now + 864e5 * 20, te: now + 864e5 * 5 }, st) : null)};`); return c;
};
const A = c => c.run('licAllowed("metricas")');
ok(A(lic({ st: 'lifetime_active' })) === true, 'vitalícia ativa: Central liberada');
ok(A(lic({ st: 'trial_active' })) === false && lic({ st: 'trial_active' }).run('licAllowed("bolus")') === true, 'teste de 14 dias: Central bloqueada (bolus continua liberado)');
ok(A(lic({ st: 'payment_pending' })) === false && A(lic({ st: 'refunded' })) === false && A(lic({ st: 'revoked' })) === false && A(lic({ st: 'trial_expired' })) === false, 'pendente, reembolsada, revogada, expirada: bloqueada');
ok(A(lic(null)) === false, 'sem licença: bloqueada');
ok(A(lic({ st: 'lifetime_active', vexp: Date.now() - 1000 })) === false, 'token vitalício vencido sem internet (fora da tolerância): bloqueada');
ok(A(lic({ st: 'lifetime_active', vexp: Date.now() + 864e5 * 25 })) === true, 'vitalícia dentro da tolerância offline de 30 dias: liberada (sem servidor)');
const fs0 = lic({ st: 'lifetime_active' }); fs0.run('LK.loaded = false'); ok(A(fs0) === false, 'enquanto o token é lido o premium espera');
const ok1 = lic({ st: 'lifetime_active' }); ok1.run('LK.cfg = false; LK.dev = false'); ok(A(ok1) === false, 'produção sem servidor configurado: bloqueada');
ok(['registrar-glicemia', 'historico', 'exportar-excel', 'exportar-csv', 'backup'].every(f => lic(null).run(`licAllowed("${f}")`) === true), 'registrar, histórico e exportar seguem gratuitos sem licença');
ok(Object.keys(lic(null).run('LIC_PREMIUM')).includes('metricas') && lic(null).run('LIC_LIFETIME.metricas') === true && Object.keys(lic(null).run('LIC_PREMIUM')).length === 7, 'registrada em LIC_PREMIUM; nenhuma outra função virou premium');
ok(/Exclusivo da licença vitalícia/.test(lic({ st: 'lifetime_active' }).run('viewLicenca()')), 'tela de licença lista a Central como exclusiva da vitalícia');
/* módulo de métricas obedece ao portão: bundle e ambiente */
const gctx = vm.createContext({ ...L, ...HELP, module: { exports: {} }, localStorage: undefined, console, S: { records: recs, mt: {} }, VIEWS: {}, TITLES: {}, document: { addEventListener() {} } });
gctx.licAllowed = () => false; vm.runInContext(fs.readFileSync(ROOT + '/src/ambient.js', 'utf8'), gctx); vm.runInContext(fs.readFileSync(ROOT + '/src/metricas.js', 'utf8'), gctx);
ok(vm.runInContext('mtBundle(30)', gctx) === null && vm.runInContext('mtAmbientState(S.records, Date.now(), "none")', gctx) === null, 'sem licença: nenhum cálculo é feito e o indicador geral usa a lógica antiga (null)');
ok(/PREMIUM/.test(vm.runInContext('viewMetricas()', gctx)) && !/mt-panel|mt-ring/.test(vm.runInContext('viewMetricas()', gctx)) && !/mt-panel/.test(vm.runInContext('VIEWS.metrica()', gctx)), 'sem licença: só a apresentação, sem dados nem gráficos');
ok(!/\d,\d%/.test(vm.runInContext('viewMetricas()', gctx).replace(/<[^>]+>/g, ' ')), 'apresentação não mostra nenhum resultado numérico');
ok(vm.runInContext('mtHomeBlock()', gctx).includes('locked') && vm.runInContext('mtHomeBlock()', gctx).includes('CENTRAL DE MÉTRICAS') && vm.runInContext('mtHomeBlock()', gctx).includes('Explorar minhas métricas'), 'bloco da tela inicial aparece bloqueado');
gctx.licAllowed = () => true; ok(vm.runInContext('mtBundle(30)', gctx).m.n === 60 && vm.runInContext('mtAmbientState(S.records, Date.now(), "none")', gctx) !== null, 'com licença: calcula');
ok(/mt-panel/.test(vm.runInContext('viewMetricas()', gctx)) && !/locked/.test(vm.runInContext('mtHomeBlock()', gctx)), 'com licença: Central e bloco liberados');
ok(['tir', 'tbr', 'tar', 'dp', 'cv'].every(k => { vm.runInContext(`S.mt.sel='${k}'`, gctx); const h = vm.runInContext('VIEWS.metrica()', gctx); return /Como é calculado/.test(h) && /Metas e referências/.test(h) && /Dados considerados/.test(h) && /Evolução/.test(h); }), 'detalhe dos cinco indicadores tem todas as seções');

/* ---------- 3) interface no navegador (Playwright), se existir ---------- */
(async () => {
  let chromium, devices; try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada: playwright ausente'); return end(); }
  const { execSync } = require('child_process'), tmpHtml = path.join(os.tmpdir(), 'tb22-' + process.pid), sleep = ms => new Promise(r => setTimeout(r, ms));
  fs.mkdirSync(tmpHtml, { recursive: true });
  const bld = fs.readFileSync(ROOT + '/scripts/build-web.js', 'utf8'); /* compila com licenciamento configurado de mentira, para testar o portão real */
  const www = path.join(ROOT, 'www'); const had = fs.existsSync(www);
  execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore', env: { ...process.env } });
  const HTML = path.join(ROOT, 'www/index.html'); const html = fs.readFileSync(HTML, 'utf8');
  const forced = html.replace(/window\.TB_LICENSE_API = .*;/, 'window.TB_LICENSE_API = "https://w.test";').replace(/window\.TB_LICENSE_PUBKEY = .*;/, 'window.TB_LICENSE_PUBKEY = ' + JSON.stringify(JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' })) + ';');
  const FH = path.join(tmpHtml, 'index.html'); fs.writeFileSync(FH, forced);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt22-')), seed = async pg => pg.evaluate(async () => {
    await Store.put('meta', { id: 'seeded', at: 1 }); const recs = []; const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); [['07:00', 110], ['12:30', 150], ['19:00', 200], ['23:00', 62]].forEach(([t, b], j) => { const date = isoDate(d); recs.push({ id: 'r' + i + '_' + j, date, time: t, ts: mkTs(date, t), glucose: b, context: 'antes', source: 'manual' }); }); }
    await Store.putMany('records', recs); await loadAll(); render();
  });
  const ctx2 = await chromium.launchPersistentContext(dir, Object.assign({}, devices['Pixel 7'])), pg = ctx2.pages()[0] || await ctx2.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + FH); await sleep(1200); try { await pg.getByText('Continuar sem conta').click({ timeout: 2000 }); } catch (e) { }
  await seed(pg); await sleep(300);
  const cards = await pg.evaluate(() => [...document.querySelectorAll('.pn-grid > .pn-c')].map(e => e.dataset.pm).join(','));
  const blocks = await pg.evaluate(() => document.querySelectorAll('.mt-blk').length);
  ok(blocks === 1 && /^ult,dia,hba,evo,trat,med,cmp,min,max,n,hipo,hiper,dist$/.test(cards), 'tela inicial: UM bloco novo e os cartões existentes intactos e na mesma ordem (' + cards + ')');
  const lockedBlk = await pg.evaluate(() => document.querySelector('.mt-blk').classList.contains('locked'));
  ok(lockedBlk, 'sem licença: o bloco aparece bloqueado');
  const grid = await pg.evaluate(() => { const g = document.querySelector('.pn-grid'), b = document.querySelector('.mt-blk'); return g.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : 0; });
  ok(grid === 1, 'o bloco fica depois da grade de cartões (sem reorganizá-la)');
  await pg.click('.mt-blk'); await sleep(500);
  const pres = await pg.evaluate(() => ({ r: S.route, p: !!document.querySelector('.mt-pres'), panel: !!document.querySelector('.mt-panel'), btn: !!document.querySelector('[data-r="licenca"]'), txt: document.querySelector('#view').innerText }));
  ok(pres.r === 'metricas' && pres.p && !pres.panel && pres.btn, 'sem licença: toque abre a apresentação com botão para a licença');
  ok(!/\d+,\d\s*%/.test(pres.txt), 'apresentação sem números do usuário');
  /* tentativa de burlar: chamar as telas e a navegação direto */
  const bypass = await pg.evaluate(() => { S.mt.sel = 'tir'; go('metrica'); const a = !!document.querySelector('.mt-ring'); go('metricas'); const b = !!document.querySelector('.mt-panel'); document.body.insertAdjacentHTML('beforeend', '<button id="hk" data-act="mt-open" data-k="tir">x</button>'); document.getElementById('hk').click(); return [a, b, S.route, mtBundle(30), !!document.querySelector('.mt-ring')]; });
  ok(!bypass[0] && !bypass[1] && bypass[3] === null && !bypass[4], 'sem licença: abrir rota/botão manualmente não revela dados');
  /* libera pelo token (simula a licença vitalícia validada) */
  await pg.evaluate(() => { const n = Date.now(); LK.loaded = true; LK.payload = { v: 1, st: 'lifetime_active', iat: n - 1000, vexp: n + 20 * 864e5 }; go('painel'); });
  await sleep(300);
  ok(await pg.evaluate(() => !document.querySelector('.mt-blk').classList.contains('locked')), 'vitalícia: bloco liberado sem recarregar');
  await pg.click('.mt-blk'); await sleep(900);
  const c1 = await pg.evaluate(() => ({ r: S.route, rows: document.querySelectorAll('.mt-row').length, tir: document.querySelector('.mt-tir .mt-ring-c b').textContent, txt: document.querySelector('#view').innerText, ov: document.documentElement.scrollWidth > innerWidth + 1 }));
  ok(c1.r === 'metricas' && c1.rows === 5 && /50/.test(c1.tir) && !c1.ov, 'Central abre com os cinco indicadores, TIR=50% (2 de 4 por dia na faixa), sem rolagem horizontal (' + c1.tir + ')');
  ok(/Análise glicêmica avançada/.test(c1.txt) && /Central de Métricas/i.test(c1.txt) && /percentuais das suas medições/.test(c1.txt), 'títulos e aviso de percentual de medições');
  /* filtros */
  const per = [];
  for (const p of [7, 14, 30, 90]) { await pg.click(`[data-act="mt-period"][data-p="${p}"]`); await sleep(300); per.push(await pg.evaluate(() => document.querySelector('.mt-per').innerText)); }
  ok(/28 medições em 7 dias/.test(per[0]) && /56 medições em 14 dias/.test(per[1]) && /120 medições em 30 dias/.test(per[2]) && /120 medições em 30 dias/.test(per[3]), 'filtros 7/14/30/90 atualizam a Central (' + per.map(x => x.slice(11, 40)).join(' | ') + ')');
  /* novo registro atualiza automaticamente */
  await pg.click('[data-act="mt-period"][data-p="7"]'); await sleep(200);
  const before = await pg.evaluate(() => document.querySelector('.mt-per').innerText);
  await pg.evaluate(async () => { const d = isoDate(new Date()); await Store.put('records', { id: 'novo1', date: d, time: '23:30', ts: mkTs(d, '23:30'), glucose: 300, context: 'antes', source: 'manual' }); await loadAll(); render(); });
  await sleep(300); const after = await pg.evaluate(() => document.querySelector('.mt-per').innerText);
  ok(before !== after && /29 medições/.test(after), 'novo registro atualiza os indicadores automaticamente');
  /* detalhe */
  await pg.click('.mt-tbr'); await sleep(900);
  const d1 = await pg.evaluate(() => ({ r: S.route, h: document.querySelector('h1.pg').innerText, t: document.querySelector('#view').innerText, ov: document.documentElement.scrollWidth > innerWidth + 1 }));
  ok(d1.r === 'metrica' && /Tempo Abaixo da Faixa/.test(d1.h) && /Como é calculado/i.test(d1.t) && /Metas e referências/i.test(d1.t) && /Registros considerados/i.test(d1.t) && !d1.ov, 'detalhe do TBR abre com todas as seções, sem rolagem horizontal');
  await pg.click('h1.pg button'); await sleep(400); ok(await pg.evaluate(() => S.route) === 'metricas', 'voltar do detalhe leva à Central');
  await pg.click('h1.pg button'); await sleep(400); ok(await pg.evaluate(() => S.route) === 'painel', 'voltar da Central leva ao Início');
  /* metas */
  await pg.evaluate(() => go('metricas')); await sleep(300); await pg.click('[data-act="mt-cfg"]'); await sleep(300);
  await pg.click('input[value="gestacao"]'); await pg.click('[data-act="mt-cfg-save"]'); await sleep(500);
  ok(await pg.evaluate(() => /63–140/.test(document.querySelector('.mt-per').innerText) && MT_CFG.preset === 'gestacao'), 'trocar o perfil de metas atualiza a faixa');
  await pg.reload(); await sleep(1500); try { await pg.getByText('Continuar sem conta').click({ timeout: 1500 }); } catch (e) { }
  ok(await pg.evaluate(() => MT_CFG.preset === 'gestacao'), 'metas persistem após reiniciar');
  ok(errs.length === 0, 'sem erros de JavaScript: ' + errs.join(' | '));
  /* cálculo do navegador = cálculo puro */
  await ctx2.close();
  if (!had) fs.rmSync(www, { recursive: true, force: true }); fs.rmSync(tmpHtml, { recursive: true, force: true });
  end();
})().catch(e => { console.log('FALHOU: exceção', e); process.exit(1); });
function end() { console.log(fail ? `test22: ${fail} falha(s) em ${n} verificações` : `test22 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
