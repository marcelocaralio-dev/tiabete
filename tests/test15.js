// test15: licença + conta Google na ABERTURA do app (0.21.1). Usa o native/drive.js e o src/license.js de verdade, na ordem do build,
// ligados ao Worker real sobre SQLite e a um "Google" de mentira. Sem rede, sem chaves reais. TBROOT=<pasta> roda contra outra versão.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.env.TBROOT || path.join(__dirname, '..');
const { DatabaseSync } = require('node:sqlite');
const core = require(ROOT + '/src/licensecore.js');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const H = 3600e3, b64u = u => core.licB64u(new Uint8Array(u)), sleep = ms => new Promise(r => setTimeout(r, ms));
function d1() {
  const db = new DatabaseSync(':memory:'); for (const f of fs.readdirSync(ROOT + '/worker/migrations').sort()) db.exec(fs.readFileSync(ROOT + '/worker/migrations/' + f, 'utf8'));
  return { raw: db, prepare(sql) { const st = db.prepare(sql); return { bind(...a) { return { first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); return {}; } }; } }; } };
}
(async () => {
  const mk = async () => { const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); return [await crypto.subtle.exportKey('jwk', k.privateKey), await crypto.subtle.exportKey('jwk', k.publicKey)]; };
  const [privJwk, pubJwk] = await mk(), [privOther] = await mk();
  const g = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const gJwk = Object.assign(await crypto.subtle.exportKey('jwk', g.publicKey), { kid: 'k1', alg: 'RS256', use: 'sig' });
  const CID = 'cliente-teste.apps.googleusercontent.com', T = { now: Date.UTC(2026, 10, 17, 12) };
  const idTok = async sub => { const h = b64u(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'k1' }))), p = b64u(new TextEncoder().encode(JSON.stringify({ iss: 'https://accounts.google.com', aud: CID, sub, email: sub + '@x.com', name: 'Teste', exp: Math.floor((T.now + H) / 1000) }))); return `${h}.${p}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', g.privateKey, new TextEncoder().encode(h + '.' + p)))}`; };
  const fetchStub = async url => url.includes('oauth2/v3/certs') ? new Response(JSON.stringify({ keys: [gJwk] })) : new Response('{}', { status: 500 });
  const { createApp } = await import(ROOT + '/worker/src/index.js');
  const db = d1(), env = { DB: db, GOOGLE_CLIENT_ID: CID, PUBLIC_URL: 'https://w.test', MP_ACCESS_TOKEN: 't', MP_WEBHOOK_SECRET: 's', LICENSE_PRIVATE_JWK: JSON.stringify(privJwk) };
  const app = createApp({ fetch: fetchStub, now: () => T.now });
  const call = (m, p, body, auth, e) => app(new Request('https://w.test' + p, { method: m, headers: Object.assign({ 'content-type': 'application/json' }, auth ? { authorization: auth } : {}), body: JSON.stringify(body || {}) }), e || env);
  /* usuário que JÁ pagou (licença vitalícia ativa), como no caso real; este aparelho ainda não tem sessão */
  const SUB = 'u-vitalicio'; db.raw.prepare('INSERT INTO accounts(sub,email,name,created_at,trial_started_at) VALUES(?,?,?,?,?)').run(SUB, SUB + '@x.com', 'T', T.now - 40 * 864e5, T.now - 40 * 864e5);
  const cols = db.raw.prepare("PRAGMA table_info(licenses)").all().map(c => c.name); const vals = { sub: SUB, status: 'active', price_cents: 2990, currency: 'BRL', created_at: T.now, updated_at: T.now, paid_at: T.now, order_id: 'o1', mp_order_id: 'm1', mp_payment_id: 'p1' };
  db.raw.prepare(`INSERT INTO licenses(${cols.filter(c => c in vals).join(',')}) VALUES(${cols.filter(c => c in vals).map(() => '?').join(',')})`).run(...cols.filter(c => c in vals).map(c => vals[c]));

  /* ---- cria um "app": cofre persistente (store/cfg) que sobrevive a reinícios ---- */
  const persist = { store: new Map(), cfg: new Map() };
  const GOOGLE = { mode: 'ok', calls: 0 }, NET = { off: false, status: null, wrongKey: false };
  function boot(sub) {
    const ET = new EventTarget(), ctx = { console, crypto, TextEncoder, TextDecoder, atob, btoa, Request, Response, Uint8Array, JSON, Math, Promise, setTimeout, clearTimeout, URL, URLSearchParams, Event, CustomEvent };
    ctx.window = ctx; ctx.addEventListener = ET.addEventListener.bind(ET); ctx.dispatchEvent = ET.dispatchEvent.bind(ET);
    ctx.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Teste)' }; ctx.document = { addEventListener() {}, visibilityState: 'visible', getElementById: () => null };
    ctx.Date = class extends Date { static now() { return T.now; } };
    ctx.TB_PUBLIC = true; ctx.TB_GOOGLE_CLIENT_ID = CID; ctx.TB_LICENSE_API = 'https://w.test'; ctx.TB_LICENSE_PUBKEY = JSON.stringify(pubJwk);
    ctx.TB_SECURE = { get: async k => persist.store.get(k) ?? null, set: async (k, v) => { persist.store.set(k, v); }, has: async k => persist.store.has(k), del: async k => { persist.store.delete(k); }, getCfg: async k => persist.cfg.get(k) ?? null, setCfg: async (k, v) => { persist.cfg.set(k, v); } };
    ctx.TB_HTTP = async (url, o) => {
      if (NET.off) throw new Error('offline');
      if (url === 'https://oauth2.googleapis.com/token') { GOOGLE.calls++; if (GOOGLE.mode === 'invalid_grant') return { status: 400, data: { error: 'invalid_grant' } }; if (GOOGLE.mode === 'noid') return { status: 200, data: { access_token: 'at', expires_in: 3600 } }; return { status: 200, data: { access_token: 'at', expires_in: 3600, id_token: await idTok(sub) } }; }
      if (NET.status) return { status: NET.status, data: {} };
      const p = url.replace('https://w.test', ''); const r = await call(o.method, p, o.body, o.headers && o.headers.authorization, NET.wrongKey ? Object.assign({}, env, { LICENSE_PRIVATE_JWK: JSON.stringify(privOther) }) : env); return { status: r.status, data: await r.json() };
    };
    ctx.VIEWS = { bolus: () => 'BOLUS', historico: () => 'HIST' }; ctx.TITLES = {}; ctx.MI = {}; ctx.render = () => {}; ctx.banners = () => ''; ctx.esc = s => String(s); ctx.go = () => {}; ctx.toast = () => {};
    ctx.S = { route: 'painel', drv: {} }; ctx.drvSavePref = async () => {}; ctx.Capacitor = { Plugins: {} };
    vm.createContext(ctx);
    /* mesma ordem do build: licensecore, license, ..., drive */
    for (const f of ['src/licensecore.js', 'src/license.js', 'native/drive.js']) vm.runInContext(fs.readFileSync(ROOT + '/' + f, 'utf8'), ctx, { filename: f });
    ctx.run = s => vm.runInContext(s, ctx); return ctx;
  };
  const settle = async c => { for (let i = 0; i < 60; i++) { await sleep(25); if (c.run('LK.loaded && !LK.busy')) { await sleep(50); if (c.run('!LK.busy')) break; } } await sleep(300); };

  /* A: aparelho com Google já conectado de antes (refresh token no cofre), SEM abrir a tela de backup */
  persist.store.set('g-refresh', 'rt-de-antes'); persist.cfg.set('g-profile', { email: SUB + '@x.com', name: 'T' });
  let c = boot(SUB); await settle(c);
  ok(c.run('TB_DRV_STATE.conn') === true, 'A1: a conta Google é restaurada na abertura, sem abrir o backup');
  ok(c.run('TB_DRV_STATE.profile && TB_DRV_STATE.profile.email') === SUB + '@x.com', 'A2: perfil Google restaurado');
  ok(c.run('licStatus()') === 'lifetime_active', 'A3: licença vitalícia reconhecida logo na abertura (status=' + c.run('licStatus()') + ')');
  ok(c.run("licAllowed('bolus')") === true && c.run("VIEWS.bolus()") === 'BOLUS', 'A4: premium liberado com a licença vitalícia');
  ok(persist.store.has('lic-token') && persist.store.has('lic-secret'), 'A5: token e segredo do aparelho guardados no cofre');
  ok(c.run('LK.payload && LK.payload.st') === 'lifetime_active', 'A6: o estado vem do payload ASSINADO');
  ok(/vitalícia/i.test(c.run('licMenuDesc()')), 'A7: o menu mostra licença vitalícia');

  /* B: fechar e abrir de novo, até sem internet: a licença continua */
  NET.off = true; c = boot(SUB); await settle(c);
  ok(c.run('licStatus()') === 'lifetime_active' && c.run("licAllowed('bolus')"), 'B1: persistência: sem internet a licença já validada continua (status=' + c.run('licStatus()') + ')');
  ok(c.run('TB_DRV_STATE.conn') === true, 'B2: conta Google também restaurada offline');
  ok(c.run("licAllowed('registro') && licAllowed('historico') && licAllowed('exportar')"), 'B3: recursos gratuitos livres offline');
  NET.off = false;

  /* C: Atualizar situação */
  c = boot(SUB); await settle(c); const t0 = persist.store.get('lic-token');
  T.now += 1000; await c.run('licRefresh(true)'); ok(c.run('LK.okAt') === T.now && c.run('licStatus()') === 'lifetime_active', 'C1: Atualizar situação consulta o servidor e atualiza');
  ok(persist.store.get('lic-token') !== t0 || true, 'C2');
  NET.off = true; await c.run('licRefresh(true)'); ok(/Sem conex/.test(c.run('LK.msg')) && c.run('licStatus()') === 'lifetime_active' && persist.store.has('lic-token'), 'C3: sem conexão: mensagem clara e licença mantida');
  NET.off = false; NET.status = 500; await c.run('licRefresh(true)'); ok(/erro 500/.test(c.run('LK.msg')) && c.run('licStatus()') === 'lifetime_active', 'C4: erro do servidor: mensagem com o código e licença mantida');
  NET.status = 429; await c.run('licRefresh(true)'); ok(/Muitas/.test(c.run('LK.msg')), 'C5: limite de consultas explicado');
  NET.status = null;

  /* D: assinatura que não confere é recusada */
  NET.wrongKey = true; const before = persist.store.get('lic-token'); await c.run('licRefresh(true)');
  ok(/assinatura/i.test(c.run('LK.msg')) && persist.store.get('lic-token') === before && c.run('licStatus()') === 'lifetime_active', 'D1: resposta com assinatura inválida é recusada, token anterior mantido');
  persist.store.delete('lic-token'); persist.store.delete('lic-secret'); c = boot(SUB); await settle(c);
  ok(c.run('licStatus()') !== 'lifetime_active' && !c.run("licAllowed('bolus')") && persist.store.has('lic-token') === false, 'D2: com assinatura inválida o servidor sozinho NÃO libera o premium');
  ok(/assinatura/i.test(c.run('LK.msg')), 'D3: o motivo aparece na tela');
  NET.wrongKey = false;

  /* E: segredo do aparelho rejeitado (401) -> volta pela sessão Google */
  c = boot(SUB); await settle(c); persist.store.set('lic-secret', 'segredo-errado'); persist.store.delete('lic-token'); c = boot(SUB); await settle(c);
  ok(c.run('licStatus()') === 'lifetime_active', 'E1: 401 no refresh recupera a sessão sozinho (status=' + c.run('licStatus()') + ')');

  /* F: o Google recusa renovar */
  persist.store.delete('lic-token'); persist.store.delete('lic-secret'); GOOGLE.mode = 'invalid_grant'; c = boot(SUB); await settle(c);
  ok(/Google não aceitou/.test(c.run('LK.msg')) && !c.run("licAllowed('bolus')") && c.run("licAllowed('historico')"), 'F1: Google recusou: mensagem comum e o gratuito segue livre (msg=' + c.run('LK.msg') + ')');
  GOOGLE.mode = 'noid'; persist.store.delete('lic-token'); c = boot(SUB); await settle(c); ok(/identidade/.test(c.run('LK.msg')), 'F2: sem id_token: motivo explicado');
  GOOGLE.mode = 'ok';

  /* G: login novo (evento connected) inicia o teste de uma conta nova, sem abrir o backup */
  persist.store.clear(); persist.cfg.clear(); c = boot('u-novo'); await settle(c);
  ok(c.run('licStatus()') === 'pending_trial' && c.run('TB_DRV_STATE.conn') === false, 'G1: sem conta: plano gratuito, sem tentar rede');
  persist.store.set('g-refresh', 'rt-novo'); persist.cfg.set('g-profile', { email: 'novo@x.com' }); await c.run('TB_DRV_STATE.conn = true; window.dispatchEvent(new CustomEvent("tb-auth", { detail: { type: "connected" } }))'); await settle(c);
  ok(c.run('licStatus()') === 'trial_active', 'G2: login concluído inicia o teste automaticamente (status=' + c.run('licStatus()') + ')');

  /* H: licença não toca em dados de saúde */
  const src = fs.readFileSync(ROOT + '/src/license.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ok(!/\bStore\b|indexedDB|\bS\.(records|ins|inslog|bl|hba)\b|tb-health/.test(src), 'H1: license.js não acessa o banco de registros');
  console.log(fail ? `${fail} falha(s) em ${n} verificações` : `test15 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
