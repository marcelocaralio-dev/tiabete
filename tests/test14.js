// Licenciamento: teste de 14 dias (336 h), licença vitalícia, 2 aparelhos, pagamentos e preservação dos dados.
// Roda o Worker de verdade (rotas, SQL em SQLite, assinatura do webhook) ligado ao cliente do app, sem rede.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const core = require('../src/licensecore.js');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const H = 3600e3, DAY = 24 * H;
const b64u = u => core.licB64u(new Uint8Array(u));

/* ---- D1 de mentira sobre SQLite ---- */
function d1() {
  const db = new DatabaseSync(':memory:'); for (const f of fs.readdirSync(path.join(__dirname, '../worker/migrations')).sort()) db.exec(fs.readFileSync(path.join(__dirname, '../worker/migrations', f), 'utf8'));
  return { raw: db, prepare(sql) { const st = db.prepare(sql); return { bind(...a) { return { first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); return {}; } }; } }; } };
}
(async () => {
  const lic = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privJwk = await crypto.subtle.exportKey('jwk', lic.privateKey), pubJwk = await crypto.subtle.exportKey('jwk', lic.publicKey);
  const g = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const gJwk = Object.assign(await crypto.subtle.exportKey('jwk', g.publicKey), { kid: 'k1', alg: 'RS256', use: 'sig' });
  const CID = 'cliente-teste.apps.googleusercontent.com', T = { now: Date.UTC(2026, 10, 15, 12) };
  const idTok = async (sub, o = {}) => {
    const h = b64u(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'k1' }))), p = b64u(new TextEncoder().encode(JSON.stringify({ iss: 'https://accounts.google.com', aud: o.aud || CID, sub, email: sub + '@x.com', name: 'Teste', exp: Math.floor((T.now + (o.exp || H)) / 1000) })));
    return `${h}.${p}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', g.privateKey, new TextEncoder().encode(h + '.' + p)))}`;
  };
  const MP = { orders: {} }, calls = []; let ordN = 0;
  const fetchStub = async (url, o) => {
    calls.push(url);
    if (url.includes('oauth2/v3/certs')) return new Response(JSON.stringify({ keys: [gJwk] }));
    if (url === 'https://api.mercadopago.com/v1/orders' && o && o.method === 'POST') { const id = 'MPO' + (++ordN); return new Response(JSON.stringify({ id, status: 'created', checkout_url: 'https://mp.test/checkout/' + id }), { status: 201 }); }
    const m = /v1\/orders\/(\w+)/.exec(url); if (m) return MP.orders[m[1]] ? new Response(JSON.stringify(MP.orders[m[1]])) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 500 });
  };
  const { createApp } = await import('../worker/src/index.js');
  const db = d1(), env = { DB: db, GOOGLE_CLIENT_ID: CID, PUBLIC_URL: 'https://w.test', MP_ACCESS_TOKEN: 'tok', MP_WEBHOOK_SECRET: 'segredo', LICENSE_PRIVATE_JWK: JSON.stringify(privJwk) };
  const app = createApp({ fetch: fetchStub, now: () => T.now });
  const call = (m, p, body, auth, headers) => app(new Request('https://w.test' + p, { method: m, headers: Object.assign({ 'content-type': 'application/json' }, auth ? { authorization: auth } : {}, headers || {}), body: m === 'GET' ? undefined : JSON.stringify(body || {}) }), env);
  const sess = async (sub, dev, extra) => { const r = await call('POST', '/v1/session', Object.assign({ id_token: await idTok(sub), device_id: dev, device_name: 'Cel ' + dev }, extra)); return { r, j: await r.json() }; };
  const hmac = async (secret, s) => [...new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
  let SEQ = 0; const pay = async (payId, o) => { const ts = String(1700000000 + (++SEQ)), rq = 'req' + payId + '-' + SEQ, v1 = await hmac('segredo', `id:${String(payId).toLowerCase()};request-id:${rq};ts:${ts};`);
    return call('POST', `/v1/mp/webhook?data.id=${payId}&type=order`, { type: 'order', data: { id: payId } }, null, { 'x-signature': `ts=${ts},v1=${o && o.bad ? '00' + v1.slice(2) : v1}`, 'x-request-id': rq }); };
  const D1 = 'dev-aaaaaaaaaaaaaaaaaaaa', D2 = 'dev-bbbbbbbbbbbbbbbbbbbb', D3 = 'dev-cccccccccccccccccccc';

  /* 1-3: teste sem cartão, começa só no primeiro acesso autenticado, dura 336 h */
  ok(db.raw.prepare('SELECT COUNT(*) c FROM accounts').get().c === 0, 'sem acesso autenticado não existe teste');
  let a = await sess('u1', D1); ok(a.r.status === 200 && a.j.status === 'trial_active', 'novo usuário inicia o teste sem cartão');
  const acct = db.raw.prepare("SELECT * FROM accounts WHERE sub='u1'").get();
  ok(acct.trial_started_at === T.now, 'início do teste registrado pelo servidor');
  ok(a.j.trial_ends_at - acct.trial_started_at === 336 * H, 'o teste dura exatamente 336 horas');
  T.now += 336 * H - 1; let rf = await (await call('POST', '/v1/refresh', {}, `Device ${D1}.${a.j.device_secret}`)).json(); ok(rf.status === 'trial_active', '1 ms antes de 336 h ainda é teste');
  T.now += 1; rf = await (await call('POST', '/v1/refresh', {}, `Device ${D1}.${a.j.device_secret}`)).json(); ok(rf.status === 'trial_expired', 'em 336 h o teste termina');
  T.now = Date.UTC(2026, 10, 15, 12);

  /* identidade: token inválido, público errado, adulterado */
  ok((await call('POST', '/v1/session', { id_token: 'x.y.z', device_id: D1 })).status === 401, 'ID token inválido é recusado');
  ok((await call('POST', '/v1/session', { id_token: await idTok('u9', { aud: 'outro' }), device_id: D1 })).status === 401, 'ID token de outro cliente é recusado');
  ok((await call('POST', '/v1/session', { id_token: await idTok('u9', { exp: -H }), device_id: D3 })).status === 401, 'ID token expirado é recusado');
  ok((await call('POST', '/v1/refresh', {}, `Device ${D1}.errado`)).status === 401, 'segredo de aparelho errado é recusado');

  /* cliente do app ligado ao Worker */
  function makeClient(sub, devSeedConn) {
    const store = new Map(), cfg = new Map(), ctx = { console, crypto, TextEncoder, TextDecoder, atob, btoa, Request, Response, Uint8Array, JSON, Math, Promise, setTimeout, URL };
    ctx.window = ctx; ctx.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Teste)' }; ctx.document = { addEventListener() {}, visibilityState: 'visible' }; ctx.addEventListener = () => {};
    ctx.Date = class extends Date { static now() { return T.now; } };
    ctx.TB_LICENSE_API = 'https://w.test'; ctx.TB_LICENSE_PUBKEY = JSON.stringify(pubJwk);
    ctx.TB_SECURE = { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, getCfg: async k => cfg.get(k) ?? null, setCfg: async (k, v) => { cfg.set(k, v); } };
    ctx.TB_DRV = { idToken: async () => idTok(sub) }; ctx.TB_DRV_STATE = { conn: !!devSeedConn };
    ctx.TB_HTTP = async (url, o) => { if (ctx.OFFLINE) throw new Error('offline'); const p = url.replace('https://w.test', ''); const r = await call(o.method, p, o.body, o.headers && o.headers.authorization); return { status: r.status, data: await r.json() }; };
    const orig = { bolus: () => 'BOLUS', padroes: () => 'PADROES', perguntas: () => 'IA', exames: () => 'EX', exame: () => 'EX1', comparar: () => 'CMP', analise: () => 'AN', historico: () => 'HIST', insulinas: () => 'INS', relatorios: () => 'REL' };
    ctx.VIEWS = Object.assign({}, orig); ctx.TITLES = {}; ctx.MI = {}; ctx.render = () => {}; ctx.banners = () => ''; ctx.esc = s => String(s); ctx.go = () => {};
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(__dirname + '/../src/licensecore.js', 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(__dirname + '/../src/license.js', 'utf8'), ctx);
    ctx.run = s => vm.runInContext(s, ctx); ctx.orig = orig; ctx.store = store;
    ctx.run("licDevId = (async () => { let d = 'DEVID'; return d; })"); /* placeholder substituído abaixo */
    return ctx;
  }
  const mk = (sub, dev, conn = true) => { const c = makeClient(sub, conn); c.run(`licDevId = async () => ${JSON.stringify(dev)};`); return c; };
  const settle = () => new Promise(r => setTimeout(r, 30));
  const FREE = ['registrar-glicemia', 'registrar-insulina', 'historico', 'historico-insulina', 'exportar-excel', 'exportar-csv', 'backup', 'perfil', 'seguranca', 'hipoglicemia'];
  const PREM = ['bolus', 'padroes', 'rel-pdf', 'ia', 'exames', 'analise'];

  let c1 = mk('u2', 'dev-cliente-111111111111', false); await settle(); await c1.run('licLoad()');
  ok(c1.run('licStatus()') === 'pending_trial', 'sem login o app está em pending_trial');
  ok(PREM.every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === false) && FREE.every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === true), 'sem teste: premium bloqueado e gratuito liberado');
  c1.run('TB_DRV_STATE.conn = true'); await c1.run('licSession()'); ok(c1.run('licStatus()') === 'trial_active', 'após o primeiro acesso autenticado o teste começa');
  ok(PREM.concat(FREE).every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === true), 'teste ativo acessa todas as funcionalidades');

  /* 5-9: teste expirado */
  T.now += 336 * H; await c1.run('licRefresh(true)');
  ok(c1.run('licStatus()') === 'trial_expired', 'teste expirado identificado pelo token do servidor');
  ok(FREE.every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === true), 'expirado: registrar glicemia/insulina, histórico e exportar continuam');
  ok(PREM.every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === false), 'expirado: premium indisponível');
  ok(['bolus','padroes','perguntas','exames','exame','comparar','analise'].every(k => c1.run(`VIEWS.${k}()`).includes('premium')) && c1.run('VIEWS.padroes()').includes('premium') && c1.run('VIEWS.perguntas()').includes('premium'), 'telas premium mostram aviso informativo');
  ok(['historico', 'insulinas', 'relatorios'].every(k => c1.run(`VIEWS.${k}`) === c1.orig[k]), 'telas gratuitas não foram alteradas');
  ok(c1.run('licLockView("bolus")').includes('Nada foi apagado') && c1.run('licLockView("bolus")').includes('exportar'), 'aviso diz que registros, histórico e exportação seguem gratuitos');
  const app_js = fs.readFileSync(__dirname + '/../src/app.js', 'utf8'), ai_js = fs.readFileSync(__dirname + '/../native/ai-core.js', 'utf8');
  ok(/case 'rep-xlsx': el\.disabled/.test(app_js) && !/case 'rep-xlsx'[^\n]*licAllowed/.test(app_js), 'exportação em Excel não passa pelo portão');
  ok(/TB_GATE\('ia'\)/.test(ai_js), 'toda chamada de IA passa pelo portão premium');
  ok(Object.keys(vm.runInContext('LIC_PREMIUM', vm.createContext({}) && c1)).join() === 'bolus,padroes,exames,analise,rel-pdf,ia,metricas', 'apenas os 6 recursos combinados + a Central de Métricas são premium');
  T.now = Date.UTC(2026, 10, 15, 12);
  T.now += 336 * H; /* continua expirado nos testes seguintes */

  /* 10: compra, webhook, licença vitalícia */
  ok((await call('POST', '/v1/order', {}, `Device ${D1}.errado`)).status === 401, 'pedido exige aparelho autenticado');
  await c1.run('licBuy()'); const ord = db.raw.prepare("SELECT * FROM orders WHERE sub='u2'").get();
  ok(ord && ord.status === 'pending' && ord.price_cents === 2990, 'pedido criado a R$ 29,90');
  await c1.run('licRefresh(true)'); ok(c1.run('licStatus()') === 'payment_pending', 'pagamento pendente após criar pedido');
  ok((await pay('MPO1', { bad: true })).status === 401, 'webhook com assinatura inválida é recusado');
  const mkOrd = (o, amt, st, det) => ({ id: o.mp_order_id, external_reference: o.id, status: st || 'processed', status_detail: det || 'accredited', total_amount: amt, currency: 'BRL', transactions: { payments: [{ id: 'PAY' + o.mp_order_id, status: st || 'processed', amount: amt, paid_amount: amt }] } });
  const ordX = db.raw.prepare("SELECT * FROM orders WHERE id=?").get(ord.id); MP.orders[ordX.mp_order_id] = mkOrd(ordX, '29.90');
  ok((await pay(ordX.mp_order_id)).status === 200, 'webhook assinado é aceito');
  await c1.run('licRefresh(true)'); ok(c1.run('licStatus()') === 'lifetime_active', 'licença vitalícia ativada pelo servidor');
  ok(PREM.concat(FREE).every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === true), 'licença vitalícia acessa todas as funcionalidades');
  await pay(ordX.mp_order_id); ok(db.raw.prepare("SELECT COUNT(*) c FROM licenses WHERE sub='u2'").get().c === 1, 'webhook repetido é idempotente');
  /* valor divergente não ativa */
  await sess('u3', D2); const rr = await sess('u3', D2); const secret3 = rr.j.device_secret, ord3 = await (await call('POST', '/v1/order', {}, `Device ${D2}.${secret3}`)).json();
  const o3 = db.raw.prepare('SELECT * FROM orders WHERE id=?').get(ord3.order_id); MP.orders[o3.mp_order_id] = mkOrd(o3, '1.00'); await pay(o3.mp_order_id);
  ok(!db.raw.prepare("SELECT * FROM licenses WHERE sub='u3'").get(), 'pagamento com valor diferente não ativa licença');

  /* 15: mudança de preço não altera licença comprada */
  db.raw.exec("UPDATE config SET value='3990' WHERE key='price_cents'");
  await c1.run('licRefresh(true)'); ok(db.raw.prepare("SELECT price_cents FROM licenses WHERE sub='u2'").get().price_cents === 2990 && c1.run('LK.info.paid') === 2990, 'licença já adquirida mantém R$ 29,90');
  const ord4 = await (await call('POST', '/v1/order', {}, `Device ${D2}.${secret3}`)).json(); ok(ord4.price_cents === 3990, 'novas vendas usam o novo preço');
  db.raw.exec("UPDATE config SET value='2990' WHERE key='price_cents'");

  /* 11-14: reinstalação, troca e limite de aparelhos */
  const s0 = db.raw.prepare("SELECT trial_started_at t FROM accounts WHERE sub='u1'").get().t;
  const re = await sess('u1', 'dev-reinstalado-0000000'); ok(re.r.status === 200 && re.j.status === 'trial_expired' && db.raw.prepare("SELECT trial_started_at t FROM accounts WHERE sub='u1'").get().t === s0, 'reinstalar com novo aparelho não reinicia o teste');
  const x2 = await sess('u1', D2 + 'x'); ok(x2.r.status === 409 && x2.j.error === 'device_limit' && x2.j.devices.length === 2, 'terceiro aparelho é recusado pelo servidor (limite de 2)');
  const x3 = await sess('u1', D2 + 'x', { replace_device_id: D1 }); ok(x3.r.status === 200, 'trocar de aparelho é gratuito (libera uma vaga)');
  const before = db.raw.prepare('SELECT (SELECT COUNT(*) FROM accounts) a, (SELECT COUNT(*) FROM licenses) l').get();
  await call('POST', '/v1/devices/remove', { id: D2 + 'x' }, `Device ${D2}x.${x3.j.device_secret}`);
  const after = db.raw.prepare('SELECT (SELECT COUNT(*) FROM accounts) a, (SELECT COUNT(*) FROM licenses) l').get();
  ok(before.a === after.a && before.l === after.l, 'remover aparelho não mexe em contas nem licença');
  let abuse = 0; for (let i = 0; i < 9; i++) { const r = await sess('u5', 'dev-abuso-' + String(i).padStart(10, '0'), { replace_device_id: i ? 'dev-abuso-' + String(i - 1).padStart(10, '0') : undefined }); if (r.r.status === 429) abuse++; } ok(abuse > 0, 'proteção contra abuso de trocas');
  const tables = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x => x.name).sort().join();
  ok(tables === 'accounts,config,devices,events,installs,licenses,orders,rate_limits,trial_devices,webhook_log', 'banco comercial não tem tabelas de saúde');
  const lj = fs.readFileSync(__dirname + '/../src/license.js', 'utf8');
  ok(!/Store\.|indexedDB|glicotrack|S\.records|putMany/.test(lj), 'o licenciamento não toca nos dados de saúde nem no IndexedDB glicotrack');

  /* 16: falhas de conexão */
  const c2 = mk('u2', 'dev-cliente-111111111111'); await settle(); c2.store.set('lic-token', c1.store.get('lic-token')); c2.store.set('lic-secret', c1.store.get('lic-secret'));
  await c2.run('licLoad()'); c2.OFFLINE = true; let threw = false; try { await c2.run('licRefresh(true)'); await c2.run('licSession()'); await c2.run('licBuy()'); } catch (e) { threw = true; }
  ok(!threw, 'falha de rede não gera erro para o usuário'); ok(FREE.every(f => c2.run(`licAllowed(${JSON.stringify(f)})`) === true), 'sem internet os registros essenciais seguem livres');
  ok(c2.run('licStatus()') === 'lifetime_active' && c2.run('licAllowed("bolus")') === true, 'sem internet a licença vale pelo token assinado');
  T.now += 31 * DAY; ok(c2.run('licAllowed("bolus")') === false && FREE.every(f => c2.run(`licAllowed(${JSON.stringify(f)})`) === true), 'passada a tolerância offline (30 dias na vitalícia) só o premium pausa; o gratuito segue');
  T.now -= 31 * DAY;
  /* relógio e token adulterados */
  const tok = c1.store.get('lic-token'), forged = tok.split('.')[0] + '.' + tok.split('.')[1].slice(0, -2) + 'AA';
  const c3 = mk('u2', 'dev-cliente-111111111111'); c3.store.set('lic-token', forged); await c3.run('licLoad()'); ok(c3.run('licAllowed("bolus")') === false, 'token adulterado não libera premium');
  const c4 = mk('u1', 'dev-cliente-222222222222'); c4.store.set('lic-token', a.j.token); await c4.run('licLoad()'); T.now = Date.UTC(2026, 10, 15, 12) + 400 * H;
  ok(c4.run('licAllowed("bolus")') === false, 'token de teste vencido não libera premium'); T.now = Date.UTC(2026, 10, 15, 12);
  ok(core.licClock(T.now + 5 * DAY, T.now) === T.now + 5 * DAY, 'relógio protegido contra recuo');
  ok(core.licPremium({ v: 1, st: 'trial_active', te: T.now + DAY, iat: T.now, vexp: T.now + 7 * DAY }, T.now - 2 * DAY) === false, 'data do aparelho anterior ao token é suspeita');

  /* 17: reembolso/chargeback não apaga nem bloqueia dados */
  MP.orders[ordX.mp_order_id] = mkOrd(ordX, '29.90', 'refunded', 'refunded'); await pay(ordX.mp_order_id); await c1.run('licRefresh(true)');
  ok(c1.run('licStatus()') === 'refunded' && c1.run('licAllowed("bolus")') === false, 'reembolso encerra o premium');
  ok(FREE.every(f => c1.run(`licAllowed(${JSON.stringify(f)})`) === true), 'reembolso não bloqueia registros, histórico nem exportação');
  ok(db.raw.prepare("SELECT status FROM licenses WHERE sub='u2'").get().status === 'refunded', 'licença marcada como reembolsada, sem apagar a conta');
  const states = ['pending_trial', 'trial_active', 'trial_expired', 'payment_pending', 'lifetime_active', 'refunded', 'revoked']; ok(states.every(s => core.LIC_STATES.includes(s)), 'estados de licença previstos');
  console.log(fail ? `${fail} falha(s) em ${n}` : `test8 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e); process.exit(1); });
