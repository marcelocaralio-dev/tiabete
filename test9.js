// Revisão final do licenciamento: produção x desenvolvimento, Mercado Pago, webhook, Worker, offline e segredos.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const core = require('../src/licensecore.js');
const ROOT = path.join(__dirname, '..');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const H = 3600e3, DAY = 24 * H, b64u = u => core.licB64u(new Uint8Array(u));
function d1() {
  const db = new DatabaseSync(':memory:'); for (const f of fs.readdirSync(path.join(ROOT, 'worker/migrations')).sort()) db.exec(fs.readFileSync(path.join(ROOT, 'worker/migrations', f), 'utf8'));
  return { raw: db, prepare(sql) { const st = db.prepare(sql); return { bind(...a) { return { first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); return {}; } }; } }; } };
}
(async () => {
  /* ---------- 1) produção x desenvolvimento no app ---------- */
  const FREE = ['registrar-glicemia', 'registrar-insulina', 'historico', 'exportar-excel', 'exportar-csv', 'backup', 'hba1c'];
  const PREM = Object.keys(vm.runInContext('LIC_PREMIUM', (() => { const c = vm.createContext({ window: {}, document: { addEventListener() {} }, VIEWS: {}, TITLES: {}, MI: {}, addEventListener() {}, crypto, TextEncoder, TextDecoder }); c.window = c; vm.runInContext(fs.readFileSync(ROOT + '/src/licensecore.js', 'utf8') + '\n' + fs.readFileSync(ROOT + '/src/license.js', 'utf8'), c); return c; })()));
  function bare(dev, extra) {
    const c = { console, crypto, TextEncoder, TextDecoder, atob, btoa, VIEWS: { bolus: () => 'B', historico: () => 'H' }, TITLES: {}, MI: {}, document: { addEventListener() {}, visibilityState: 'visible' }, addEventListener() {}, render() {}, banners: () => '', esc: String, go() {}, TB_DEV_MODE: dev, Date, navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14)' } };
    Object.assign(c, extra || {}); c.window = c; vm.createContext(c);
    vm.runInContext(fs.readFileSync(ROOT + '/src/licensecore.js', 'utf8'), c); vm.runInContext(fs.readFileSync(ROOT + '/src/license.js', 'utf8'), c); c.run = s => vm.runInContext(s, c); return c;
  }
  const prod = bare(false);
  ok(PREM.length === 7 && PREM.every(f => prod.run(`licAllowed(${JSON.stringify(f)})`) === false), 'PRODUÇÃO sem configuração: nenhum premium é liberado');
  ok(FREE.every(f => prod.run(`licAllowed(${JSON.stringify(f)})`) === true), 'PRODUÇÃO sem configuração: tudo que é gratuito segue livre');
  ok(prod.run('licStatus()') === 'unconfigured' && prod.run('VIEWS.bolus()').includes('premium') && prod.run('VIEWS.historico()') === 'H', 'produção sem configuração: bloqueio informativo só no premium, histórico intacto');
  ok(prod.run('viewLicenca()').includes('Registrar glicemia e insulina'), 'tela Licença explica o que segue gratuito');
  const dev = bare(true); ok(PREM.every(f => dev.run(`licAllowed(${JSON.stringify(f)})`) === true) && dev.run('licStatus()') === 'dev', 'modo de desenvolvimento explícito libera o premium para testes');
  const pubTmp = bare(false, { TB_LICENSE_API: 'https://x.test', TB_LICENSE_PUBKEY: '' }); ok(pubTmp.run('licAllowed("bolus")') === false, 'API sem chave pública não libera premium');
  const bk = prod; ok(!/dev/i.test('') && bk.run('LK.dev') === false, 'dev desligado por padrão');

  /* ---------- 2) build: produção por padrão, sem segredos, validação de config ---------- */
  const cfgApi = path.join(ROOT, 'config/license-api.txt'), cfgKey = path.join(ROOT, 'config/license-public-key.json');
  const had = [cfgApi, cfgKey].map(f => fs.existsSync(f) ? fs.readFileSync(f) : null);
  const build = args => cp.spawnSync('node', ['scripts/build-web.js', ...args], { cwd: ROOT, encoding: 'utf8' });
  try {
    [cfgApi, cfgKey].forEach(f => fs.rmSync(f, { force: true }));
    let r = build([]); let html = fs.readFileSync(ROOT + '/www/index.html', 'utf8');
    ok(r.status === 0 && /TB_DEV_MODE = false/.test(html) && /TB_LICENSE_API = ""/.test(html), 'build padrão = produção, sem servidor');
    r = build(['--dev']); html = fs.readFileSync(ROOT + '/www/index.html', 'utf8'); ok(/TB_DEV_MODE = true/.test(html), 'modo dev só com --dev');
    fs.writeFileSync(cfgApi, 'https://tiabete-license-api.exemplo.workers.dev/rota?token=TKNZZ9');
    r = build([]); html = fs.readFileSync(ROOT + '/www/index.html', 'utf8'); ok(/TB_LICENSE_API = ""/.test(html) && !/TKNZZ9/.test(html), 'license-api.txt com caminho ou token é rejeitado');
    fs.writeFileSync(cfgApi, 'https://tiabete-license-api.exemplo.workers.dev\n');
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    fs.writeFileSync(cfgKey, JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey)));
    r = build([]); ok(r.status !== 0 && /PRIVADA/.test(r.stderr), 'build recusa chave com parte privada');
    fs.writeFileSync(cfgKey, JSON.stringify(await crypto.subtle.exportKey('jwk', kp.publicKey)));
    r = build([]); html = fs.readFileSync(ROOT + '/www/index.html', 'utf8');
    ok(r.status === 0 && html.includes('tiabete-license-api.exemplo.workers.dev') && !/"d":"/.test(html.replace(/\\"/g, '"')), 'chave pública e endereço entram no app; nenhuma chave privada');
    ok(!/MP_ACCESS_TOKEN|MP_WEBHOOK_SECRET|LICENSE_PRIVATE_JWK|APP_USR-|Bearer TEST-/.test(html), 'o APK não contém segredos do Mercado Pago nem chave de assinatura');
  } finally { [cfgApi, cfgKey].forEach((f, i) => { fs.rmSync(f, { force: true }); if (had[i]) fs.writeFileSync(f, had[i]); }); fs.rmSync(ROOT + '/www', { recursive: true, force: true }); }
  /* Procura tokens do Mercado Pago e chaves privadas escritos em arquivos do repositório. Só Node (funciona no Windows); erro de leitura derruba o teste. */
  const SECRET_RE = /APP_USR-[0-9]|TEST-[0-9a-f]{8}-|"d":"[A-Za-z0-9_-]{40}/;
  const found = [];
  const scan = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) { scan(f); continue; }
      if (!e.isFile()) continue;
      const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
      lines.forEach((ln, i) => { if (SECRET_RE.test(ln)) found.push(path.relative(ROOT, f) + ':' + (i + 1)); });
    }
  };
  for (const d of ['worker', 'src', 'native', 'config', 'docs', 'scripts']) scan(path.join(ROOT, d));
  ok(found.length === 0, 'nenhum token ou chave privada escrito no repositório' + (found.length ? ' (achado em ' + found.join(', ') + ')' : ''));
  const toml = fs.readFileSync(ROOT + '/worker/wrangler.toml', 'utf8'); ok(/wrangler secret put/.test(toml) && !/MP_ACCESS_TOKEN\s*=|MP_WEBHOOK_SECRET\s*=|LICENSE_PRIVATE_JWK\s*=/.test(toml), 'segredos só como Worker Secrets (wrangler.toml sem valores)');

  const tm = fs.readFileSync(ROOT + '/worker/wrangler.toml', 'utf8'), dc = fs.readFileSync(ROOT + '/docs/LICENCIAMENTO.md', 'utf8');
  ok(/^name = "tiabete-license-api"$/m.test(tm) && /^binding = "DB"/m.test(tm) && /^database_name = "tiabete-licenses"$/m.test(tm) && /^migrations_dir = "migrations"$/m.test(tm), 'wrangler.toml usa o Worker, o banco e o binding já criados');
  ok(/^database_id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/im.test(tm), 'database_id mantém o UUID real do banco D1');
  ok(!/tiabete-licenca/.test(dc + tm) && /tiabete-licenses/.test(dc) && /tiabete-license-api/.test(dc), 'documentação e configuração não citam os nomes antigos');
  ok(/^PUBLIC_URL = "https?:\/\/[^"]+"/m.test(tm) && /^GOOGLE_CLIENT_ID = "[^"]+\.apps\.googleusercontent\.com"/m.test(tm), 'valores públicos reais são preservados');

  /* ---------- 3) Worker: pagamento, webhook, abuso ---------- */
  const L = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', L.privateKey), pub = await crypto.subtle.exportKey('jwk', L.publicKey);
  const G = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const gJwk = Object.assign(await crypto.subtle.exportKey('jwk', G.publicKey), { kid: 'k1', alg: 'RS256' });
  const CID = 'cid.apps.googleusercontent.com', T = { now: Date.UTC(2026, 10, 15, 12) }, MP = { orders: {}, down: false };
  const idTok = async (sub, o = {}) => { const hh = b64u(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'k1' }))), pp = b64u(new TextEncoder().encode(JSON.stringify({ iss: o.iss || 'https://accounts.google.com', aud: CID, sub: o.noSub ? undefined : sub, email: sub + '@x.com', exp: Math.floor((T.now + (o.exp || H)) / 1000) }))); return `${hh}.${pp}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', G.privateKey, new TextEncoder().encode(hh + '.' + pp)))}`; };
  let ordBody = null, ordHeaders = null, ordUrl = null, ordN = 0, legacyCalls = 0;
  const fetchStub = async (url, o) => {
    if (url.includes('oauth2/v3/certs')) return new Response(JSON.stringify({ keys: [gJwk] }));
    if (url.includes('checkout/preferences') || url.includes('/v1/payments')) { legacyCalls++; return new Response('{}', { status: 500 }); }
    if (url === 'https://api.mercadopago.com/v1/orders' && o && o.method === 'POST') { ordUrl = url; ordBody = JSON.parse(o.body); ordHeaders = o.headers; if (MP.createFail) return new Response('{}', { status: 500 }); const id = 'MPO' + (++ordN); return new Response(JSON.stringify({ id, status: 'created', status_detail: 'created', checkout_url: MP.noUrl ? undefined : 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=' + id }), { status: 201 }); }
    if (MP.down) return new Response('{}', { status: 503 });
    const m = /v1\/orders\/([\w-]+)$/.exec(url); if (m) return MP.orders[m[1]] ? new Response(JSON.stringify(MP.orders[m[1]])) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 500 });
  };
  const { createApp, mpSignatureOk } = await import('../worker/src/index.js');
  const db = d1(), env = { DB: db, GOOGLE_CLIENT_ID: CID, PUBLIC_URL: 'https://w.test', MP_ACCESS_TOKEN: 'seg-token', MP_WEBHOOK_SECRET: 'segredo', LICENSE_PRIVATE_JWK: JSON.stringify(priv) };
  const app = createApp({ fetch: fetchStub, now: () => T.now });
  const call = (m, p, body, auth, headers) => app(new Request('https://w.test' + p, { method: m, headers: Object.assign({ 'content-type': 'application/json' }, auth ? { authorization: auth } : {}, headers || {}), body: m === 'GET' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body || {})) }), env);
  const sess = async (sub, dev, extra, ip) => { const r = await call('POST', '/v1/session', Object.assign({ id_token: await idTok(sub), device_id: dev, device_name: 'Cel' }, extra), null, ip ? { 'cf-connecting-ip': ip } : {}); return { r, j: await r.json() }; };
  const hmac = async (k, s) => [...new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', new TextEncoder().encode(k), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
  let SEQ = 0;
  /* notificação do tópico "orders": data.id é o id da Order no Mercado Pago */
  const hook = async (oid, o = {}) => { const ts = o.ts || String(1700000000000 + (++SEQ)), rq = o.rq || 'rq-' + SEQ, v1 = o.v1 || await hmac('segredo', `id:${String(oid).toLowerCase()};request-id:${rq};ts:${ts};`), qid = o.qid ?? oid;
    return call('POST', `/v1/mp/webhook?data.id=${qid}&type=${o.type || 'order'}`, o.body || { type: o.type || 'order', action: 'order.processed', data: { id: oid } }, null, Object.assign({ 'x-request-id': rq }, o.noSig ? {} : { 'x-signature': `ts=${ts},v1=${v1}` }, o.headers || {})); };
  const orderFor = async (sub, dev) => { const s = await sess(sub, dev); const r = await call('POST', '/v1/order', {}, `Device ${dev}.${s.j.device_secret}`); return { s, o: await r.json(), r }; };
  const lic = sub => db.raw.prepare('SELECT * FROM licenses WHERE sub=?').get(sub), ordr = id => db.raw.prepare('SELECT * FROM orders WHERE id=?').get(id);
  const mid = o => ordr(o.order_id).mp_order_id;
  /* Order como a API devolve em GET /v1/orders/{id}; `top` altera a Order, `pay` altera o pagamento. Devolve o id da Order. */
  const put = (o, top, pay) => { const id = (top && top.id) || mid(o), amt = (o.price_cents / 100).toFixed(2);
    MP.orders[id] = Object.assign({ id, type: 'online', processing_mode: 'manual', external_reference: o.order_id, status: 'processed', status_detail: 'accredited', total_amount: amt, total_paid_amount: amt, currency: 'BRL', transactions: { payments: [Object.assign({ id: 'PAY-' + id, status: 'processed', status_detail: 'accredited', amount: amt, paid_amount: amt }, pay || {})] } }, top || {}); return id; };
  const waiting = { status: 'created', status_detail: 'created' };

  /* 3a) criação do pedido conforme a Orders API oficial */
  const A = await orderFor('ua', 'dev-ua-000000000000');
  ok(A.r.status === 200 && ordUrl === 'https://api.mercadopago.com/v1/orders' && ordHeaders.authorization === 'Bearer seg-token', 'Orders: POST em /v1/orders com Authorization Bearer do servidor');
  ok(ordHeaders['x-idempotency-key'] === A.o.order_id && ordHeaders['x-idempotency-key'].length <= 128, 'Orders: X-Idempotency-Key obrigatório, único por pedido');
  ok(ordBody.type === 'online' && ordBody.processing_mode === 'manual' && ordBody.total_amount === '29.90' && typeof ordBody.total_amount === 'string', 'Orders: type online, processing_mode manual, total_amount em string (R$ 29,90)');
  ok(ordBody.items.length === 1 && ordBody.items[0].quantity === 1 && ordBody.items[0].unit_price === '29.90' && ordBody.items[0].title, 'Orders: items com title, quantity e unit_price; total = soma dos itens');
  ok(ordBody.external_reference === A.o.order_id && ordBody.external_reference.length <= 64 && /^https:\/\//.test(ordBody.config.online.success_url) && /^https:\/\//.test(ordBody.config.online.failure_url) && /^https:\/\//.test(ordBody.config.online.pending_url) && ordBody.config.online.auto_return === 'approved', 'Orders: external_reference do pedido e URLs de retorno HTTPS em config.online');
  ok(A.o.checkout_url === 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=MPO1' && ordr(A.o.order_id).mp_order_id === 'MPO1' && A.o.price_cents === 2990, 'checkout_url da Order devolvido ao app; id da Order gravado no pedido');
  ok(!('access_token' in A.o) && !JSON.stringify(A.o).includes('seg-token'), 'a resposta ao app não carrega credenciais');
  const B = await orderFor('ub', 'dev-ub-000000000000'); ok(B.o.order_id !== A.o.order_id && mid(B.o) !== mid(A.o), 'pedido e external_reference únicos');

  /* 3b) o retorno do checkout não é pagamento aprovado */
  ok((await call('GET', '/v1/return?order=' + A.o.order_id)).status === 200 && !lic('ua'), 'voltar do checkout não cria licença');
  /* 3c) Pix pendente / em análise não libera */
  let ia = put(A.o, waiting); let r = await (await hook(ia)).json(); ok(r.result === 'pending' && !lic('ua'), 'Order criada/Pix pendente não libera licença');
  put(A.o, { status: 'processing', status_detail: 'in_process' }); r = await (await hook(ia)).json(); ok(!lic('ua'), 'Order em análise não libera licença');
  put(A.o, { status: 'action_required', status_detail: 'waiting_capture' }); r = await (await hook(ia)).json(); ok(!lic('ua'), 'pagamento só autorizado (action_required) não libera licença');
  put(A.o, { status: 'failed', status_detail: 'rejected_by_issuer' }); r = await (await hook(ia)).json(); ok(!lic('ua') && ordr(A.o.order_id).status === 'pending', 'tentativa falha não libera e não fecha o pedido (nova tentativa possível)');
  /* 3d) validação do webhook */
  ok((await hook(ia, { noSig: true })).status === 401, 'sem x-signature: recusado');
  ok((await hook(ia, { v1: 'a'.repeat(64) })).status === 401, 'assinatura errada: recusada');
  ok((await hook(ia, { v1: 'zz' })).status === 401, 'assinatura malformada: recusada');
  const okReq = new Request('https://w.test/v1/mp/webhook?data.id=ABC123', { method: 'POST', headers: { 'x-request-id': 'r1', 'x-signature': 'ts=1700000000000,v1=' + await hmac('segredo', 'id:abc123;request-id:r1;ts:1700000000000;') } });
  ok(await mpSignatureOk(okReq, new URL(okReq.url), 'segredo'), 'manifesto id:(minúsculo);request-id;ts; confere com HMAC-SHA256');
  ok(!(await mpSignatureOk(okReq, new URL(okReq.url), 'outro-segredo')), 'segredo diferente falha');
  ok((await hook(ia, { qid: 'MPO9', v1: await hmac('segredo', 'id:mpo9;request-id:rq-x;ts:1700000000999;'), rq: 'rq-x', ts: '1700000000999' })).status === 400, 'data.id da URL diferente do corpo é recusado');
  ok((await hook(ia, { body: { type: 'order', data: { id: '../x' } }, qid: '../x', v1: await hmac('segredo', 'id:../x;request-id:rq-y;ts:1700000000998;'), rq: 'rq-y', ts: '1700000000998' })).status === 400, 'data.id inválido é recusado');
  r = await (await hook(ia, { type: 'payment', body: { type: 'payment', data: { id: ia } } })).json(); ok(r.ignored === 'not_order' && !lic('ua'), 'tópico que não é "orders" (ex.: payment legado) é ignorado');
  MP.orders.MPOX = Object.assign({}, MP.orders[ia], { id: 'OUTRA' }); r = await hook('MPOX'); ok(r.status === 400 && !lic('ua'), 'Order devolvida com id diferente do notificado é recusada');
  /* 3e) aprovado ativa, só uma vez, com o valor do pedido; a Order é consultada na API antes */
  put(A.o); r = await (await hook(ia)).json(); ok(r.result === 'activated' && lic('ua').status === 'active' && lic('ua').price_cents === 2990 && lic('ua').payment_id === 'PAY-' + ia, 'Order processed/accredited libera a licença (consultada direto na API)');
  const sameHook = { ts: '1700000009999', rq: 'rq-dup' }; await hook(ia, sameHook); r = await (await hook(ia, sameHook)).json(); ok(r.duplicate === true, 'notificação repetida é ignorada (anti-repetição)');
  r = await (await hook(ia)).json(); ok(r.result === 'already_processed' && db.raw.prepare("SELECT COUNT(*) c FROM licenses WHERE sub='ua'").get().c === 1, 'nova notificação da mesma Order não duplica a licença');
  /* o corpo da notificação nunca é fonte de verdade: corpo mente "processed", API diz created */
  const Z = await orderFor('uz', 'dev-uz-000000000000'); const iz = put(Z.o, waiting); r = await (await hook(iz, { body: { type: 'order', action: 'order.processed', data: { id: iz, status: 'processed', status_detail: 'accredited', total_amount: '29.90' } } })).json(); ok(!lic('uz'), 'corpo da notificação dizendo "processed" não ativa: vale a consulta à API');
  /* 3f) conferências */
  const C = await orderFor('uc', 'dev-uc-000000000000'), ic = mid(C.o);
  put(C.o, { currency: 'USD' }); await hook(ic); ok(!lic('uc'), 'moeda diferente de BRL não ativa');
  put(C.o, { total_amount: '1.00' }, { amount: '1.00', paid_amount: '1.00' }); await hook(ic); ok(!lic('uc'), 'valor diferente do pedido não ativa');
  put(C.o, null, { paid_amount: '1.00' }); await hook(ic); ok(!lic('uc'), 'valor pago diferente do pedido não ativa');
  put(C.o, null, { id: '' }); await hook(ic); ok(!lic('uc'), 'Order sem pagamento identificado não ativa');
  put(C.o, { external_reference: 'ord_inexistente' }); r = await (await hook(ic)).json(); ok(r.result === 'no_order' && !lic('uc'), 'Order de pedido desconhecido é ignorada');
  put(C.o, null, { id: 'PAY-' + ia }); r = await (await hook(ic)).json(); ok(r.result === 'payment_reused' && !lic('uc'), 'pagamento já usado em outro pedido não ativa');
  MP.orders.MPOFAKE = Object.assign({}, MP.orders[ic], { id: 'MPOFAKE', external_reference: C.o.order_id, status: 'processed', status_detail: 'accredited', total_amount: '29.90', currency: 'BRL', transactions: { payments: [{ id: 'PAY-FAKE', status: 'processed', amount: '29.90', paid_amount: '29.90' }] } });
  r = await (await hook('MPOFAKE')).json(); ok(r.result === 'order_mismatch' && !lic('uc'), 'Order de outro id apontando para o meu pedido não ativa (id da Order gravado na criação)');
  put(C.o); await hook(ic); ok(lic('uc') && lic('uc').sub === 'uc' && ordr(C.o.order_id).sub === 'uc', 'licença vai para a conta dona do pedido');
  ok(!lic('ub'), 'pedidos de outras contas não são afetados');
  const ib = put(B.o, { status: 'canceled', status_detail: 'canceled' }, { status: 'canceled' }); await hook(ib); ok(ordr(B.o.order_id).status === 'failed' && !lic('ub'), 'Order cancelada/expirada não ativa e fecha o pedido');
  /* 3g) reembolso */
  put(A.o, { status: 'refunded', status_detail: 'refunded' }, { status: 'refunded' }); await hook(ia); ok(lic('ua').status === 'refunded' && ordr(A.o.order_id).status === 'refunded', 'reembolso confirmado encerra o premium');
  put(A.o); r = await (await hook(ia)).json(); ok(r.result === 'order_refunded' && lic('ua').status === 'refunded', 'Order reembolsada não reativa mesmo se uma notificação antiga voltar');
  put(C.o, { status: 'refunded', status_detail: 'refunded' }); await hook(ic); ok(lic('uc').status === 'refunded', 'Order refunded também encerra (mesmo sem o pagamento marcado)');
  const D2 = await orderFor('ud', 'dev-ud-000000000000'), id2 = put(D2.o); await hook(id2); ok(lic('ud').status === 'active', 'nova compra ativa');
  put(D2.o, { status_detail: 'partially_refunded' }); await hook(id2); ok(lic('ud').status === 'active', 'reembolso parcial não ativa de novo nem derruba a licença já ativa');
  const E = await orderFor('ue', 'dev-ue-000000000000'), ie = put(E.o); await hook(ie); put(E.o, null, { status: 'charged_back' }); await hook(ie); ok(lic('ue').status === 'revoked', 'chargeback revoga');
  const snapRef = await (await call('POST', '/v1/refresh', {}, `Device dev-ua-000000000000.${A.s.j.device_secret}`)).json(); ok(snapRef.status === 'refunded' && snapRef.token, 'após reembolso o servidor emite token sem premium (dados e conta intactos)');
  /* 3h) rede de segurança: webhook perdido, o servidor consulta a Order na API ao atualizar */
  const F = await orderFor('uf', 'dev-uf-000000000000'); put(F.o);
  const rf = await (await call('POST', '/v1/refresh', {}, `Device dev-uf-000000000000.${F.s.j.device_secret}`)).json(); ok(rf.status === 'lifetime_active', 'webhook perdido: "Atualizar situação" confirma direto na API (GET /v1/orders)');
  const Gg = await orderFor('ug', 'dev-ug-000000000000'); put(Gg.o, waiting);
  const rg = await (await call('POST', '/v1/refresh', {}, `Device dev-ug-000000000000.${Gg.s.j.device_secret}`)).json(); ok(rg.status === 'payment_pending', 'Pix pendente aparece como payment_pending, sem premium além do teste');
  MP.down = true; const rh = await (await call('POST', '/v1/refresh', {}, `Device dev-ug-000000000000.${Gg.s.j.device_secret}`)).json(); ok(rh.token && rh.status === 'payment_pending', 'Mercado Pago fora do ar não derruba a atualização de licença');
  ok((await hook(mid(Gg.o))).status === 502, 'Mercado Pago fora do ar: webhook responde 502 para ser reenviado'); MP.down = false;
  ok(legacyCalls === 0, 'nenhuma chamada à API legada (preferences / payments)');
  /* Mercado Pago recusa a criação: pedido local fecha como failed e o app recebe erro claro */
  MP.createFail = true; const Hm = await orderFor('ucr', 'dev-ucr-00000000000'); MP.createFail = false;
  ok(Hm.r.status === 502 && Hm.o.error === 'mp_unavailable' && db.raw.prepare("SELECT status FROM orders WHERE sub='ucr'").get().status === 'failed', 'falha ao criar a Order no Mercado Pago: erro 502 e pedido fechado');
  MP.noUrl = true; const Hn = await orderFor('ucn', 'dev-ucn-00000000000'); MP.noUrl = false; ok(Hn.r.status === 502 && !Hn.o.checkout_url, 'Order sem checkout_url não é entregue ao app');

  /* 3i) Worker: segurança geral */
  ok((await call('POST', '/v1/session', { id_token: await idTok('x', { iss: 'https://evil.test' }), device_id: 'dev-xxxxxxxxxxxxxxxx' })).status === 401, 'ID token com emissor errado é recusado');
  ok((await call('POST', '/v1/session', { id_token: await idTok('x', { noSub: true }), device_id: 'dev-xxxxxxxxxxxxxxxx' })).status === 401, 'ID token sem sub é recusado');
  ok((await call('POST', '/v1/session', 'x'.repeat(20000))).status === 400, 'corpo grande demais é recusado');
  ok((await call('POST', '/v1/session', { id_token: await idTok('x'), device_id: 'curto' })).status === 400, 'device_id fora do formato é recusado');
  ok((await call('GET', '/v1/admin')).status === 404 && (await call('POST', '/v1/admin/price', {})).status === 404 && (await call('POST', '/v1/config', {})).status === 404, 'não existem rotas administrativas públicas');
  const wk = fs.readFileSync(ROOT + '/worker/src/index.js', 'utf8'); ok(!/['"`]\/v1\/admin|\/v1\/price|\/v1\/config/.test(wk) && !/process\.env|APP_USR/.test(wk), 'Worker sem rota de admin e sem segredo escrito no código');
  let lim = 0; for (let i = 0; i < 45; i++) { const x = await sess('ur' + i, 'dev-rate-' + String(i).padStart(10, '0'), null, '1.2.3.4'); if (x.r.status === 429) lim++; } ok(lim >= 4, 'limite de frequência por IP no login de licença');
  const Hh = await sess('uh', 'dev-uh-000000000000'); let ol = 0; for (let i = 0; i < 8; i++) { const x = await call('POST', '/v1/order', {}, `Device dev-uh-000000000000.${Hh.j.device_secret}`); if (x.status === 429) ol++; } ok(ol >= 2, 'limite de pedidos por hora');
  const race = await Promise.all(['a', 'b', 'c', 'd'].map(k => sess('ui', 'dev-race-' + k.repeat(10)))); ok(db.raw.prepare("SELECT COUNT(*) c FROM devices WHERE sub='ui' AND revoked_at IS NULL").get().c <= 2, 'tentativas simultâneas nunca passam de 2 aparelhos');
  ok(race.filter(x => x.r.status === 200).length === 2 && race.filter(x => x.r.status === 409).length === 2, 'duas entram e duas recebem device_limit');

  /* ---------- 4) offline e dados médicos ---------- */
  const sent = [];
  const mkc = (sub, dev) => { const store = new Map(), cfg = new Map(); const c = bare(false, { TB_LICENSE_API: 'https://w.test', TB_LICENSE_PUBKEY: JSON.stringify(pub), TB_SECURE: { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, getCfg: async k => cfg.get(k) ?? null, setCfg: async (k, v) => { cfg.set(k, v); } }, TB_DRV: { idToken: async () => idTok(sub) }, TB_DRV_STATE: { conn: false }, Request, Response, URL });
    c.Date = class extends Date { static now() { return T.now; } }; c.TB_HTTP = async (url, o) => { sent.push({ url, body: o.body }); if (c.OFFLINE) throw new Error('offline'); const x = await call(o.method, url.replace('https://w.test', ''), o.body, o.headers && o.headers.authorization); return { status: x.status, data: await x.json() }; };
    c.run(`licDevId = async () => ${JSON.stringify(dev)};`); c.store = store; return c; };
  const cl = mkc('uk', 'dev-uk-000000000000'); await cl.run('licLoad()'); cl.run('TB_DRV_STATE.conn = true'); await cl.run('licSession()'); if (process.env.DBG) console.log('MSG', cl.run('LK.msg'), cl.run('LK.busy'), JSON.stringify(sent.slice(-2)).slice(0, 300));
  ok(cl.run('licStatus()') === 'trial_active' && cl.run('licAllowed("bolus")') === true, 'teste ativo libera premium');
  cl.OFFLINE = true; let threw = false; try { await cl.run('licRefresh(true)'); await cl.run('licSession()'); } catch (e) { threw = true; }
  ok(!threw && ['registrar-glicemia', 'registrar-insulina', 'historico', 'exportar-excel'].every(f => cl.run(`licAllowed("${f}")`)), 'sem internet: gravar glicemia/insulina, histórico e exportação seguem livres');
  const tok1 = core.licB64d(cl.store.get('lic-token').split('.')[0]), p1 = JSON.parse(new TextDecoder().decode(tok1)); ok(p1.vexp - p1.iat === 7 * DAY, 'token do teste vale 7 dias offline');
  T.now += 6 * DAY; ok(cl.run('licAllowed("bolus")') === true, 'dentro do prazo offline o premium continua'); T.now += 2 * DAY; ok(cl.run('licAllowed("bolus")') === false && cl.run('licAllowed("historico")') === true, 'depois do prazo só o premium pausa'); T.now -= 8 * DAY;
  const bodies = sent.map(s => s.body).filter(Boolean); const keys = new Set(bodies.flatMap(b => Object.keys(b)));
  ok([...keys].every(k => ['id_token', 'device_id', 'device_name', 'replace_device_id', 'id', 'install_id', 'install_secret'].includes(k)), 'o app envia ao servidor só identidade, aparelho e instalação anônima (ids aleatórios): ' + [...keys].join(','));
  ok(!/glic|insulin|mg\/dL|records|carb/i.test(JSON.stringify(bodies)), 'nenhum dado médico vai para o servidor de licenças');
  const lj = fs.readFileSync(ROOT + '/src/license.js', 'utf8'); ok(!/Store\.|indexedDB|glicotrack|S\.records|putMany|\.clear\(|deleteDatabase/.test(lj), 'o licenciamento nunca escreve nem apaga dados médicos');
  const Lt = await orderFor('ul', 'dev-ul-000000000000'); const il = put(Lt.o); await hook(il);
  const sl = await (await call('POST', '/v1/refresh', {}, `Device dev-ul-000000000000.${Lt.s.j.device_secret}`)).json(); const pl = JSON.parse(new TextDecoder().decode(core.licB64d(sl.token.split('.')[0])));
  ok(pl.st === 'lifetime_active' && pl.vexp - pl.iat === 30 * DAY, 'licença vitalícia: token vale 30 dias offline e é renovado a cada conexão');
  T.now += 400 * DAY; const sl2 = await (await call('POST', '/v1/refresh', {}, `Device dev-ul-000000000000.${Lt.s.j.device_secret}`)).json(); ok(sl2.status === 'lifetime_active', 'licença vitalícia permanece válida com o tempo'); T.now -= 400 * DAY;

  console.log(fail ? `${fail} falha(s) em ${n}` : `test9 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e); process.exit(1); });
