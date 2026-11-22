// test35: proteção do teste contra reinstalação e limpeza de dados com ANDROID_ID pseudonimizado (HMAC no backend), 0.34.0.
process.removeAllListeners('warning');
const fs = require('fs'), vm = require('vm'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const core = require('../src/licensecore.js');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FALHOU:', m); } };
const H = 3600e3, DAY = 24 * H, T0 = Date.UTC(2026, 10, 22, 12);
const b64u = u => core.licB64u(new Uint8Array(u));

function d1() {
  const db = new DatabaseSync(':memory:'); for (const f of fs.readdirSync(path.join(ROOT, 'worker/migrations')).sort()) db.exec(rd('worker/migrations/' + f));
  return { raw: db, prepare(sql) { const st = db.prepare(sql); return { bind(...a) { return { first: async () => st.get(...a) || null, all: async () => ({ results: st.all(...a) }), run: async () => { st.run(...a); return {}; } }; } }; } };
}
(async () => {
  /* ---------- infraestrutura ---------- */
  const lic = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privJwk = await crypto.subtle.exportKey('jwk', lic.privateKey), pubJwk = await crypto.subtle.exportKey('jwk', lic.publicKey);
  const g = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const gJwk = Object.assign(await crypto.subtle.exportKey('jwk', g.publicKey), { kid: 'k1', alg: 'RS256', use: 'sig' });
  const CID = 'cliente-teste.apps.googleusercontent.com', T = { now: T0 };
  const idTok = async sub => {
    const h = b64u(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid: 'k1' }))), p = b64u(new TextEncoder().encode(JSON.stringify({ iss: 'https://accounts.google.com', aud: CID, sub, email: sub + '@x.com', name: 'Teste', exp: Math.floor((T.now + H) / 1000) })));
    return `${h}.${p}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', g.privateKey, new TextEncoder().encode(h + '.' + p)))}`;
  };
  const fetchStub = async url => url.includes('oauth2/v3/certs') ? new Response(JSON.stringify({ keys: [gJwk] })) : new Response('{}', { status: 500 });
  const { createApp } = await import('../worker/src/index.js');
  const db = d1(), env = { DB: db, GOOGLE_CLIENT_ID: CID, PUBLIC_URL: 'https://w.test', MP_ACCESS_TOKEN: 'tok', MP_WEBHOOK_SECRET: 'segredo', LICENSE_PRIVATE_JWK: JSON.stringify(privJwk), DEVICE_HMAC_KEY: 'chave-hmac-de-teste-0123456789abcdef' };
  const app = createApp({ fetch: fetchStub, now: () => T.now });
  const ST = { down: false, ip: '1.1.1.1' };
  const call = async (m, p, body, auth, headers) => {
    if (ST.down) return new Response('{}', { status: 503 });
    return app(new Request('https://w.test' + p, { method: m, headers: Object.assign({ 'content-type': 'application/json', 'cf-connecting-ip': ST.ip }, auth ? { authorization: auth } : {}, headers || {}), body: m === 'GET' ? undefined : JSON.stringify(body || {}) }), env);
  };
  const IID = i => 'inst-' + String(i).padStart(12, '0'), SEC = i => 'secret-' + String(i).padStart(20, '0');
  const gstart = async (i, extra, secOverride) => { const r = await call('POST', '/v1/guest/start', Object.assign({ install_id: IID(i), install_secret: secOverride || SEC(i) }, extra)); return { r, j: await r.json() }; };
  const gref = async i => { const r = await call('POST', '/v1/guest/refresh', {}, `Install ${IID(i)}.${SEC(i)}`); return { r, j: await r.json() }; };
  const sess = async (sub, dev, extra) => { const r = await call('POST', '/v1/session', Object.assign({ id_token: await idTok(sub), device_id: dev, device_name: 'Cel' }, extra)); return { r, j: await r.json() }; };
  const row = (t, w, ...a) => db.raw.prepare(`SELECT * FROM ${t} WHERE ${w}`).get(...a);

  function makeClient(o) {
    o = o || {}; const store = o.store || new Map(), cfg = o.cfg || new Map(), ctx = { console, crypto, TextEncoder, TextDecoder, atob, btoa, Request, Response, Uint8Array, JSON, Math, Promise, setTimeout, clearTimeout, URL };
    ctx.window = ctx; ctx.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Teste)' }; ctx.document = { addEventListener() {}, visibilityState: 'visible' }; ctx.addEventListener = () => {};
    ctx.Date = class extends Date { static now() { return T.now; } };
    ctx.TB_LICENSE_API = 'https://w.test'; ctx.TB_LICENSE_PUBKEY = JSON.stringify(pubJwk);
    ctx.TB_SECURE = { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, has: async k => store.has(k), del: async k => { store.delete(k); }, getCfg: async k => cfg.get(k) ?? null, setCfg: async (k, v) => { cfg.set(k, v); } };
    ctx.Capacitor = o.aid ? { Plugins: { TbDevice: { androidId: async () => ({ id: o.aid }) } } } : undefined; ctx.TB_DRV_STATE = { conn: !!o.conn }; ctx.TB_DRV = { idToken: async () => o.sub && ctx.TB_DRV_STATE.conn ? idTok(o.sub) : null };
    ctx.sent = []; ctx.TB_HTTP = async (url, op) => { if (ctx.OFFLINE) throw new Error('offline'); const p = url.replace('https://w.test', ''); ctx.sent.push([p, op.body]); const r = await call(op.method, p, op.body, op.headers && op.headers.authorization); return { status: r.status, data: await r.json() }; };
    const orig = { bolus: () => 'BOLUS', padroes: () => 'PADROES', perguntas: () => 'IA', exames: () => 'EX', exame: () => 'EX1', comparar: () => 'CMP', analise: () => 'AN' };
    ctx.VIEWS = Object.assign({}, orig); ctx.TITLES = {}; ctx.MI = {}; ctx.render = () => {}; ctx.banners = () => ''; ctx.esc = s => String(s); ctx.go = () => {};
    vm.createContext(ctx); vm.runInContext(rd('src/licensecore.js'), ctx); vm.runInContext(rd('src/license.js'), ctx);
    ctx.run = s => vm.runInContext(s, ctx); ctx.store = store; ctx.cfg = cfg; ctx.run(`licDevId = async () => ${JSON.stringify(o.dev || 'dev-0000000000000001')};`);
    return ctx;
  }
  const settle = () => new Promise(r => setTimeout(r, 40));
  const jump = async (c, t) => { T.now = t; if (!c.OFFLINE) { await c.run('licRefresh(true)'); await settle(); } };   /* o app consulta o servidor ao voltar a ser usado (a cada 6 h no máximo) */
  const boot = async c => { await c.run('licLoad()'); await c.run('licRefresh(false)'); await settle(); };
  const guestCfg = () => { const cfg = new Map(); cfg.set('login-skip', true); return cfg; };
  const FREE = ['registrar-glicemia', 'registrar-insulina', 'historico', 'historico-insulina', 'exportar-excel', 'exportar-csv', 'backup', 'perfil', 'seguranca', 'hipoglicemia'];
  const premAll = c => ['bolus', 'padroes', 'exames', 'analise', 'rel-pdf', 'ia'].every(f => c.run(`licAllowed('${f}')`));
  const freeAll = c => FREE.every(f => c.run(`licAllowed('${f}')`));
  const before = () => db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c;


  /* captura o que o Worker escreve em log: o ANDROID_ID bruto nunca pode aparecer */
  const logs = []; const oe = console.error, ol = console.log; console.error = (...a) => logs.push(a.join(' ')); 
  const AID = 'a1b2c3d4e5f60718', AID2 = '0f1e2d3c4b5a6978';
  const hmac = async v => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.DEVICE_HMAC_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('tb-android-id-v1|' + v)))].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const devs = () => db.raw.prepare('SELECT * FROM trial_devices').all();
  const pre = (n, c) => ({ cfg: c || guestCfg(), dev: 'dev-t35-' + String(n).padStart(10, '0'), aid: AID });
  const ZERO = async () => { /* instalação nova do zero: cofre vazio e id de instalação novo */ };

  /* ---------- 1) primeira instalação ---------- */
  T.now = T0; let a = makeClient(pre(1)); await boot(a); const te1 = a.run('LK.payload.te');
  ok(a.run('licStatus()') === 'trial_active' && premAll(a) && te1 === T0 + 336 * H, '1) PRIMEIRA INSTALAÇÃO: 14 dias de teste');
  const rows = devs(); ok(rows.length === 1 && rows[0].dev_hash === await hmac(AID) && rows[0].trial_started_at === T0 && rows[0].trial_expires_at === T0 + 336 * H && rows[0].trial_granted === 1 && rows[0].first_install_id === 'dev-t35-0000000001', 'registro permanente: HMAC do aparelho, início, expiração (UTC, servidor), "já recebeu teste" e identidade anônima da instalação');
  ok(a.sent[0][1].device_hint === AID, 'o app envia o Android ID ao servidor (por HTTPS) para virar HMAC');
  /* ---------- 2) fechar e abrir ---------- */
  T.now += 3 * DAY; const a2 = makeClient({ store: a.store, cfg: a.cfg, dev: 'dev-t35-0000000001', aid: AID }); await boot(a2);
  ok(a2.run('LK.payload.te') === te1 && devs().length === 1, '2) fechar e abrir: preserva a data original e não cria outro registro');
  /* ---------- 3 e 4) limpar dados / desinstalar e reinstalar (válido): mesma expiração ---------- */
  T.now = T0 + 5 * DAY; const nIns = db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c;
  const c3 = makeClient(pre(2)); await boot(c3);
  ok(db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c === nIns + 1, 'a reinstalação é uma instalação anônima nova (cofre vazio)');
  ok(c3.run('licStatus()') === 'trial_active' && c3.run('LK.payload.te') === te1 && premAll(c3), '3/4/7) LIMPAR DADOS e REINSTALAR com teste válido: o servidor reconhece o aparelho e preserva a expiração ORIGINAL (restam 9 dias)');
  ok(devs().length === 1 && devs()[0].trial_started_at === T0, 'o registro do aparelho continua único e com o início original');
  ok(c3.run('licRemaining ? 1 : 1') && /Restam 9 dias/.test(c3.run('viewLicenca()')), 'a tela mostra os dias que realmente restam');
  /* ---------- 6) reinstalar com teste expirado ---------- */
  T.now = te1 + 2 * DAY; const c6 = makeClient(pre(3)); await boot(c6);
  ok(c6.run('licStatus()') === 'trial_expired' && !premAll(c6) && freeAll(c6), '6) REINSTALAR com teste expirado: continua expirado e o gratuito segue normal');
  const c6b = makeClient(pre(4)); await boot(c6b); ok(c6b.run('licStatus()') === 'trial_expired', 'repetir a limpeza várias vezes não renova');
  /* ---------- 5) backup antigo ---------- */
  const appJs = rd('src/app.js') + rd('src/extras.js') + rd('native/drive.js') + rd('native/native.js');
  ok(!/lic-token|lic-info|lic-seen|lic-dev|lic-secret|lic-isec|lic-ack|lic-prov|LK\./.test(appJs.replace(/\/\*[\s\S]*?\*\//g, '')), '5) o backup e a restauração não leem nem gravam estado de licença/teste (dados pessoais separados da elegibilidade)');
  const c5 = makeClient(pre(5)); await boot(c5); ok(c5.run('licStatus()') === 'trial_expired', '5) restaurar backup antigo (dados) num aparelho já com teste vencido não reinicia o teste: a elegibilidade vem só do servidor');
  /* ---------- 8) data do aparelho ---------- */
  c5.OFFLINE = true; T.now -= 30 * DAY; ok(c5.run('licStatus()') === 'trial_expired' && !premAll(c5), '8) voltar a data do aparelho não reabre o teste');
  /* ---------- 12/13) offline e servidor fora, com aparelho que já usou ---------- */
  T.now = T0 + 20 * DAY; const c12 = makeClient(pre(7)); c12.OFFLINE = true; const n12 = devs().length, i12 = db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c; await boot(c12);
  ok(c12.run('licStatus()') === 'trial_unverified' && !premAll(c12) && freeAll(c12) && devs().length === n12 && db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c === i12, '12) SEM INTERNET após reinstalar: gratuito liberado, nenhum teste novo, nada registrado');
  ST.down = true; const c13 = makeClient(pre(8)); await boot(c13); ST.down = false;
  ok(c13.run('licStatus()') === 'trial_unverified' && !premAll(c13) && freeAll(c13), '13) BACKEND FORA: não reinicia o teste e não bloqueia o gratuito');
  c12.OFFLINE = false; await c12.run('licRefresh(true)'); await settle(); ok(c12.run('licStatus()') === 'trial_expired' && c12.run('LK.payload.te') === te1, '12) ao voltar a internet vale o teste original (já vencido)');
  /* ---------- 9/10) sem Google e depois com Google ---------- */
  ok(freeAll(c12) && !c12.run("licLockView('bolus')").includes('data-act="g-in"'), '9) sem login Google tudo funciona');
  T.now = T0 + 7 * DAY; const g1 = makeClient({ cfg: new Map(), dev: 'dev-t35-0000000020', aid: '1111aaaa2222bbb3', sub: 'g35' });
  const gv = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000021', aid: '1111aaaa2222bbb3', sub: 'g35' }); T.now = T0 + 600 * DAY - 590 * DAY; await boot(gv);
  const gte = gv.run('LK.payload.te'); T.now += 6 * DAY; gv.run('TB_DRV_STATE.conn = true'); gv.store.set('g-refresh', 'x'); await gv.run('licRefresh(true)'); await settle();
  ok(gv.run('LK.payload.sub') === 'g35' && gv.run('LK.payload.te') === gte && !gv.run('LK.payload.guest'), '10) LOGIN GOOGLE depois: preserva a expiração original, sem segundo teste');
  ok(db.raw.prepare("SELECT trial_started_at t FROM accounts WHERE sub='g35'").get().t === gte - 336 * H && devs().filter(x => x.trial_started_at === gte - 336 * H).length === 1, '10) conta, instalação e aparelho ficam com o mesmo início; um só registro de aparelho');
  /* usuário que entrou primeiro com Google (nunca foi visitante): expirou, limpa os dados e escolhe visitante */
  T.now = T0 + 100 * DAY; const gf = makeClient({ cfg: new Map(), dev: 'dev-t35-0000000030', aid: '3333cccc4444ddd5', sub: 'gfirst', conn: true }); gf.store.set('g-refresh', 'x'); await boot(gf); const gfte = gf.run('LK.payload.te');
  ok(gf.run('licStatus()') === 'trial_active', 'Google primeiro: teste normal');
  T.now = gfte + 3 * DAY; const gfv = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000031', aid: '3333cccc4444ddd5' }); await boot(gfv);
  ok(gfv.run('licStatus()') === 'trial_expired', 'quem usou com Google, deixou vencer, limpou os dados e escolheu visitante NÃO recebe teste novo');
  /* conta existente de antes do Android ID (0.33): o refresh registra o aparelho */
  T.now = T0 + 300 * DAY; const old = makeClient({ cfg: new Map(), dev: 'dev-t35-0000000040', sub: 'oldacct', conn: true }); old.store.set('g-refresh', 'x'); await boot(old);   /* sem plugin: nada registrado */
  const nOld = devs().length; const oldte = old.run('LK.payload.te');
  const oldNew = makeClient({ store: old.store, cfg: old.cfg, dev: 'dev-t35-0000000040', aid: '5555eeee6666fff7', sub: 'oldacct', conn: true }); await oldNew.run('licLoad()'); T.now += 2 * H; await oldNew.run('licRefresh(true)'); await settle();
  ok(devs().length === nOld + 1 && devs().some(x => x.trial_started_at === oldte - 336 * H), 'conta antiga: o primeiro refresh com o app novo registra o aparelho com o início da conta');
  T.now = oldte + DAY; const oldG = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000041', aid: '5555eeee6666fff7' }); await boot(oldG); ok(oldG.run('licStatus()') === 'trial_expired', 'e depois disso limpar os dados e escolher visitante não dá teste novo');
  /* ---------- 11) licença vitalícia e outro aparelho ---------- */
  T.now = T0 + 800 * DAY; db.raw.prepare("INSERT INTO licenses(sub,status,price_cents,currency,order_id,payment_id,activated_at,updated_at) VALUES('life35','active',2990,'BRL','o35','p35',?,?)").run(T.now, T.now);
  const l1 = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000050', aid: AID, sub: 'life35' }); await boot(l1); ok(l1.run('licStatus()') === 'trial_expired', 'aparelho com teste usado: visitante vencido');
  l1.run('TB_DRV_STATE.conn = true'); l1.store.set('g-refresh', 'x'); await l1.run('licRefresh(true)'); await settle();
  ok(l1.run('licStatus()') === 'lifetime_active' && l1.run("licAllowed('metricas')") && premAll(l1), '11) o registro do teste NÃO sobrescreve nem bloqueia a licença vitalícia da conta, no mesmo aparelho');
  const l2 = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000051', aid: 'abcdef0123456789', sub: 'life35' }); l2.run('TB_DRV_STATE.conn = true'); l2.store.set('g-refresh', 'x'); await boot(l2);
  ok(l2.run('licStatus()') === 'lifetime_active', '11) OUTRO DISPOSITIVO: a licença vitalícia é recuperada após autenticar');
  const lifeAfter = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000052', aid: AID }); await boot(lifeAfter);
  ok(lifeAfter.run('licStatus()') === 'trial_expired' && !(await core.licVerify(lifeAfter.store.get('lic-token') ? JSON.parse(JSON.stringify(lifeAfter.run('LK.payload'))) && lifeAfter.store.get('lic-token') : '', pubJwk) || {}).lic, 'reinstalar sem entrar na conta não "empresta" a licença (ela é da conta)');
  ok(db.raw.prepare("SELECT COUNT(*) c FROM licenses WHERE sub='life35'").get().c === 1, 'nenhuma licença duplicada');

  /* ---------- limites e privacidade ---------- */
  T.now = T0 + 900 * DAY; const nf = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000060', aid: 'fedcba9876543210' }); await boot(nf);
  ok(nf.run('licStatus()') === 'trial_active', 'outro aparelho (outro Android ID) recebe o seu teste: nenhum bloqueio indevido');
  const fr = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000061', aid: '9999999988887777' }); await boot(fr);
  ok(fr.run('licStatus()') === 'trial_active' && fr.run('LK.payload.te') > te1, 'LIMITE: restauração de fábrica / outro perfil / outra chave de assinatura mudam o Android ID e permitem novo teste');
  for (const bad of ['9774d56d682e549c', 'aaaaaaaaaaaaaaaa', 'abc', 'ZZZZZZZZZZZZZZZZ', '']) { const x = makeClient({ cfg: guestCfg(), dev: 'dev-t35-bad' + String(Math.random()).slice(2, 12), aid: bad }); const d0 = devs().length; await boot(x); ok(devs().length === d0 && x.run('licStatus()') === 'trial_active', 'Android ID inválido ou sabidamente repetido é ignorado sem negar o teste: ' + JSON.stringify(bad)); }
  const dump = JSON.stringify(['accounts', 'installs', 'trial_devices', 'events', 'devices', 'rate_limits', 'orders', 'config'].map(t => db.raw.prepare('SELECT * FROM ' + t).all()));
  const rawIds = [AID, AID2, '1111aaaa2222bbb3', '3333cccc4444ddd5', '5555eeee6666fff7', 'abcdef0123456789', 'fedcba9876543210', '9999999988887777'];
  ok(rawIds.every(v => !dump.includes(v)), 'O ANDROID_ID BRUTO NÃO É GRAVADO em nenhuma tabela, nem em eventos');
  ok(rawIds.every(v => !logs.join('\n').includes(v)), 'o ANDROID_ID bruto não aparece em logs do Worker');
  ok(devs().every(d => /^[0-9a-f]{64}$/.test(d.dev_hash)), 'só o HMAC (64 hex) é guardado');
  const r = await call('POST', '/v1/guest/start', { install_id: IID(901), install_secret: SEC(901), device_hint: AID }); const body = JSON.stringify(await r.json()); ok(!body.includes(AID) && !body.includes(await hmac(AID)), 'a resposta ao app não traz o Android ID nem o hash');
  const r400 = await call('POST', '/v1/guest/start', { install_id: 'x', install_secret: 'y', device_hint: AID }); ok(!JSON.stringify(await r400.json()).includes(AID), 'mensagens de erro não ecoam o Android ID');
  const cs = JSON.stringify([...a.store], (k, v) => v) + JSON.stringify([...a.cfg]);
  ok(!cs.includes(AID), 'o app não guarda o Android ID no cofre nem em configurações');
  ok(!(a.run('viewLicenca()') + a.run("licLockView('bolus')") + a.run('LK.msg') + a.run('licBanner()') + a.run('licMenuDesc()')).includes(AID), 'o Android ID não aparece em nenhuma tela do app');
  /* sem segredo no Worker: recurso desligado, nunca grava hash sem segredo */
  const envNo = Object.assign({}, env); delete envNo.DEVICE_HMAC_KEY; const d0 = devs().length;
  const rn = await app(new Request('https://w.test/v1/guest/start', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '7.7.7.7' }, body: JSON.stringify({ install_id: IID(902), install_secret: SEC(902), device_hint: AID }) }), envNo);
  ok(rn.status === 200 && devs().length === d0, 'sem DEVICE_HMAC_KEY o Worker não grava nada do aparelho e o teste segue normal');
  /* o app em navegador (sem plugin) funciona igual */
  const web = makeClient({ cfg: guestCfg(), dev: 'dev-t35-0000000070' }); await boot(web); ok(web.run('licStatus()') === 'trial_active' && !('device_hint' in web.sent[0][1]), 'sem o plugin nativo nada é enviado e o visitante funciona');
  /* guardas estáticas do lado Android */
  const pa = rd('scripts/patch-android.js');
  ok(/Settings\.Secure\.ANDROID_ID/.test(pa) && /registerPlugin\(TbDevicePlugin\.class\)/.test(pa) && !/getMacAddress|getImei|getDeviceId|Build\.getSerial|Build\.SERIAL|READ_PHONE_STATE/.test(pa), 'Android: só ANDROID_ID, plugin registrado, sem MAC/IMEI/serial/permissões novas');
  ok(/allowBackup="false"/.test(pa) && /setTextZoom\(100\)/.test(pa) && /const K = 1\.29;/.test(rd('scripts/build-web.js')), 'ajustes aprovados do APK e da tela intactos');
  ok(/"version": "0\.34\.0"/.test(rd('package.json')), 'versão 0.34.0');
  console.error = oe;
  console.log(fail ? `test35 FALHOU (${fail}/${n})` : `test35 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('test35 erro:', e); process.exit(1); });
