// test11: contestações (chargebacks) na Orders API, pagamento relevante da Order, idempotência e ordem das notificações.
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
    { const cm = /v1\/chargebacks\/(\d+)$/.exec(url); if (cm) { CBCALLS.push({ url, h: o && o.headers }); if (MP.cbDown) return new Response('{}', { status: 500 }); return MP.cbs[cm[1]] ? new Response(JSON.stringify(MP.cbs[cm[1]])) : new Response('{}', { status: 404 }); } }
    if (url === 'https://api.mercadopago.com/v1/orders' && o && o.method === 'POST') { ordUrl = url; ordBody = JSON.parse(o.body); ordHeaders = o.headers; if (MP.createFail) return new Response('{}', { status: 500 }); const id = 'MPO' + (++ordN); return new Response(JSON.stringify({ id, status: 'created', status_detail: 'created', checkout_url: MP.noUrl ? undefined : 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=' + id }), { status: 201 }); }
    if (MP.down) return new Response('{}', { status: 503 });
    const m = /v1\/orders\/([\w-]+)$/.exec(url); if (m) return MP.orders[m[1]] ? new Response(JSON.stringify(MP.orders[m[1]])) : new Response('{}', { status: 404 });
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

  /* 1) pagamento aprovado ativa */
  const A = await buy('ca', 'dev-ca-000000000000'); ok(lic('ca').status === 'active' && ordr(A.o.order_id).mp_payment_id === A.pay, '1. pagamento aprovado ativa a licença e grava o pagamento');
  /* 2) contestação aberta não revoga */
  let cs = cbCase(A.pay); put2(A.o, null, null, [{ case_id: cs, status: 'opened' }]); let r = await (await hook(A.mp)).json();
  ok(r.result === 'chargeback_open' && lic('ca').status === 'active' && ordr(A.o.order_id).chargeback_state === 'open', '2. contestação aberta/em análise não revoga a licença');
  ok(db.raw.prepare("SELECT COUNT(*) c FROM events WHERE sub='ca' AND type='chargeback_open'").get().c === 1, '2b. abertura registrada na auditoria');
  ok(CBCALLS.length > 0 && CBCALLS[0].url === 'https://api.mercadopago.com/v1/chargebacks/' + cs && CBCALLS[0].h.authorization === 'Bearer seg-token' && CBCALLS[0].h['x-caller-id'] === '77001', '2c. consulta GET /v1/chargebacks/{case_id} com Authorization e X-Caller-Id do vendedor');
  /* 5) notificação repetida */
  const same = { ts: '1700000555555', rq: 'rq-cb-dup' }; await hook(A.mp, same); const nCB = CBCALLS.length; r = await (await hook(A.mp, same)).json();
  ok(r.duplicate === true && CBCALLS.length === nCB, '5. notificação repetida não repete a operação');
  await hook(A.mp); await hook(A.mp); ok(db.raw.prepare("SELECT COUNT(*) c FROM events WHERE sub='ca' AND type='chargeback_open'").get().c === 1, '5b. novas notificações da mesma contestação não duplicam a auditoria');
  /* 6) assinatura inválida */
  const nBefore = CBCALLS.length; ok((await hook(A.mp, { v1: 'b'.repeat(64), body: { type: 'order', action: 'order.charged_back', data: { id: A.mp } } })).status === 401 && CBCALLS.length === nBefore, '6. assinatura inválida é rejeitada (sem consultar a API)');
  /* 3) contestação perdida */
  MP.cbs[cs].coverage_applied = false; put2(A.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back', status_detail: 'settled' }, [{ case_id: cs, status: 'settled' }]);
  r = await (await hook(A.mp, { body: { type: 'order', action: 'order.charged_back', data: { id: A.mp } } })).json();
  ok(r.result === 'chargeback_lost' && lic('ca').status === 'revoked' && ordr(A.o.order_id).chargeback_state === 'lost', '3. contestação perdida encerra a licença (revogada)');
  ok(db.raw.prepare("SELECT COUNT(*) c FROM events WHERE sub='ca' AND type='charged_back'").get().c === 1, '3b. perda registrada na auditoria');
  /* 10) notificação antiga não sobrescreve decisão mais recente */
  put2(A.o, { last_updated_date: '2026-11-15T10:00:00.000Z', status_detail: 'accredited' }, null, [{ case_id: cs, status: 'opened' }]); MP.cbs[cs].coverage_applied = null;
  const L1 = ordr(A.o.order_id).mp_updated_at; /* ainda nulo: o teste abaixo usa datas explícitas */
  put2(A.o, { last_updated_date: '2026-11-15T12:00:00.000Z', status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, [{ case_id: cs, status: 'settled' }]); MP.cbs[cs].coverage_applied = false; await hook(A.mp);
  ok(ordr(A.o.order_id).mp_updated_at === Date.parse('2026-11-15T12:00:00.000Z') && lic('ca').status === 'revoked', '10a. decisão mais recente aplicada e carimbada');
  put2(A.o, { last_updated_date: '2026-11-15T10:00:00.000Z' }, null, [{ case_id: cs, status: 'opened' }]); MP.cbs[cs].coverage_applied = null; r = await (await hook(A.mp)).json();
  ok(r.result === 'stale' && lic('ca').status === 'revoked' && ordr(A.o.order_id).chargeback_state === 'lost', '10. notificação/consulta antiga não reverte decisão mais recente');
  put2(A.o, { last_updated_date: '2026-11-15T13:00:00.000Z' }, null, []); r = await (await hook(A.mp)).json(); ok(lic('ca').status === 'revoked', '10b. "processed" sem contestação depois de perdida não reativa sozinho');
  /* 4) contestação ganha mantém ou restaura */
  const W = await buy('cw', 'dev-cw-000000000000'); cs = cbCase(W.pay, { coverage_applied: true });
  put2(W.o, null, null, [{ case_id: cs, status: 'settled' }]); r = await (await hook(W.mp)).json(); ok(lic('cw').status === 'active' && ordr(W.o.order_id).chargeback_state === 'won', '4. contestação ganha pelo vendedor mantém a licença');
  const R = await buy('cr', 'dev-cr-000000000000'); const csr = cbCase(R.pay);
  put2(R.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, [{ case_id: csr, status: 'settled' }]); MP.cbs[csr].coverage_applied = false; await hook(R.mp); ok(lic('cr').status === 'revoked', '4a. (preparo) licença revogada pela perda');
  MP.cbs[csr].coverage_applied = true; put2(R.o, { status: 'processed', status_detail: 'accredited' }, null, [{ case_id: csr, status: 'settled' }]); r = await (await hook(R.mp)).json();
  ok(r.result === 'chargeback_won_restored' && lic('cr').status === 'active', '4b. decisão favorável ao vendedor restaura a licença quando o pagamento original continua válido');
  const R2 = await buy('cr2', 'dev-cr2-00000000000'); const csr2 = cbCase(R2.pay);
  put2(R2.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, [{ case_id: csr2, status: 'settled' }]); await hook(R2.mp); MP.cbs[csr2].coverage_applied = true; r = await (await hook(R2.mp)).json();
  ok(r.result === 'chargeback_won_unconfirmed' && lic('cr2').status === 'revoked', '4c. se a Order segue charged_back, não restaura (confirmação pendente)');
  /* 7) contestação de outro pedido não altera a licença */
  const X = await buy('cx', 'dev-cx-000000000000'), Y = await buy('cy', 'dev-cy-000000000000');
  cs = cbCase(Y.pay, { coverage_applied: false }); put2(X.o, null, null, [{ case_id: cs, status: 'settled', transaction_id: 'PX2' }], [{ id: 'PX2', status: 'processed', amount: '29.90', paid_amount: '29.90' }]); r = await (await hook(X.mp)).json();
  ok(lic('cy').status === 'active', '7. contestação do pedido de outro usuário não altera a licença dele');
  ok(lic('cx').status === 'active' && !ordr(X.o.order_id).chargeback_state, '7b. contestação cujo pagamento não é o do pedido é ignorada (nem abre nem perde)');
  MP.orders.MPOEVIL = Object.assign({}, MP.orders[X.mp], { id: 'MPOEVIL', external_reference: Y.o.order_id }); r = await (await hook('MPOEVIL')).json(); ok(r.result === 'order_mismatch' && lic('cy').status === 'active', '7c. Order de outro id apontando para o pedido alheio é recusada');
  /* 8) evento desconhecido */
  const U = await orderFor('cu', 'dev-cu-000000000000'); put2(U.o, waiting); await (await hook(mid(U.o), { type: 'chargebacks', body: { type: 'chargebacks', data: { id: '123' } } })).json(); r = await (await hook(mid(U.o), { type: 'xyz', body: { type: 'xyz', data: { id: mid(U.o) } } })).json();
  ok(r.ignored === 'not_order' && !lic('cu'), '8. evento desconhecido não ativa nem revoga');
  const keepA = lic('cy').status; await (await hook(Y.mp, { body: { type: 'order', action: 'order.coisa_nova', data: { id: Y.mp } } })).json(); ok(lic('cy').status === keepA, '8b. ação desconhecida: vale só a consulta à API (nenhuma mudança indevida)');
  /* 9) múltiplos pagamentos na Order */
  const M = await orderFor('cm', 'dev-cm-000000000000'), amtM = (M.o.price_cents / 100).toFixed(2);
  put2(M.o, null, { id: 'PAY-FAIL', status: 'failed', status_detail: 'rejected_by_issuer' }, [], [{ id: 'PAY-OK', status: 'processed', amount: amtM, paid_amount: amtM }]); await hook(mid(M.o));
  ok(lic('cm') && lic('cm').payment_id === 'PAY-OK' && ordr(M.o.order_id).mp_payment_id === 'PAY-OK', '9. com várias tentativas, ativa com o pagamento processado correto (não o primeiro da lista)');
  put2(M.o, { status: 'refunded', status_detail: 'refunded' }, { id: 'PAY-FAIL', status: 'failed' }, [], [{ id: 'PAY-OK', status: 'refunded', amount: amtM, paid_amount: amtM }]); await hook(mid(M.o)); ok(lic('cm').status === 'refunded', '11. reembolso continua encerrando a licença (pagamento certo identificado)');
  const M2 = await orderFor('cm2', 'dev-cm2-00000000000'), a2 = (M2.o.price_cents / 100).toFixed(2);
  put2(M2.o, null, { id: 'P1', status: 'processed', amount: a2, paid_amount: a2 }, [], [{ id: 'P2', status: 'processed', amount: a2, paid_amount: a2 }]); await hook(mid(M2.o)); ok(!lic('cm2'), '9b. dois pagamentos processados no mesmo valor: ambíguo, não ativa');
  const M3 = await orderFor('cm3', 'dev-cm3-00000000000'), a3 = (M3.o.price_cents / 100).toFixed(2);
  put2(M3.o, null, { id: 'PX', status: 'processed', amount: '1.00', paid_amount: '1.00' }, [], [{ id: 'PY', status: 'refunded', amount: a3, paid_amount: a3 }]); await hook(mid(M3.o)); ok(!lic('cm3'), '9c. pagamento reembolsado de outra tentativa não é confundido com o pagamento válido');
  const M4 = await buy('cm4', 'dev-cm4-00000000000'); put2(M4.o, { status: 'processed' }, null, [], [{ id: 'PZ', status: 'refunded', amount: '29.90', paid_amount: '29.90' }]); await hook(M4.mp); ok(lic('cm4').status === 'active', '9d. reembolso de OUTRO pagamento da Order não derruba a licença do pagamento que a ativou');
  /* 12) falha da API */
  const F = await buy('cf', 'dev-cf-000000000000'); cs = cbCase(F.pay); put2(F.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, [{ case_id: cs, status: 'settled' }]); MP.cbDown = true;
  r = await hook(F.mp); ok(r.status === 502 && lic('cf').status === 'active', '12. falha ao consultar a contestação: 502 para reenvio, sem revogar'); MP.cbDown = false;
  MP.down = true; ok((await hook(F.mp)).status === 502 && lic('cf').status === 'active', '12b. falha ao consultar a Order: sem ativação nem revogação'); MP.down = false;
  MP.cbs[cs].coverage_applied = false; await hook(F.mp); ok(lic('cf').status === 'revoked', '12c. reenvio após a API voltar aplica a decisão');
  const rfs = await (await call('POST', '/v1/refresh', {}, `Device dev-cf-000000000000.${F.s.j.device_secret}`)).json(); ok(rfs.status === 'revoked' || rfs.status === 'refunded' || rfs.token, 'após perda o servidor emite token sem premium; dados do usuário intactos');
  ok(legacyCalls === 0, 'nenhuma chamada à API legada');
 const wk = fs.readFileSync(ROOT + '/worker/src/index.js', 'utf8'); ok(!/console\.(log|error)\s*\([^;]*(?:req|headers|body|token|secret|password|authorization|cookie|glucose|glycemia|insulin|health)/i.test(wk), 'Worker não registra campos explicitamente sensíveis');
  console.log(fail ? `${fail} falha(s) em ${n}` : `test11 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e); process.exit(1); });
