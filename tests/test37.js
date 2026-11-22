// test37: identificação visual dos recursos Premium (0.36.0). Usa o license.js e o licensecore.js REAIS, tokens assinados de verdade e um navegador (Chromium).
// Só apresentação: o bloqueio efetivo continua em licAllowed. Cenários: teste ativo, teste encerrado, licença vitalícia, compra depois do teste (sem reabrir),
// fechar e reabrir, queda de rede, virada do teste com o app aberto.
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const core = require('../src/licensecore.js');

/* ---------- estático: só apresentação ---------- */
const pl = rd('src/premiumlock.js'), lic = rd('src/license.js');
ok(!/\b(licSave|licSign|licVerify|licSession|licBuy|licCall|licComputeState|licRefresh)\s*\(/.test(pl), 'premiumlock.js não valida, grava, compra nem consulta licença');
ok(!/LK\.(payload|devices|info|conflict|msg|seen|cfg|api|loaded)\s*=[^=]/.test(pl) && !/TB_HTTP|TB_SECURE|\.setCfg\(|\.set\(/.test(pl) && !/localStorage/.test(pl), 'premiumlock.js não escreve estado de licença nem usa armazenamento');
ok(/licAllowed\(f\)/.test(pl) && /LIC_PREMIUM\[f\]/.test(pl), 'decide por licAllowed e pela classificação LIC_PREMIUM');
ok(!/LIC_PREMIUM\s*=(?!=)|LIC_PREMIUM\[[^\]]+\]\s*=[^=]/.test(pl) && !/LIC_FREE_LIST/.test(pl), 'não altera nem recria a classificação');
ok(/const LIC_PREMIUM = \{ bolus: 'Cálculo de bolus', padroes: [^}]*metricas: 'Central de Métricas Glicêmicas' \};/.test(lic), 'LIC_PREMIUM continua com as mesmas 7 chaves');
const ROUTES = ['bolus', 'padroes', 'perguntas', 'exames', 'exame', 'comparar', 'analise', 'metricas', 'metrica'];
for (const r of ['painel', 'historico', 'hba1c', 'importar', 'backup', 'perfil', 'seguranca', 'relatorios', 'insulinas', 'esquemas', 'licenca']) ok(!new RegExp("\\b" + r + "\\s*:\\s*'").test(pl.match(/const ROUTE_FEAT = \{[^}]*\}/)[0]), 'rota gratuita fora do mapa: ' + r);
ok(/premiumlock\.js/.test(rd('scripts/build-web.js')) && /premiumlock\.css/.test(rd('scripts/build-web.js')), 'build inclui o módulo e o CSS');
ok(/licAllowed\('rel-pdf'\)/.test(rd('src/report.js')) && /licAllowed\('rel-pdf'\)/.test(rd('src/app.js')), 'PDF protegido nos dois caminhos (botão e compartilhar)');
const css = rd('src/premiumlock.css'); ok(!/(?<![-\w])width:\s*\d{3,}px/.test(css) && /max-width: 380px/.test(css) && /data-theme="light"/.test(css), 'CSS sem larguras fixas grandes, com tela estreita e tema claro');

(async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('parte do navegador ignorada: playwright ausente'); console.log(fail ? 'test37 FALHOU (' + fail + ')' : 'test37 ok (' + n + ' verificações, sem navegador)'); process.exit(fail ? 1 : 0); }
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const H = 3600e3, D = 24 * H;
  const tok = (st, te, extra) => core.licSign(Object.assign({ v: 1, sub: 'u1', st, te, lic: st === 'lifetime_active', iat: Date.now(), vexp: Date.now() + (st === 'lifetime_active' ? 30 * D : 7 * D), dev: null }, extra || {}), priv);

  const HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{--mut:#999;--fg:#eee;--line:#333;--s1:#111;--s2:#181818;--brand-l:#ff7276;--f-mono:monospace;--f-body:sans-serif;--scrim:rgba(0,0,0,.5)} body{background:#0a090c;color:#eee;font-family:sans-serif;margin:0}
  .sheet-bg{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-end}.sheet{background:#161616;padding:16px;width:100%}.menu-item{display:flex;width:100%;text-align:left;padding:12px}.menu-item>div{flex:1;min-width:0}.nav-in{display:grid;grid-template-columns:1fr 1fr 74px 1fr 1fr}.nav-in button{position:relative}${rd('src/premiumlock.css')}</style></head><body>
  <div id="view"></div><div id="nav"></div><div class="dr-it-host" id="dr"></div></body></html>`;
  const SCRIPT = (api, key) => `
    window.TB_LICENSE_API = ${JSON.stringify(api)}; window.TB_LICENSE_PUBKEY = ${JSON.stringify(JSON.stringify(key))};
    const ls = { get: k => { try { const v = localStorage.getItem('sec:' + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } }, set: (k, v) => localStorage.setItem('sec:' + k, JSON.stringify(v)) };
    window.TB_SECURE = { get: async k => ls.get('s_' + k), set: async (k, v) => ls.set('s_' + k, v), has: async k => ls.get('s_' + k) != null, del: async k => localStorage.removeItem('sec:s_' + k), getCfg: async k => ls.get('c_' + k), setCfg: async (k, v) => ls.set('c_' + k, v) };
    window.TB_DRV_STATE = { conn: false };
    window.__net = 'offline'; window.__calls = 0;
    window.TB_HTTP = async (url, op) => { window.__calls++; if (window.__net === 'offline') throw new Error('offline'); return window.__net; };
    const S = { route: 'painel' }, VIEWS = {}, TITLES = {}, MI = {}; let sheetOpen = null; window.__went = [];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const banners = () => '';
    const DR = { open: false }; function drClose() { DR.open = false; }
    function openSheet(h) { closeSheet(); const b = document.createElement('div'); b.className = 'sheet-bg'; b.id = 'sheet-bg'; b.innerHTML = '<div class="sheet">' + h + '</div>'; document.body.appendChild(b); }
    function closeSheet() { const b = document.getElementById('sheet-bg'); if (b) b.remove(); }
    document.addEventListener('click', e => { const g = e.target.closest('[data-act="go"], [data-dr-go]'); if (g) go(g.dataset.r || g.dataset.drGo); });
    function go(r) { window.__went.push(r); S.route = r; render(); }
    const item = (r, t) => '<button class="menu-item" data-act="go" data-r="' + r + '"><div>' + t + '<span>desc</span></div></button>';
    function render() {
      document.getElementById('view').innerHTML = [['bolus', 'Cálculo de bolus'], ['padroes', 'Padrões'], ['perguntas', 'Perguntar à IA'], ['exames', 'Exames'], ['metricas', 'Métricas'], ['historico', 'Histórico'], ['hba1c', 'Hemoglobina glicada'], ['importar', 'Importar'], ['backup', 'Backup']].map(x => item(x[0], x[1])).join('')
        + '<button class="btn pri full" data-act="rep-pdf">Gerar PDF</button><button class="btn full" data-act="rep-xlsx">Gerar Excel</button><button class="btn" data-act="new">Registrar glicemia</button><button class="btn" data-act="go" data-r="insulinas">Insulina</button>'
        + '<button class="mt-blk" data-act="go" data-r="metricas"><span class="mt-prem">PREMIUM</span></button>' + (S.route === 'analise' ? '<div id="lockview">' + (licAllowed('analise') ? 'ANALISE' : licLockView('analise')) + '</div>' : '');
      document.getElementById('nav').innerHTML = '<div class="nav-in"><button data-act="go" data-r="painel">Início</button><button data-act="go" data-r="historico">Histórico</button><button class="fab" data-act="new">+</button><button data-act="go" data-r="analise">Análise</button><button data-act="go" data-r="mais">Mais</button></div>';
      document.getElementById('dr').innerHTML = '<button class="dr-it" data-dr-go="bolus"><span>Cálculo de bolus</span></button><button class="dr-it" data-dr-go="analise"><span>Análise</span></button><button class="dr-it" data-dr-go="backup"><span>Backup</span></button>';
    }`;

  const browser = await chromium.launch();
  const mkCtx = async () => { const ctx = await browser.newContext(); await ctx.route('https://harness.test/**', r => r.fulfill({ contentType: 'text/html', body: HTML })); return ctx; };
  const lc = rd('src/licensecore.js'), lj = rd('src/license.js');
  async function boot(page, extra) {
    await page.goto('https://harness.test/');
    await page.evaluate(() => { localStorage.getItem('sec:s_lic-secret') == null && void 0; });
    await page.addScriptTag({ content: SCRIPT('https://api.test', pub) + '\n' + lc + '\n' + lj + '\n' + rd('src/premiumlock.js') + '\nwindow.__ready = true; render();' });
    await page.waitForFunction(() => window.__ready === true && LK.loaded === true, null, { timeout: 8000 });
    await page.waitForTimeout(200);
    if (extra) await extra();
  }
  const seed = (page, o) => page.evaluate(o => { localStorage.setItem('sec:s_lic-token', JSON.stringify(o.token)); localStorage.setItem('sec:s_lic-secret', JSON.stringify('sec')); localStorage.setItem('sec:c_lic-dev', JSON.stringify('dev1')); localStorage.setItem('sec:s_lic-dev', JSON.stringify('dev1')); if (o.seen) localStorage.setItem('sec:c_lic-seen', JSON.stringify(o.seen)); }, o);
  const badges = page => page.evaluate(() => [...document.querySelectorAll('.pl-bd')].map(b => (b.closest('[data-pl-f]') || {}).dataset ? b.closest('[data-pl-f]').dataset.plF : '?'));
  const marked = page => page.evaluate(() => [...document.querySelectorAll('[data-pl-f]')].map(e => (e.getAttribute('data-r') || e.getAttribute('data-dr-go') || e.getAttribute('data-act'))));
  const allowed = (page, f) => page.evaluate(f => licAllowed(f), f);
  const FREE_R = ['historico', 'hba1c', 'importar', 'backup', 'insulinas', 'painel', 'mais'];
  const PREM_F = ['bolus', 'padroes', 'exames', 'analise', 'rel-pdf', 'ia'];

  /* seed antes do boot: vai para localStorage da origem; o 1º goto prepara a origem */
  async function scenario(name, token, fn, seen) {
    const ctx = await mkCtx(), page = await ctx.newPage(); page.on('pageerror', e => ok(false, name + ': erro de página ' + e.message));
    await page.goto('https://harness.test/'); await seed(page, { token: await token, seen });
    await boot(page); await fn(page, ctx); await ctx.close();
  }

  /* 1) durante o teste: tudo liberado, sem selo */
  await scenario('teste ativo', tok('trial_active', Date.now() + 10 * D), async page => {
    ok((await allowed(page, 'bolus')) && (await allowed(page, 'analise')) && (await allowed(page, 'rel-pdf')), '1: recursos Premium do teste liberados');
    ok((await badges(page)).length === 0 && (await marked(page)).length === 0, '1: nenhum selo/cadeado durante o teste de 14 dias');
    ok(!(await page.evaluate(() => document.querySelector('.pl-bd'))), '1: nenhum elemento de selo no DOM');
  });

  /* 2) teste encerrado, sem licença: identificados e protegidos; gratuitos intactos */
  await scenario('teste encerrado', tok('trial_expired', Date.now() - 2 * H), async (page) => {
    for (const f of PREM_F) ok(!(await allowed(page, f)), '2: protegido (licAllowed nega): ' + f);
    const m = await marked(page);
    for (const r of ['bolus', 'padroes', 'perguntas', 'exames', 'analise', 'rep-pdf']) ok(m.includes(r), '2: selo em ' + r);
    ok(m.filter(x => x === 'bolus').length === 2 && m.filter(x => x === 'analise').length === 2, '2: selo no menu e no menu lateral (bolus/análise) e na barra de navegação');
    for (const r of FREE_R.concat(['rep-xlsx', 'new'])) ok(!m.includes(r), '2: SEM selo no gratuito: ' + r);
    ok(!(await page.evaluate(() => !!document.querySelector('.mt-blk .pl-bd, .mt-prem .pl-bd'))), '2: Central de Métricas não recebe selo duplicado (já tem o seu)');
    ok(await page.evaluate(() => !!document.querySelector('#nav .pl-nav')) && await page.evaluate(() => document.querySelector('#nav [data-r="analise"]').getAttribute('aria-label').includes('Premium')), '2: aba Análise com cadeado e rótulo acessível');
    ok(await page.evaluate(() => !document.querySelector('[data-r="historico"] .pl-bd, .fab .pl-bd')), '2: Histórico e botão + de registro sem cadeado');
    /* toque: abre a janela explicativa, não navega */
    await page.click('.menu-item[data-r="bolus"]');
    ok(await page.evaluate(() => !!document.querySelector('.sheet-bg .pl-sh') && document.querySelector('.sheet-bg').textContent.includes('Cálculo de bolus') && /terminou/.test(document.querySelector('.sheet-bg').textContent)), '2: janela explica que faz parte do Premium e que o teste terminou');
    ok(await page.evaluate(() => /Continuam gratuitos[^]*registrar glicemia[^]*exportar/i.test(document.querySelector('.sheet-bg').textContent)), '2: janela informa o que continua gratuito');
    ok((await page.evaluate(() => window.__went)).length === 0, '2: tocar no recurso bloqueado NÃO navega');
    await page.click('[data-act="pl-go"]'); ok((await page.evaluate(() => window.__went)).join() === 'licenca' && !(await page.evaluate(() => !!document.querySelector('.sheet-bg'))), '2: janela leva à tela da licença vitalícia');
    await page.click('.menu-item[data-r="exames"]'); await page.click('[data-act="pl-close"]'); ok(!(await page.evaluate(() => !!document.querySelector('.sheet-bg'))), '2: "Agora não" fecha a janela');
    await page.click('[data-act="rep-pdf"]'); ok(await page.evaluate(() => !!document.querySelector('.sheet-bg .pl-sh') && /Relatório em PDF/.test(document.querySelector('.sheet-bg').textContent)), '2: botão Gerar PDF também abre a janela'); await page.click('[data-act="pl-close"]');
    /* gratuitos funcionam normalmente */
    const w0 = (await page.evaluate(() => window.__went)).length; await page.click('.menu-item[data-r="historico"]'); await page.click('.menu-item[data-r="hba1c"]');
    ok((await page.evaluate(() => window.__went)).slice(w0).join() === 'historico,hba1c' && !(await page.evaluate(() => !!document.querySelector('.sheet-bg'))), '2: Histórico e HbA1c abrem normalmente, sem janela');
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => { const c = [...document.querySelectorAll('.menu-item[data-pl-f]')].length; return c > 0; }), '2: itens bloqueados seguem visíveis na interface');
    /* protegidos mesmo sem o selo: a rota direta cai no portão existente */
    await page.evaluate(() => { S.route = 'analise'; render(); }); ok(await page.evaluate(() => /recurso <b>premium|recurso premium/i.test(document.getElementById('lockview').innerHTML) && !/ANALISE/.test(document.getElementById('lockview').textContent)), '2: tela Análise continua protegida pelo portão original (licLockView)');
  });

  /* 3) licença vitalícia válida: sem indicadores */
  await scenario('vitalícia', tok('lifetime_active', null), async page => {
    for (const f of PREM_F.concat(['metricas'])) ok(await allowed(page, f), '3: liberado com a licença vitalícia: ' + f);
    ok((await badges(page)).length === 0 && (await marked(page)).length === 0, '3: nenhum selo, cadeado ou aviso');
  });

  /* 4) compra depois do vencimento: desbloqueio automático, sem fechar o app */
  await scenario('compra', tok('trial_expired', Date.now() - 2 * H), async page => {
    ok((await marked(page)).length > 0 && !(await allowed(page, 'bolus')), '4: antes da compra há selos e bloqueio');
    const t = await tok('lifetime_active', null);
    await page.evaluate(t => { window.__net = { status: 200, data: { token: t, status: 'lifetime_active', trial_ends_at: null, price_cents: 2990, licensed_price_cents: 2990, server_time: Date.now(), devices: [] } }; }, t);
    await page.evaluate(() => licRefresh(true)); await page.waitForTimeout(600);
    ok(await allowed(page, 'bolus') && await allowed(page, 'analise'), '4: licença liberada após a confirmação');
    ok((await marked(page)).length === 0 && (await badges(page)).length === 0, '4: selos somem sozinhos, sem reabrir o app');
    await page.click('.menu-item[data-r="bolus"]'); ok((await page.evaluate(() => window.__went)).join() === 'bolus' && !(await page.evaluate(() => !!document.querySelector('.sheet-bg'))), '4: recurso abre direto (sem janela)');
  });

  /* 5) fechar e reabrir: estado preservado */
  {
    const ctx = await mkCtx(), page = await ctx.newPage();
    await page.goto('https://harness.test/'); await seed(page, { token: await tok('trial_expired', Date.now() - 2 * H) }); await boot(page);
    const a = (await marked(page)).join('|'); ok(a.includes('bolus'), '5: selos na primeira abertura');
    await page.reload(); await page.evaluate(() => { window.__ready = false; }); await boot(page);
    ok((await marked(page)).join('|') === a && !(await allowed(page, 'bolus')), '5: depois de fechar e reabrir o estado é o mesmo (token no cofre)');
    /* compra e reabertura: continua liberado */
    const t = await tok('lifetime_active', null);
    await page.evaluate(t => { window.__net = { status: 200, data: { token: t, status: 'lifetime_active', server_time: Date.now(), devices: [] } }; }, t); await page.evaluate(() => licRefresh(true)); await page.waitForTimeout(500);
    await page.reload(); await boot(page); ok((await marked(page)).length === 0 && await allowed(page, 'bolus'), '5: licença comprada continua valendo e sem selos após reabrir');
    await ctx.close();
  }

  /* 6) perda de rede: não invalida a licença já validada */
  await scenario('offline', tok('lifetime_active', null), async page => {
    await page.evaluate(() => { window.__net = 'offline'; }); await page.evaluate(() => licRefresh(true)); await page.waitForTimeout(500);
    ok(await allowed(page, 'bolus') && await allowed(page, 'metricas') && (await marked(page)).length === 0, '6: falha de rede não tira a licença nem mostra selos');
    await page.evaluate(() => { window.__net = { status: 500, data: {} }; }); await page.evaluate(() => licRefresh(true)); await page.waitForTimeout(500);
    ok(await allowed(page, 'bolus') && (await marked(page)).length === 0, '6: erro do servidor também não tira a licença');
  });
  /* 6b) teste ativo + sem rede: continua liberado */
  await scenario('offline teste', tok('trial_active', Date.now() + 5 * D), async page => {
    await page.evaluate(() => licRefresh(true)); await page.waitForTimeout(400); ok(await allowed(page, 'bolus') && (await marked(page)).length === 0, '6: teste ativo sem rede segue liberado e sem selos');
  });
  /* 6c) licença vitalícia vencida sem internet por mais de 30 dias: pausa honesta, com aviso claro (regra existente) */
  await scenario('vitalícia vencida', tok('lifetime_active', null, { iat: Date.now() - 40 * D, vexp: Date.now() - 10 * D }), async page => {
    ok(!(await allowed(page, 'bolus')) && (await marked(page)).includes('bolus'), '6c: validação vencida (30 dias sem internet) volta a identificar os recursos');
    await page.click('.menu-item[data-r="bolus"]'); ok(await page.evaluate(() => /conecte-se à internet/i.test(document.querySelector('.sheet-bg').textContent) && /Ver situação da licença/.test(document.querySelector('.sheet-bg').textContent)), '6c: janela fala em reconectar, não em comprar de novo');
  });

  /* 7) virada do teste com o app aberto: os selos aparecem sozinhos */
  await scenario('virada', tok('trial_active', Date.now() + 2500), async page => {
    ok((await marked(page)).length === 0 && await allowed(page, 'bolus'), '7: teste ainda ativo: sem selos');
    await page.waitForTimeout(4500);
    ok(!(await allowed(page, 'bolus')) && (await marked(page)).includes('bolus'), '7: o teste acaba com o app aberto: selos aparecem sozinhos, sem fechar e reabrir');
  });

  /* 8) classificação centralizada: sem inferência e sem recurso novo */
  await scenario('classificação', tok('trial_expired', Date.now() - H), async page => {
    await page.evaluate(() => { delete LIC_PREMIUM.bolus; render(); }); await page.waitForTimeout(300);
    ok(await allowed(page, 'bolus') && !(await marked(page)).includes('bolus'), '8: fora de LIC_PREMIUM = gratuito = sem selo (a lista central é a única referência)');
    ok((await marked(page)).includes('analise'), '8: os demais continuam marcados');
    await page.evaluate(() => { LIC_PREMIUM['novo-recurso'] = 'Novo'; render(); }); await page.waitForTimeout(300);
    ok(!(await marked(page)).includes('novo-recurso'), '8: recurso novo não ganha selo sem mapeamento explícito');
  });

  /* 9) sem licenciamento configurado ou sem token: nada é marcado */
  { const ctx = await mkCtx(), page = await ctx.newPage(); await page.goto('https://harness.test/'); await boot(page);
    ok((await marked(page)).length === 0, '9: sem token (teste ainda não iniciado): sem selos'); await ctx.close(); }

  await browser.close();
  console.log(fail ? 'test37 FALHOU (' + fail + ')' : 'test37 ok (' + n + ' verificações)'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
