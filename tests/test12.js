// test12: endurecimento das contestações: associação inequívoca, coverage_applied estrito, ids grandes, X-Caller-Id, limite de casos.
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
  const L = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', L.privateKey), pub = await crypto.subtle.exportKey('jwk', L.publicKey);
  const G = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const gJwk = Object.assign(await crypto.subtle.exportKey('jwk', G.publicKey), { kid: 'k1', alg: 'RS256' });
  const CID = 'cid.apps.googleusercontent.com', T = { now: Date.UTC(2026, 10, 15, 12) }, MP = { orders: {}, cbs: {}, down: false };
  const idTok = async (sub, o = {}) => { const hh = b64u(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'k1' }))), pp = b64u(new TextEncoder().encode(JSON.stringify({ iss: o.iss || 'https://accounts.google.com', aud: CID, sub: o.noSub ? undefined : sub, email: sub + '@x.com', exp: Math.floor((T.now + (o.exp || H)) / 1000) }))); return `${hh}.${pp}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', G.privateKey, new TextEncoder().encode(hh + '.' + pp)))}`; };
  const CBCALLS = []; let ordBody = null, ordHeaders = null, ordUrl = null, ordN = 0, legacyCalls = 0;
  const fetchStub = async (url, o) => {
    if (url.includes('oauth2/v3/certs')) return new Response(JSON.stringify({ keys: [gJwk] }));
    if (url.includes('checkout/preferences') || url.includes('/v1/payments')) { legacyCalls++; return new Response('{}', { status: 500 }); }
    { const cm = /v1\/chargebacks\/(\d+)$/.exec(url); if (cm) { CBCALLS.push({ url, h: o && o.headers }); if (MP.cbDown) return new Response('{}', { status: 500 }); if (MP.raw && MP.raw['cb' + cm[1]] != null) return new Response(MP.raw['cb' + cm[1]]); return MP.cbs[cm[1]] ? new Response(JSON.stringify(MP.cbs[cm[1]])) : new Response('{}', { status: 404 }); } }
    if (url === 'https://api.mercadopago.com/v1/orders' && o && o.method === 'POST') { ordUrl = url; ordBody = JSON.parse(o.body); ordHeaders = o.headers; if (MP.createFail) return new Response('{}', { status: 500 }); const id = 'MPO' + (++ordN); return new Response(JSON.stringify({ id, status: 'created', status_detail: 'created', checkout_url: MP.noUrl ? undefined : 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=' + id }), { status: 201 }); }
    if (MP.down) return new Response('{}', { status: 503 });
    const m = /v1\/orders\/([\w-]+)$/.exec(url); if (m && MP.raw && MP.raw['o' + m[1]] != null) return new Response(MP.raw['o' + m[1]]); if (m) return MP.orders[m[1]] ? new Response(JSON.stringify(MP.orders[m[1]])) : new Response('{}', { status: 404 });
    return new Response('{}', { status: 500 });
  };
  const { createApp, mpSignatureOk } = await import('../worker/src/index.js');
  const db = d1(), env = { DB: db, GOOGLE_CLIENT_ID: CID, PUBLIC_URL: 'https://w.test', MP_ACCESS_TOKEN: 'seg-token', MP_WEBHOOK_SECRET: 'segredo', MP_SELLER_ID: '77001', LICENSE_PRIVATE_JWK: JSON.stringify(priv) };
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


  /* ---- fixtures: Orders com contestação ---- */
  let CASE = 1000; const cbOf = (cs, over) => Object.assign({ id: String(cs), payments: [], currency: 'BRL', amount: '29.90', coverage_applied: null, documentation_status: 'pending' }, over || {});
  const putCB = (o, payId, top, cbOver, pay) => { const cs = ++CASE; MP.cbs[cs] = cbOf(cs, Object.assign({ payments: [payId] }, cbOver)); return put(o, Object.assign({ user_id: 77001, transactions: undefined }, top || {}), pay, [{ case_id: String(cs), status: 'opened' }]) && cs; };
  const put2 = (o, top, pay, chargebacks, extraPays) => { const id = (top && top.id) || mid(o), amt = (o.price_cents / 100).toFixed(2), p0 = Object.assign({ id: 'PAY-' + id, status: 'processed', status_detail: 'accredited', amount: amt, paid_amount: amt }, pay || {});
    chargebacks = (chargebacks || []).map(c => Object.assign({ transaction_id: p0.id }, c));
    MP.orders[id] = Object.assign({ id, type: 'online', processing_mode: 'manual', external_reference: o.order_id, user_id: 77001, status: 'processed', status_detail: 'accredited', total_amount: amt, total_paid_amount: amt, currency: 'BRL', transactions: { payments: [p0].concat(extraPays || []), chargebacks: chargebacks || [] } }, top || {}); return id; };
  const buy = async (sub, dev) => { const x = await orderFor(sub, dev); const id = put2(x.o); await hook(id); return Object.assign(x, { mp: id, pay: 'PAY-' + id }); };
  const cbCase = (payId, over) => { const cs = ++CASE; MP.cbs[cs] = cbOf(cs, Object.assign({ payments: [payId] }, over)); return String(cs); };


  MP.raw = {}; const st = o => ordr(o.order_id), cbCount = () => CBCALLS.length;
  const lastState = o => ordr(o.order_id).chargeback_state;
  const same = async (who, why) => { const x = await who; return x; };
  const SAFE = (u, o, why) => ok(lic(u).status === 'active' && !lastState(o), why + ' (licença intacta, nada gravado)');
  const withOrder = (o, cbs, top, pay, extraPays) => put2(o, top, pay, cbs, extraPays);

  /* 1) associação contestação ↔ pagamento */
  const A = await buy('da', 'dev-da-000000000000'); let cs = cbCase(A.pay, { coverage_applied: false }); let r;
  withOrder(A.o, [{ case_id: cs, status: 'in_process', transaction_id: undefined }]); delete MP.orders[A.mp].transactions.chargebacks[0].transaction_id; r = await hook(A.mp); ok(r.status === 502, '1a. contestação sem transaction_id: unverified (502)'); SAFE('da', A.o, '1a');
  withOrder(A.o, [{ case_id: cs, status: 'in_process', transaction_id: 'PAY-DESCONHECIDO' }]); r = await hook(A.mp); ok(r.status === 502, '1b. transaction_id que não é pagamento da Order: unverified'); SAFE('da', A.o, '1b');
  MP.cbs[cs].payments = []; withOrder(A.o, [{ case_id: cs, status: 'settled', transaction_id: A.pay }]); r = await (await hook(A.mp)).json(); ok(r.result === 'chargeback_lost' && lic('da').status === 'revoked', '1c. associação vem da Order (transaction_id), não do campo payments da API de contestações');
  const A2 = await buy('da2', 'dev-da2-00000000000'); cs = cbCase(A2.pay, { coverage_applied: false });
  withOrder(A2.o, [{ case_id: cs, status: 'settled', transaction_id: 'PAY-OUTRO' }], null, null, [{ id: 'PAY-OUTRO', status: 'processed', amount: '29.90', paid_amount: '29.90' }]); const n1 = cbCount(); r = await (await hook(A2.mp)).json();
  ok(lic('da2').status === 'active' && cbCount() === n1 && !lastState(A2.o), '1d. contestação de OUTRO pagamento da mesma Order é ignorada (sem consulta, sem efeito)');
  withOrder(A2.o, null, { }); MP.orders[A2.mp].transactions.chargebacks = { case_id: cs }; r = await hook(A2.mp); ok(r.status === 502, '1e. chargebacks em formato inesperado: unverified'); SAFE('da2', A2.o, '1e');
  withOrder(A2.o, [null, 'x']); r = await hook(A2.mp); ok(r.status === 502, '1f. item de contestação inválido: unverified'); SAFE('da2', A2.o, '1f');

  /* 2) pagamento inexistente ou ambíguo */
  const B = await buy('db', 'dev-db-000000000000'); cs = cbCase(B.pay, { coverage_applied: false });
  put2(B.o, { status: 'charged_back', status_detail: 'settled' }, { id: 'PAY-TROCADO', status: 'charged_back' }, [{ case_id: cs, status: 'settled', transaction_id: 'PAY-TROCADO' }]); r = await hook(B.mp);
  ok(r.status === 502 && lic('db').status === 'active', '2a. Order sem o pagamento que ativou a licença: não associa, não revoga');
  const Bn = await orderFor('dn', 'dev-dn-000000000000'); put2(Bn.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, []); r = await hook(mid(Bn.o)); ok(!lic('dn') && !lastState(Bn.o), '2b. pedido nunca ativado com Order charged_back: nada a revogar nem a restaurar');
  const Bm = await orderFor('dm', 'dev-dm-000000000000'), am = (Bm.o.price_cents / 100).toFixed(2);
  put2(Bm.o, { status: 'charged_back' }, { id: 'P1', status: 'processed', amount: am, paid_amount: am }, [], [{ id: 'P2', status: 'processed', amount: am, paid_amount: am }]); await hook(mid(Bm.o)); ok(!lic('dm') && !lastState(Bm.o), '2c. pagamentos ambíguos: sem associação automática, sem licença');
  const Bw = await buy('dw', 'dev-dw-000000000000'); put2(Bw.o, { status: 'charged_back' }, { status: 'processed' }, [], [{ id: 'P-2', status: 'processed', amount: '29.90', paid_amount: '29.90' }]); r = await hook(Bw.mp);
  ok(r.status === 502 && lic('dw').status === 'active', '2d. Order charged_back com vários pagamentos e nenhum confirmado como o contestado: unverified, licença intacta');
  const Bs = await buy('ds', 'dev-ds-000000000000'); put2(Bs.o, { status: 'charged_back', status_detail: 'settled' }, null, []); r = await (await hook(Bs.mp)).json(); ok(r.result === 'chargeback_lost' && lic('ds').status === 'revoked', '2e. Order charged_back com um único pagamento (o que ativou) continua revogando pelo status oficial');

  /* 3) coverage_applied estrito */
  const mkCov = async (sub, dev, setup) => { const x = await buy(sub, dev), c = cbCase(x.pay); setup(MP.cbs[c]); put2(x.o, null, null, [{ case_id: c, status: 'in_process' }]); return { x, c, r: await hook(x.mp) }; };
  let q = await mkCov('dc1', 'dev-dc1-00000000000', c => { c.coverage_applied = true; }); ok((await q.r.json()).result === 'chargeback_won' || lastState(q.x.o) === 'won', '3a. coverage_applied true = favorável ao vendedor');
  q = await mkCov('dc2', 'dev-dc2-00000000000', c => { c.coverage_applied = false; }); ok(lic('dc2').status === 'revoked', '3b. coverage_applied false = desfavorável: revoga');
  q = await mkCov('dc3', 'dev-dc3-00000000000', c => { c.coverage_applied = null; }); ok(lic('dc3').status === 'active' && lastState(q.x.o) === 'open', '3c. null explícito = sem decisão (open)');
  for (const [k, v] of [['ausente', undefined], ['texto "false"', 'false'], ['número 1', 1], ['objeto', {}]]) { const sub = 'dd' + k.length; q = await mkCov(sub, 'dev-' + sub + '-0000000000'.slice(0, 20 - sub.length - 4 + 6), c => { if (v === undefined) delete c.coverage_applied; else c.coverage_applied = v; }); ok(q.r.status === 502 && lic(sub).status === 'active' && !lastState(q.x.o), '3d. coverage_applied ' + k + ': unverified (não vira open nem lost)'); }
  q = await mkCov('dc4', 'dev-dc4-00000000000', c => { c.id = '999'; }); ok(q.r.status === 502 && lic('dc4').status === 'active', '3e. resposta de outro caso (id diferente): unverified');
  const Z = await buy('dz', 'dev-dz-000000000000'), zc = cbCase(Z.pay); MP.raw['cb' + zc] = '{"id":"' + zc + '","coverage_applied":'; put2(Z.o, null, null, [{ case_id: zc, status: 'in_process' }]); r = await hook(Z.mp); ok(r.status === 502 && lic('dz').status === 'active', '3f. resposta incompleta/JSON truncado: unverified');
  MP.cbDown = true; q = await mkCov('dc5', 'dev-dc5-00000000000', c => {}); MP.cbDown = false; ok(q.r.status === 502 && lic('dc5').status === 'active', '3g. API de contestações indisponível: unverified');

  /* 4) identificadores numéricos grandes */
  const BIG = '234000062890459000'; const GB = await buy('dg', 'dev-dg-000000000000'); MP.cbs[BIG] = cbOf(BIG, { coverage_applied: false }); MP.raw['cb' + BIG] = '{"id":' + BIG + ',"payments":[],"coverage_applied":false}';
  MP.raw['o' + GB.mp] = JSON.stringify(Object.assign({}, put2(GB.o, null, null, [{ case_id: 'X', status: 'settled' }]) && MP.orders[GB.mp])).replace('"case_id":"X"', '"case_id":' + BIG).replace(/"transaction_id":"([^"]+)"/, '"transaction_id":"$1"');
  const nb = cbCount(); r = await (await hook(GB.mp)).json(); const urlBig = CBCALLS.slice(nb).map(c => c.url).find(u => u.includes('/chargebacks/'));
  ok(urlBig === 'https://api.mercadopago.com/v1/chargebacks/' + BIG, '4a. case_id numérico grande é consultado com os dígitos exatos (' + urlBig + ')');
  ok(BigInt(Number(BIG)) !== BigInt(BIG), '4b. (controle) o arredondamento do JavaScript realmente alteraria esse número');
  ok(r.result === 'chargeback_lost' && lic('dg').status === 'revoked', '4c. contestação com case_id e id numéricos grandes é decidida normalmente');
  let ix = 0; for (const [k, raw] of [['notação científica', '2.34e17'], ['decimal', '12.5'], ['negativo', '-5'], ['texto não numérico', '"abc"'], ['vazio', '""'], ['nulo', 'null']]) {
    const sub = 'de' + (++ix), d = await buy(sub, ('dev-' + sub + '-00000000000').slice(0, 20)); put2(d.o, null, null, [{ case_id: 'X', status: 'in_process' }]);
    MP.raw['o' + d.mp] = JSON.stringify(MP.orders[d.mp]).replace('"case_id":"X"', '"case_id":' + raw); const nc = cbCount(); const rr = await hook(d.mp);
    ok(rr.status === 502 && cbCount() === nc && lic(sub).status === 'active', '4d. case_id inválido (' + k + '): unverified, sem consulta e sem alterar a licença');
  }
  /* 5) X-Caller-Id */
  const C = await buy('dh', 'dev-dh-000000000000'); cs = cbCase(C.pay); put2(C.o, null, null, [{ case_id: cs, status: 'in_process' }]); const nh = cbCount(); await hook(C.mp);
  ok(CBCALLS[nh] && CBCALLS[nh].h['x-caller-id'] === '77001', '5a. X-Caller-Id vem de MP_SELLER_ID configurado');
  put2(C.o, { user_id: 99999 }, null, [{ case_id: cs, status: 'in_process' }]); const nh2 = cbCount(); r = await hook(C.mp); ok(r.status === 502 && cbCount() === nh2 && lic('dh').status === 'active', '5b. user_id da Order diferente do vendedor configurado: sem chamada, unverified');
  const keepSeller = env.MP_SELLER_ID;
  for (const bad of ['', undefined, 'abc', '12 34', '1'.repeat(25)]) { env.MP_SELLER_ID = bad; const sub = 'di' + String(bad).length, e = await buy(sub, ('dev-' + sub + '-00000000000').slice(0, 20)); const cc = cbCase(e.pay, { coverage_applied: false });
    put2(e.o, null, null, [{ case_id: cc, status: 'in_process' }]); const nz = cbCount(); const rr = await (await hook(e.mp)).json(); ok(cbCount() === nz && rr.result === 'chargeback_open' && lic(sub).status === 'active', '5c. sem ID de vendedor válido (' + JSON.stringify(bad) + '): nenhuma chamada; contestação em andamento apenas registrada'); }
  env.MP_SELLER_ID = '';
  const E1 = await buy('dj', 'dev-dj-000000000000'); put2(E1.o, null, null, [{ case_id: '55', status: 'desconhecido' }]); r = await hook(E1.mp); ok(r.status === 502 && lic('dj').status === 'active', '5d. sem ID de vendedor e status de contestação desconhecido: unverified');
  const E2 = await buy('dk', 'dev-dk-000000000000'); put2(E2.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, [{ case_id: '56', status: 'settled' }]); const nk = cbCount(); r = await (await hook(E2.mp)).json(); ok(r.result === 'chargeback_lost' && lic('dk').status === 'revoked' && cbCount() === nk, '5e. sem ID de vendedor, o status oficial charged_back da Order continua revogando (sem chamada)');
  env.MP_SELLER_ID = keepSeller;
  const srcW = fs.readFileSync(ROOT + '/worker/src/index.js', 'utf8'); ok(!/x-caller-id'?\s*:\s*String\(\s*mo\.user_id/.test(srcW) && /MP_SELLER_ID/.test(srcW), '5f. o código não envia mo.user_id como X-Caller-Id');
  /* 6) quantidade de contestações */
  const many = async (sub, n, cov) => { const d = await buy(sub, ('dev-' + sub + '-00000000000').slice(0, 20)), list = []; for (let i = 0; i < n; i++) { const c = cbCase(d.pay, { coverage_applied: i === n - 1 ? cov : null }); list.push({ case_id: c, status: 'in_process' }); } put2(d.o, null, null, list); return d; };
  const M6 = await many('dl6', 6, false); const n6 = cbCount(); r = await hook(M6.mp); ok(r.status === 502 && cbCount() === n6 && lic('dl6').status === 'active', '6a. 6 contestações (acima do limite de 5): unverified, nenhuma decisão parcial');
  const M5 = await many('dl5', 5, false); const n5 = cbCount(); r = await (await hook(M5.mp)).json(); ok(cbCount() - n5 === 5 && r.result === 'chargeback_lost' && lic('dl5').status === 'revoked', '6b. 5 contestações: todas consultadas; a perdida (a última) é considerada');
  const Mw = await many('dlw', 3, true); r = await (await hook(Mw.mp)).json(); ok(lastState(Mw.o) === 'won' && lic('dlw').status === 'active', '6c. várias contestações, uma ganha e as outras sem decisão: won');
  const Mx = await buy('dlx', 'dev-dlx-00000000000'), c1 = cbCase(Mx.pay, { coverage_applied: true }), c2 = cbCase(Mx.pay, { coverage_applied: false }); put2(Mx.o, null, null, [{ case_id: c1, status: 'settled' }, { case_id: c2, status: 'settled' }]); r = await (await hook(Mx.mp)).json(); ok(lic('dlx').status === 'revoked', '6d. uma ganha e outra perdida: perdida prevalece');
  const My = await buy('dly', 'dev-dly-00000000000'), k1 = cbCase(My.pay, { coverage_applied: false }), k2 = cbCase(My.pay); MP.cbs[k2].id = 'OUTRO'; put2(My.o, null, null, [{ case_id: k1, status: 'settled' }, { case_id: k2, status: 'in_process' }]); r = await hook(My.mp); ok(r.status === 502 && lic('dly').status === 'active', '6e. se um dos casos não puder ser verificado, nenhuma decisão é tomada (nem a do caso verificado)');
  /* 7) descoberta sem confiar no corpo do webhook */
  const W = await buy('dq', 'dev-dq-000000000000'), wc = cbCase(W.pay, { coverage_applied: false }); put2(W.o, null, null, []);
  r = await (await hook(W.mp, { body: { type: 'order', action: 'order.charged_back', data: { id: W.mp, transactions: { chargebacks: [{ case_id: wc, transaction_id: W.pay }] } } } })).json(); ok(lic('dq').status === 'active', '7. contestação só no corpo do webhook (não na Order da API): ignorada');
  /* 8) proteção geral */
ok(!/console\.(log|error)\s*\([^;]*(?:req|headers|body|token|secret|password|authorization|cookie|glucose|glycemia|insulin|health)/i.test(srcW), '8b. Worker não registra campos explicitamente sensíveis');
  console.log(fail ? `${fail} falha(s) em ${n}` : `test12 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e); process.exit(1); });
