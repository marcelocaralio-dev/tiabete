// test31: padronização e equivalência visual entre tema claro e escuro (0.30.0).
const fs = require('fs'), path = require('path'), os = require('os'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const neon = rd('src/neon.css'), gauge = rd('src/gauge.css'), style = rd('src/style.css'), head = rd('src/head.html'), bw = rd('scripts/build-web.js');
/* ---- estático ---- */
const cssAll = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.css')).map(f => [f, rd('src/' + f)]);
for (const [f, t] of cssAll) ok(!/:not\(\[data-theme="light"\]\)/.test(t.replace(/\/\*[\s\S]*?\*\//g, '')), f + ': nenhuma regra exclusiva do tema escuro (":not([data-theme=light])")');
const TOK = ['--amb-ok', '--amb-warn', '--amb-bad', '--nh-ok', '--nh2-ok', '--nh-bad', '--nh2-bad', '--nh-warn', '--nh2-warn', '--warn-line', '--nh-tail', '--hero-ok-glow', '--hero-bad-glow', '--g-ok-b', '--g-bad-b', '--g-vh-b', '--g-vh-ring', '--g-prog', '--g-nav-t', '--g-spark-p', '--g-navic', '--g-gz-num-p', '--g-gz-lit-p', '--g-btn-sh', '--g-btn-a', '--g-btn-h', '--g-fab-sh', '--g-fab-sh-h', '--g-fab-a', '--g-fab-h', '--g-rw-sh', '--g-rw-sh-h', '--g-rw-a', '--g-rw-h'];
const dk = neon.split(':root[data-theme="light"] {')[0], lt = neon.split(':root[data-theme="light"] {')[1].split('\n}')[0];
for (const t of TOK) { ok(new RegExp(t + ':').test(dk), t + ' definido no escuro'); ok(new RegExp(t + ':').test(lt), t + ' definido no claro'); }
ok(/filter: var\(--g-navic\)/.test(style) && !/\.nav button\[aria-current="page"\] svg \{ filter: none/.test(style), 'ícone ativo da navegação brilha nos dois temas');
ok(/\.gz-num \{ filter/.test(gauge) && /\.gz-lit \{ filter/.test(gauge), 'mostrador: brilho nos dois temas');
ok(/localStorage\.getItem\('tb-theme'\)/.test(head) && head.indexOf('tb-theme') < head.indexOf('<style>'), 'tema aplicado antes da primeira pintura (sem flash)');
ok(/theme-color/.test(rd('src/extras.js')), 'cor da barra do sistema acompanha o tema');
ok(/const K = 1\.29;/.test(bw) && rd('scripts/patch-android.js').includes('setTextZoom(100)'), 'ajustes aprovados do APK intactos');
(async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada'); return end(); }
  const { execSync } = require('child_process'), sleep = ms => new Promise(r => setTimeout(r, ms)); execSync('node scripts/build-web.js', { cwd: ROOT, stdio: 'ignore' });
  const seed = rd('tests/test29.js').split('const seed = `')[1].split('`;')[0];
  const probe = () => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const over = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3]), 1];
    const bgOf = el => { const st = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) st.push(c); if (c && c[3] >= 1) break; } let b = parse(getComputedStyle(document.documentElement).backgroundColor); if (!b || b[3] < 1) b = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return b; };
    let bad = 0; const ex = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let nd; const seen = new Set();
    while (nd = w.nextNode()) {
      if (!nd.textContent.trim()) continue; const el = nd.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
      let skip = false; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (getComputedStyle(e).backgroundImage !== 'none') { skip = true; break; } if (c && c[3] >= 1) break; }
      if (skip || el.closest('[disabled],[aria-disabled=true]')) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
      const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el), f = over([fg[0], fg[1], fg[2], fg[3] * op], bg), L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05), fs = parseFloat(cs.fontSize), need = (fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700)) ? 3 : 4.5;
      if (ratio < need) { bad++; if (ex.length < 3) ex.push(el.className + ' ' + ratio.toFixed(2) + ' ' + nd.textContent.trim().slice(0, 20)); }
    } return { bad, ex };
  };
  const res = {};
  for (const th of ['light', 'dark']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c31-')), ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true }), pg = ctx.pages()[0] || await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); await pg.goto('file://' + ROOT + '/www/index.html'); await sleep(900);
    await pg.addStyleTag({ content: '#rw-bg,#tb-gate,#tb-splash{display:none!important;pointer-events:none!important}*{transition:none!important;animation:none!important}' });
    await pg.evaluate(seed); await pg.evaluate(() => { window.licAllowed = () => true; }); await pg.evaluate(t => { S.theme = t; applyTheme(); }, th);
    ok(await pg.evaluate(() => document.documentElement.getAttribute('data-theme')) === th, th + ': tema aplicado');
    ok(await pg.evaluate(() => document.querySelector('meta[name="theme-color"]').content) === (th === 'light' ? '#F6F2F0' : '#08070A'), th + ': theme-color');
    /* indicador geral: os três estados acendem o fundo e a faixa do topo nos dois temas */
    const amb = {};
    for (const st of ['none', 'ok', 'warn', 'bad']) {
      await pg.evaluate(s => { window.TB_CONTROL_STATE = () => s; S.route = 'painel'; render(); }, st); await sleep(200);
      ok(await pg.evaluate(() => document.documentElement.getAttribute('data-amb')) === st, th + ' amb ' + st + ': atributo');
      amb[st] = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--amb-ok') && (getComputedStyle(document.querySelector('.top')).backgroundImage + '|' + getComputedStyle(document.documentElement, '::before').backgroundImage));
    }
    ok(amb.none !== amb.ok && amb.ok !== amb.warn && amb.warn !== amb.bad && amb.ok !== amb.bad, th + ': fundo muda conforme o estado (verde, âmbar, vermelho)');
    ok(/rgba\(/.test(amb.ok) && /rgba\(/.test(amb.bad), th + ': fundo ambiente com cor');
    /* halo dos cards e selos */
    await pg.evaluate(() => { S.route = 'painel'; render(); document.querySelectorAll('.pn-c').forEach((e, i) => { e.classList.remove('st-ok', 'st-bad', 'st-warn'); e.classList.add(['st-ok', 'st-bad', 'st-warn'][i % 3]); }); });
    const halo = await pg.evaluate(() => [...document.querySelectorAll('.pn-c')].slice(0, 3).map(e => getComputedStyle(e).boxShadow));
    ok(halo.length >= 3 && halo.every(h => h !== 'none' && /rgba?\(/.test(h)) && new Set(halo).size === 3, th + ': halo verde/vermelho/âmbar nos cards');
    ok(await pg.evaluate(() => { const s = document.querySelector('.nav button[aria-current="page"] svg'); return !!s && getComputedStyle(s).filter !== 'none'; }), th + ': ícone ativo da navegação com brilho');
    /* mostrador (gauge) */
    const gz = await pg.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<svg class="gz s-ok" id="gt"><text class="gz-num">1</text><path class="gz-lit"></path></svg>'); const a = getComputedStyle(document.querySelector('#gt .gz-num')).filter, b = getComputedStyle(document.querySelector('#gt .gz-lit')).filter; document.getElementById('gt').remove(); return [a, b]; });
    ok(gz.every(x => /drop-shadow/.test(x)), th + ': mostrador com brilho');
    /* contraste de todo texto em telas-chave */
    for (const r of ['painel', 'historico', 'analise', 'metricas', 'mais', 'exames', 'conquistas', 'aparencia', 'b:alimentos', 'b:razao', 'b:dia']) {
      await pg.evaluate(r => { if (r.startsWith('b:')) { S.blUi.tab = r.slice(2); S.route = 'bolus'; } else S.route = r; render(); document.querySelectorAll('.acc-h').forEach(h => { if (h.getAttribute('aria-expanded') !== 'true') h.click(); }); }, r); await sleep(200);
      const c = await pg.evaluate(probe); res[th + r] = c; ok(c.bad === 0, th + ' ' + r + ': contraste de texto ≥ WCAG AA ' + JSON.stringify(c.ex));
    }
    ok(errs.length === 0, th + ': sem erros de script ' + errs.slice(0, 2)); await ctx.close();
  }
  /* persistência e ausência de flash: o atributo já existe no início da página, antes dos scripts do app */
  for (const th of ['light', 'dark']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c31p-')), ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 412, height: 860 } }), pg = ctx.pages()[0] || await ctx.newPage();
    await pg.addInitScript(t => { try { localStorage.setItem('tb-theme', t); } catch (e) { } window.__first = null; new MutationObserver(() => { const d = document.documentElement; if (window.__first == null && d.getAttribute('data-theme')) window.__first = d.getAttribute('data-theme'); }).observe(document, { attributes: true, subtree: true }); }, th);
    await pg.goto('file://' + ROOT + '/www/index.html'); await sleep(900);
    ok(await pg.evaluate(() => window.__first) === th, th + ': primeiro valor de data-theme já é o salvo (sem flash)');
    ok(await pg.evaluate(() => document.documentElement.getAttribute('data-theme')) === th, th + ': preferência persiste após recarregar'); await ctx.close();
  }
  end();
})();
function end() { console.log(fail ? `${fail} falha(s) em ${n}` : `test31 ok (${n} verificações)`); process.exit(fail ? 1 : 0); }
