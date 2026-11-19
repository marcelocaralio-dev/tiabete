// test13: status oficial charged_back, MP_SELLER_ID divergente, assinatura de Orders, migrations/SQL.
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


  MP.raw = {}; const lastState = o => ordr(o.order_id).chargeback_state;
  const post = (o, id, over) => hook(id, over);
  let r;
  /* 1) status oficial charged_back com um pagamento inequívoco não exige transaction_id */
  const TA = await buy('ea', 'dev-ea-000000000000'); put2(TA.o, { status: 'charged_back', status_detail: 'settled' }, { status: 'charged_back' }, [{ case_id: '4001', status: 'settled', transaction_id: undefined }]); delete MP.orders[TA.mp].transactions.chargebacks[0].transaction_id;
  const c0 = CBCALLS.length; r = await (await hook(TA.mp)).json(); ok(r.result === 'chargeback_lost' && lic('ea').status === 'revoked' && lastState(TA.o) === 'lost' && CBCALLS.length === c0, '1a. charged_back oficial + um pagamento + contestação sem transaction_id: revoga (sem consulta a contestações)');
  const TB = await buy('eb', 'dev-eb-000000000000'); put2(TB.o, { status: 'charged_back' }, null, [{ case_id: '4002', status: 'settled', transaction_id: 'PAY-DESCONHECIDO' }]); r = await (await hook(TB.mp)).json(); ok(lic('eb').status === 'revoked', '1b. transaction_id desconhecido + charged_back oficial: revoga');
  const TC = await buy('ec', 'dev-ec-000000000000'); put2(TC.o, { status: 'charged_back' }, null, []); MP.orders[TC.mp].transactions.chargebacks = { x: 1 }; r = await (await hook(TC.mp)).json(); ok(lic('ec').status === 'revoked', '1c. lista de contestações em formato inesperado + charged_back oficial: revoga pelo status');
  const TD = await buy('ed', 'dev-ed-000000000000'), many = []; for (let i = 0; i < 7; i++) many.push({ case_id: String(5000 + i), status: 'settled' }); put2(TD.o, { status: 'charged_back' }, null, many); const cd = CBCALLS.length; r = await (await hook(TD.mp)).json(); ok(lic('ed').status === 'revoked' && CBCALLS.length === cd, '1d. mais de 5 casos + charged_back oficial: decide pelo status oficial, sem consultas parciais');
  const TE = await buy('ee', 'dev-ee-000000000000'); put2(TE.o, { status: 'charged_back' }, { status: 'processed' }, [{ case_id: '4003', status: 'settled' }], [{ id: 'P-OUTRO', status: 'processed', amount: '29.90', paid_amount: '29.90' }]); delete MP.orders[TE.mp].transactions.chargebacks[0].transaction_id; r = await hook(TE.mp);
  ok(r.status === 502 && lic('ee').status === 'active' && !lastState(TE.o), '1e. vários pagamentos e nenhum confirmado como contestado: unverified, licença intacta');
  const TF = await buy('ef', 'dev-ef-000000000000'); put2(TF.o, null, { status: 'charged_back' }, [{ case_id: '4004', status: 'settled' }], [{ id: 'P-OUT2', status: 'processed', amount: '29.90', paid_amount: '29.90' }]); delete MP.orders[TF.mp].transactions.chargebacks[0].transaction_id; r = await (await hook(TF.mp)).json();
  ok(lic('ef').status === 'revoked', '1f. vários pagamentos, mas o pagamento que ativou está marcado charged_back: inequívoco, revoga');
  const TG = await buy('eg', 'dev-eg-000000000000'); put2(TG.o, null, null, [{ case_id: '4005', status: 'settled' }]); delete MP.orders[TG.mp].transactions.chargebacks[0].transaction_id; r = await hook(TG.mp); ok(r.status === 502 && lic('eg').status === 'active', '1g. sem charged_back oficial e sem transaction_id: continua unverified');
  const TH = await buy('eh', 'dev-eh-000000000000'); put2(TH.o, null, null, []); r = await (await hook(TH.mp, { body: { type: 'order', action: 'order.charged_back', data: { id: TH.mp, status: 'charged_back', transactions: { payments: [{ id: TH.pay, status: 'charged_back' }] } } } })).json(); ok(lic('eh').status === 'active', '1h. corpo do webhook dizendo charged_back não vale: a Order da API está processed');
  const TI = await buy('ei', 'dev-ei-000000000000'); put2(TI.o, { status: 'charged_back' }, null, []); MP.orders.MPOZZ = Object.assign({}, MP.orders[TI.mp], { id: 'MPOZZ' }); r = await (await hook('MPOZZ')).json(); ok(r.result === 'order_mismatch' && lic('ei').status === 'active', '1i. Order de outro id não revoga a licença do pedido');
  const TJ = await buy('ej', 'dev-ej-000000000000'); put2(TJ.o, { status: 'charged_back' }, null, []); MP.down = true; r = await hook(TJ.mp); MP.down = false; ok(r.status === 502 && lic('ej').status === 'active', '1j. falha ao consultar a Order: licença intacta');
  /* 2) MP_SELLER_ID */
  const keep = env.MP_SELLER_ID;
  const TK = await buy('ek', 'dev-ek-000000000000'); put2(TK.o, { status: 'charged_back', user_id: 99999 }, null, [{ case_id: '4010', status: 'in_process' }]); const ck = CBCALLS.length; r = await (await hook(TK.mp)).json();
  ok(r.result === 'chargeback_lost' && lic('ek').status === 'revoked' && CBCALLS.length === ck, '2a. MP_SELLER_ID diverge do user_id da Order, mas o charged_back oficial já confirmado é processado (sem chamada)');
  const TL = await buy('el', 'dev-el-000000000000'); const cl = cbCase(TL.pay); put2(TL.o, { user_id: 99999 }, null, [{ case_id: cl, status: 'in_process' }]); const cl0 = CBCALLS.length; r = await hook(TL.mp); ok(r.status === 502 && CBCALLS.length === cl0 && lic('el').status === 'active', '2b. divergência sem charged_back oficial: sem chamada e unverified (comportamento mantido)');
  env.MP_SELLER_ID = ''; const TM = await buy('em', 'dev-em-000000000000'); const cm = cbCase(TM.pay); put2(TM.o, { user_id: 77001 }, null, [{ case_id: cm, status: 'in_process' }]); const cm0 = CBCALLS.length; r = await (await hook(TM.mp)).json();
  ok(r.result === 'chargeback_open' && CBCALLS.length === cm0, '2c. MP_SELLER_ID vazio: user_id da Order NUNCA é usado como substituto (nenhuma chamada)');
  env.MP_SELLER_ID = keep; const TN = await buy('en', 'dev-en-000000000000'); const cn = cbCase(TN.pay); put2(TN.o, { user_id: 77001 }, null, [{ case_id: cn, status: 'in_process' }]); const cn0 = CBCALLS.length; await hook(TN.mp); ok(CBCALLS[cn0] && CBCALLS[cn0].h['x-caller-id'] === '77001', '2d. com MP_SELLER_ID igual ao user_id, a consulta usa o ID configurado');
  /* 3) assinatura do webhook */
  const mkReq = async (oid, q, o = {}) => { const rq = o.rq === undefined ? 'rq-sig' : o.rq, ts = '1700000123456', m = (o.manifest || (id => `${id ? 'id:' + id + ';' : ''}${rq ? 'request-id:' + rq + ';' : ''}ts:${ts};`))(o.signed === undefined ? oid : o.signed), v1 = await hmac(o.secret || 'segredo', m);
    return new Request('https://w.test/v1/mp/webhook?data.id=' + q, { method: 'POST', headers: Object.assign({ 'x-signature': `ts=${ts},v1=${v1}` }, rq ? { 'x-request-id': rq } : {}) }); };
  const OID = 'ORD01JRTXT3GC8CJGW394QWYQ9VP3', chk = async (req, sec) => mpSignatureOk(req, new URL(req.url), sec || 'segredo');
  ok(await chk(await mkReq(OID, OID)), '3a. manifesto com data.id como recebido (maiúsculas, id de Order) é aceito');
  ok(await chk(await mkReq(OID, OID, { signed: OID.toLowerCase() })), '3b. manifesto com data.id em minúsculas também é aceito');
  ok(!(await chk(await mkReq(OID, OID, { secret: 'outro' }))), '3c. segredo errado é recusado');
  ok(!(await chk(await mkReq(OID, OID, { signed: 'ORD01OUTRO' }))), '3d. data.id da URL diferente do assinado é recusado');
  ok(!(await chk(await mkReq(OID, OID, { rq: 'rq-sig', manifest: id => `id:${id};ts:1700000123456;` }))), '3e. manifesto sem request-id quando o cabeçalho existe é recusado');
  ok(await chk(await mkReq(OID, OID, { rq: '' })), '3f. sem x-request-id, o par é omitido do manifesto (como diz a documentação)');
  { const rq = await mkReq(OID, OID); ok(!(await mpSignatureOk(rq, new URL(rq.url), '')) && !(await mpSignatureOk(rq, new URL(rq.url), undefined)), '3g. sem segredo configurado, nada é aceito'); }
  const TP = await buy('ep', 'dev-ep-000000000000'); put2(TP.o, { status: 'charged_back' }, null, []); const rq3 = 'rq-up', ts3 = '1700000999999', v13 = await hmac('segredo', `id:${TP.mp};request-id:${rq3};ts:${ts3};`);
  r = await call('POST', `/v1/mp/webhook?data.id=${TP.mp}&type=order`, { type: 'order', action: 'order.charged_back', data: { id: TP.mp } }, null, { 'x-request-id': rq3, 'x-signature': `ts=${ts3},v1=${v13}` }); ok(r.status === 200 && lic('ep').status === 'revoked', '3h. order.charged_back com manifesto do id como recebido (maiúsculas) é processado de ponta a ponta');
  const TQ = await buy('eq', 'dev-eq-000000000000'); put2(TQ.o, { status: 'charged_back' }, null, []); r = await hook(TQ.mp, { v1: 'c'.repeat(64), body: { type: 'order', action: 'order.charged_back', data: { id: TQ.mp } } }); ok(r.status === 401 && lic('eq').status === 'active', '3i. order.charged_back com assinatura inválida: 401 e licença intacta');
  /* 4) migrations e SQL do Worker */
  const MIG = fs.readdirSync(path.join(ROOT, 'worker/migrations')).sort(); ok(MIG.join() === '0001_init.sql,0002_security.sql,0003_orders_api.sql,0004_chargebacks.sql', '4a. migrations existentes, em ordem: ' + MIG.join(', '));
  const mk = list => { const x = new DatabaseSync(':memory:'); for (const f of list) x.exec(fs.readFileSync(path.join(ROOT, 'worker/migrations', f), 'utf8')); return x; };
  const cols = (x, t) => x.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name), full = mk(MIG);
  const src = fs.readFileSync(ROOT + '/worker/src/index.js', 'utf8'); const need = {};
  const add = (t, c) => { (need[t] = need[t] || new Set()).add(c.trim()); };
  for (const m of src.matchAll(/INSERT(?: OR IGNORE)? INTO (\w+)\(([^)]*)\)/g)) m[2].split(',').forEach(c => add(m[1], c));
  for (const m of src.matchAll(/UPDATE (\w+) SET ([^"'`]*?(?:'[^']*'[^"'`]*?)*?)(?: WHERE|["'`])/g)) for (const a of m[2].matchAll(/(?:^|,)\s*(\w+)\s*=/g)) add(m[1], a[1]);
  for (const m of src.matchAll(/(?:FROM|SELECT[^"'`]*? FROM) (\w+)/g)) need[m[1]] = need[m[1]] || new Set();
  for (const m of src.matchAll(/SELECT ((?:\w+, ?)*\w+) FROM (\w+)/g)) m[1].split(',').forEach(c => { if (!/^\*$/.test(c.trim())) add(m[2], c); });
  let missing = []; for (const [t, set] of Object.entries(need)) { const have = cols(full, t); if (!have.length) missing.push(t + '(tabela)'); else for (const c of set) if (c && !have.includes(c)) missing.push(t + '.' + c); }
  ok(Object.keys(need).length >= 8 && !missing.length, '4b. todas as tabelas e colunas usadas pelas consultas SQL do Worker existem após 0001→0004' + (missing.length ? ': faltam ' + missing.join(',') : ''));
  const only12 = mk(MIG.slice(0, 2)); ok(!cols(only12, 'orders').includes('mp_order_id') && !cols(only12, 'orders').includes('chargeback_state') && !cols(only12, 'orders').includes('mp_updated_at'), '4c. só 0001+0002 NÃO bastam: faltam mp_order_id, chargeback_state e mp_updated_at');
  const upto3 = mk(MIG.slice(0, 3)); ok(cols(upto3, 'orders').includes('mp_order_id') && !cols(upto3, 'orders').includes('chargeback_state'), '4d. 0003 fornece mp_order_id; chargeback_state e mp_updated_at só vêm da 0004');
  const no3 = mk([MIG[0], MIG[1], MIG[3]]); ok(cols(no3, 'orders').includes('chargeback_state') && !cols(no3, 'orders').includes('mp_order_id'), '4e. 0004 não depende da 0003 (só da 0001, tabela orders); mesmo assim o Worker exige as duas');
  ok(MIG.slice(1).every(f => /ALTER TABLE|CREATE (TABLE|INDEX) IF NOT EXISTS/.test(fs.readFileSync(path.join(ROOT, 'worker/migrations', f), 'utf8'))), '4f. 0002–0004 só criam/adicionam (nenhuma apaga dados)');
  ok(!MIG.some(f => /DROP |DELETE FROM|TRUNCATE/i.test(fs.readFileSync(path.join(ROOT, 'worker/migrations', f), 'utf8').replace(/--.*$/gm, ''))), '4g. nenhuma migration contém DROP/DELETE/TRUNCATE');
  /* 5) proteção geral */
  ok(legacyCalls === 0, '5. nenhuma chamada à API legada');
  console.log(fail ? `${fail} falha(s) em ${n}` : `test13 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERRO', e); process.exit(1); });
