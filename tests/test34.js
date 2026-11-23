// test34: modo visitante, teste de 14 dias sem conta, relógio protegido, vínculo com Google, migração e licença vitalícia (0.33.0).
// Roda o Worker de verdade (rotas e SQL em SQLite) ligado ao license.js e ao native/migrate.js de verdade, sem rede e sem chaves reais.
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
  /* ---------- 0) funções puras do núcleo ---------- */
  ok(core.licEarliest(5, 9) === 5 && core.licEarliest(9, 5) === 5 && core.licEarliest(null, 7) === 7 && core.licEarliest(7, undefined) === 7 && core.licEarliest(null, null) === null, 'vale sempre o início mais antigo');
  ok(core.LIC_TRIAL_MS === 336 * H, 'teste de 336 h');

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
  const db = d1(), env = { DB: db, GOOGLE_CLIENT_ID: CID, PUBLIC_URL: 'https://w.test', MP_ACCESS_TOKEN: 'tok', MP_WEBHOOK_SECRET: 'segredo', LICENSE_PRIVATE_JWK: JSON.stringify(privJwk) };
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

  /* ---------- 1) Worker: início do teste do visitante ---------- */
  ok(db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c === 0, 'sem acesso efetivo não existe teste nem registro');
  let a = await gstart(1);
  ok(a.r.status === 200 && a.j.guest === true && a.j.status === 'trial_active', 'visitante recebe o teste sem conta e sem cartão');
  ok(a.j.trial_ends_at - T0 === 336 * H && row('installs', 'id=?', IID(1)).trial_started_at === T0, 'dura 336 h a partir da hora do SERVIDOR');
  const pl = await core.licVerify(a.j.token, pubJwk);
  ok(pl && pl.guest === true && pl.sub === null && pl.inst === IID(1) && pl.st === 'trial_active' && pl.lic === false && pl.te === a.j.trial_ends_at, 'token assinado: visitante, sem conta, sem licença');
  ok(core.licPremium(pl, T0 + H) && !core.licPremium(pl, T0 + 336 * H), 'token libera o premium durante o teste e não depois');
  T.now = T0 + 5 * DAY; let b = await gstart(1);
  ok(b.j.trial_ends_at === a.j.trial_ends_at && db.raw.prepare('SELECT COUNT(*) c FROM installs').get().c === 1, 'repetir o início (fechar/abrir, atualizar) não reinicia nem duplica');
  b = await gref(1); ok(b.r.status === 200 && b.j.trial_ends_at === a.j.trial_ends_at, 'consulta do visitante mantém o mesmo fim');
  T.now = T0 + 336 * H - 1; ok((await gref(1)).j.status === 'trial_active', '1 ms antes de 336 h ainda é teste');
  T.now = T0 + 336 * H; b = await gref(1); ok(b.j.status === 'trial_expired', 'em 336 h o teste do visitante termina');
  b = await gstart(1); ok(b.j.status === 'trial_expired', 'chamar o início de novo depois do fim não renova');
  T.now = T0;

  /* ---------- 2) Worker: identificação e segurança ---------- */
  ok((await gstart(1, {}, SEC(99))).r.status === 401, 'segredo diferente para um id existente é recusado');
  ok((await gstart(1, { install_id: 'curto' })).r.status === 400 && (await gstart(1, { install_secret: 'x' })).r.status === 400, 'formato inválido de id ou segredo é recusado');
  ok((await call('POST', '/v1/guest/refresh', {}, `Install ${IID(1)}.errado-errado-errado-errado`)).status === 401 && (await call('POST', '/v1/guest/refresh', {})).status === 401, 'consulta sem segredo certo é recusada');
  ok((await call('POST', '/v1/refresh', {}, `Device ${IID(1)}.${SEC(1)}`)).status === 401, 'credencial de visitante não vale como aparelho de conta');
  ok(row('installs', 'id=?', IID(1)).secret_hash !== SEC(1) && !JSON.stringify(db.raw.prepare('SELECT * FROM installs').all()).includes(SEC(1)), 'o segredo é guardado só como hash');
  /* o app não escolhe o início: a hora anotada pelo cliente é ignorada */
  const c1 = await gstart(11, { client_started_at: T0 - 5 * DAY }); ok(c1.j.trial_ends_at === T0 + 336 * H, 'início sempre é a hora do servidor (campo do cliente é ignorado)');
  /* freio de criação em massa */
  ST.ip = '9.9.9.9'; let blocked = 0; for (let i = 100; i < 140; i++) if ((await gstart(i)).r.status === 429) blocked++; ok(blocked > 0, 'criação em massa de instalações a partir de um mesmo IP é freada'); ST.ip = '1.1.1.1';
  const tables = db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x => x.name).sort().join();
  ok(tables === 'accounts,config,devices,events,installs,licenses,orders,rate_limits,trial_devices,webhook_log', 'continua sem tabelas de saúde');
  ok(db.raw.prepare("PRAGMA table_info(installs)").all().map(c => c.name).join() === 'id,secret_hash,trial_started_at,created_at,last_seen,linked_sub,linked_at', 'installs guarda só id aleatório, hash, datas e vínculo');

  /* ---------- 3) Worker: do visitante para a conta Google ---------- */
  T.now = T0 + 5 * DAY;                                                            /* visitante 1 usa desde o dia 0 e entra no dia 5 */
  let s1 = await sess('u1', IID(1), { install_id: IID(1), install_secret: SEC(1) });
  ok(s1.r.status === 200 && s1.j.status === 'trial_active', 'login depois de dias mantém o teste ativo');
  ok(s1.j.trial_ends_at === T0 + 336 * H, 'preserva a data ORIGINAL de início (não concede 14 dias novos)');
  ok(row('accounts', "sub='u1'").trial_started_at === T0 && row('installs', 'id=?', IID(1)).linked_sub === 'u1', 'conta herda o início da instalação e a instalação fica vinculada');
  const plS = await core.licVerify(s1.j.token, pubJwk); ok(plS.sub === 'u1' && !plS.guest && plS.te === T0 + 336 * H, 'token da conta substitui o de visitante');
  /* visitante cujo teste já acabou entra com conta nova: não ganha dias */
  T.now = T0 + 30 * DAY; await gstart(2); T.now = T0 + 30 * DAY + 20 * DAY;       /* instalação 2 começa no dia 30; no dia 50 entra */
  let s2 = await sess('u2', IID(2), { install_id: IID(2), install_secret: SEC(2) });
  ok(s2.j.status === 'trial_expired' && s2.j.trial_ends_at === T0 + 30 * DAY + 336 * H, 'visitante com teste vencido que entra com Google continua vencido');
  /* alternar contas na mesma instalação não reinicia */
  T.now = T0 + 60 * DAY; let s3 = await sess('u3', IID(2), { install_id: IID(2), install_secret: SEC(2) });
  ok(s3.r.status === 409 && s3.j.error === 'device_belongs_to_other_account', 'o aparelho de uma conta não é usado por outra');
  ok(row('accounts', "sub='u3'").trial_started_at === T0 + 30 * DAY, 'outra conta na mesma instalação herda o início da instalação (troca de conta não reinicia)');
  /* conta antiga + instalação mais nova: vale a mais antiga */
  T.now = T0; let s4a = await sess('u4', IID(30)); ok(s4a.j.status === 'trial_active', 'login direto com Google (sem visitante) inicia o teste como antes');
  T.now = T0 + 3 * DAY; await gstart(31); T.now = T0 + 4 * DAY; const s4 = await sess('u4', IID(31), { install_id: IID(31), install_secret: SEC(31) });
  ok(s4.j.trial_ends_at === T0 + 336 * H && row('installs', 'id=?', IID(31)).trial_started_at === T0, 'conta e instalação: vale o início mais antigo, nos dois registros');
  /* segredo errado no login: o login funciona e nada é vinculado */
  T.now = T0 + 6 * DAY; const s5 = await sess('u5', IID(40), { install_id: IID(2), install_secret: SEC(77) });
  ok(s5.r.status === 200 && row('accounts', "sub='u5'").trial_started_at === T0 + 6 * DAY && row('installs', 'id=?', IID(2)).linked_sub === 'u2', 'segredo de instalação errado não derruba o login nem vincula');
  const s6 = await sess('u6', IID(41), { install_id: 'x', install_secret: 'y' }); ok(s6.r.status === 200, 'campos de instalação inválidos são ignorados no login');
  /* conta já existente nunca ganha teste novo */
  T.now = T0 + 40 * DAY; const s7 = await sess('u1', IID(1), { install_id: IID(1), install_secret: SEC(1) }); ok(s7.j.status === 'trial_expired' && s7.j.trial_ends_at === T0 + 336 * H, 'conta existente: novo login não renova');

  /* ---------- 4) licença vitalícia preservada ---------- */
  T.now = T0 + 50 * DAY;
  db.raw.prepare("INSERT INTO licenses(sub,status,price_cents,currency,order_id,payment_id,activated_at,updated_at) VALUES('u1','active',2990,'BRL','o','p',?,?)").run(T.now, T.now);
  s1 = await sess('u1', IID(50), { install_id: IID(50), install_secret: SEC(50) });
  ok(s1.j.status === 'lifetime_active' && s1.j.licensed_price_cents === 2990, 'conta com licença: aparelho novo (com visitante antes) recupera a licença ao entrar');
  ok(db.raw.prepare("SELECT COUNT(*) c FROM licenses WHERE sub='u1'").get().c === 1 && db.raw.prepare('SELECT COUNT(*) c FROM licenses').get().c === 1, 'nenhuma licença duplicada');
  await gstart(50); const gg = await gref(50); ok(gg.j.status === 'trial_expired' && gg.j.token && !(await core.licVerify(gg.j.token, pubJwk)).lic, 'o caminho do visitante nunca concede licença vitalícia');
  const ord = await call('POST', '/v1/order', {}, `Device ${IID(50)}.${s1.j.device_secret}`); ok(ord.status === 409, 'quem já tem licença não compra de novo');

  /* ---------- 5) cliente (license.js real) ---------- */
  function makeClient(o) {
    o = o || {}; const store = o.store || new Map(), cfg = o.cfg || new Map(), ctx = { console, crypto, TextEncoder, TextDecoder, atob, btoa, Request, Response, Uint8Array, JSON, Math, Promise, setTimeout, clearTimeout, URL };
    ctx.window = ctx; ctx.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Teste)' }; ctx.document = { addEventListener() {}, visibilityState: 'visible' }; ctx.addEventListener = () => {};
    ctx.Date = class extends Date { static now() { return T.now; } };
    ctx.TB_LICENSE_API = 'https://w.test'; ctx.TB_LICENSE_PUBKEY = JSON.stringify(pubJwk);
    ctx.TB_SECURE = { get: async k => store.get(k) ?? null, set: async (k, v) => { store.set(k, v); }, has: async k => store.has(k), del: async k => { store.delete(k); }, getCfg: async k => cfg.get(k) ?? null, setCfg: async (k, v) => { cfg.set(k, v); } };
    ctx.TB_DRV_STATE = { conn: !!o.conn }; ctx.TB_DRV = { idToken: async () => o.sub && ctx.TB_DRV_STATE.conn ? idTok(o.sub) : null };
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

  /* 5a) a escolha ainda não foi feita (tela de entrada aberta): nada começa */
  T.now = T0 + 100 * DAY; const nBefore = before();
  let u = makeClient({ cfg: new Map(), dev: 'dev-gate00000000001' }); await boot(u);
  ok(u.run('licStatus()') === 'pending_trial' && before() === nBefore && u.sent.length === 0, 'com a tela de entrada aberta o teste não começa (conta como primeiro acesso efetivo só depois da escolha)');
  ok(freeAll(u) && !u.run("licAllowed('bolus')"), 'sem escolha: gratuito liberado, premium ainda não');

  /* 5b) primeiro acesso como visitante */
  const V = { cfg: guestCfg(), dev: 'dev-guest0000000001' }; u = makeClient(V); await boot(u);
  ok(u.run('licStatus()') === 'trial_active' && premAll(u) && freeAll(u), 'PRIMEIRO ACESSO COMO VISITANTE: 14 dias Premium liberados e gratuito normal');
  ok(!u.run("licAllowed('metricas')"), 'regra aprovada mantida: a Central de Métricas continua exclusiva da licença vitalícia');
  const te0 = u.run('LK.payload.te'); ok(te0 === T.now + 336 * H && u.run('LK.payload.guest') === true, 'fim do teste = 336 h depois do início registrado pelo servidor');
  ok(u.sent[0][0] === '/v1/guest/start' && Object.keys(u.sent[0][1]).sort().join() === 'install_id,install_secret', 'o app envia ao servidor só o id e o segredo aleatórios da instalação');
  ok(!/\bimei\b|\bserial\b|android_id|macaddress|getdeviceid|advertisingid|getimei/i.test((rd('src/license.js') + rd('native/migrate.js')).replace(/\/\*[\s\S]*?\*\//g, '')), 'nenhum identificador invasivo do aparelho no código de licença/migração');
  ok(u.store.has('lic-isec') && u.store.has('lic-token') && u.cfg.get('lic-seen') && typeof u.cfg.get('lic-seen').t === 'number', 'segredo, token e relógio protegido ficam no cofre local');
  /* fechar e abrir / reiniciar / atualizar: mesmo cofre, novo processo */
  T.now += 3 * DAY; const u2c = makeClient({ store: u.store, cfg: u.cfg, dev: 'dev-guest0000000001' }); await boot(u2c);
  ok(u2c.run('LK.payload.te') === te0 && u2c.run('licStatus()') === 'trial_active' && premAll(u2c), 'fechar/abrir, reiniciar e atualizar o app mantêm a contagem');
  ok(before() === nBefore + 1, 'um único registro de instalação para esse visitante');
  /* aviso discreto nos 3 últimos dias */
  const left = (c) => c.run('licBanner()');
  T.now = te0 - 5 * DAY; ok(left(u2c) === '', 'sem aviso quando faltam mais de 3 dias');
  T.now = te0 - 2 * DAY; ok(/termina em/.test(left(u2c)) && !/alarm|perd/i.test(left(u2c)), 'aviso discreto quando faltam até 3 dias (sem alarmismo)');
  /* expiração */
  await jump(u2c, te0 - 1); ok(premAll(u2c), '1 ms antes do fim o premium segue liberado');
  await jump(u2c, te0); ok(u2c.run('licStatus()') === 'trial_expired' && !premAll(u2c) && !['bolus', 'padroes', 'exames', 'analise', 'rel-pdf', 'ia'].some(f => u2c.run(`licAllowed('${f}')`)), 'COMPLETOU 14 DIAS: o Premium encerra automaticamente');
  ok(freeAll(u2c), 'após a expiração as funcionalidades gratuitas continuam');
  const lv = u2c.run("licLockView('bolus')"); ok(/terminou/.test(lv) && /Nada foi apagado/.test(lv) && /registros continuam/.test(lv) && /Ver teste e licença/.test(lv) && !/alarm|perder|apagad[oa]s? (em|para)/i.test(lv), 'tela bloqueada: informa o fim, preservação dos registros e leva à licença');
  const bn = left(u2c); ok(/experiência Premium terminou/.test(bn) && /preservados/.test(bn) && /licença vitalícia/.test(bn), 'aviso após a expiração: terminou, registros preservados, gratuito disponível, licença vitalícia');
  u2c.run("licSec().setCfg('lic-ack', {exp: LK.payload.te}); LK.ack = {exp: LK.payload.te};"); ok(left(u2c) === '', 'depois de "Entendi" o aviso não volta');
  const vl = u2c.run('viewLicenca()'); ok(/Entrar com Google para adquirir a licença/.test(vl) && /continuam preservados/.test(vl) && /não reinicia nem renova/.test(vl), 'visitante com teste vencido: tela da licença pede o Google só para adquirir e diz que não renova');
  ok(freeAll(u2c) && !/data-act="g-in"/.test(u2c.run("licLockView('bolus')")), 'pedir Google acontece só ao adquirir; nada gratuito exige conta');
  /* data do celular */
  u2c.OFFLINE = true; T.now = te0 - 10 * DAY; ok(u2c.run('licStatus()') === 'trial_expired' && !premAll(u2c), 'voltar a data do celular depois da expiração NÃO devolve dias');
  u2c.OFFLINE = false; T.now = te0 + 1 * DAY;

  /* 5c) relógio: recuar a data não congela nem estende; avançar só encurta */
  T.now = T0 + 200 * DAY; const RC = { cfg: guestCfg(), dev: 'dev-clock000000001' }; let rc = makeClient(RC); await boot(rc);
  const rte = rc.run('LK.payload.te'); await jump(rc, rte - 2 * H); ok(premAll(rc), 'faltando 2 h o teste ainda vale');
  rc.OFFLINE = true; T.now = rte - 2 * H - 30 * DAY; rc.run('licNow()'); ok(premAll(rc), 'relógio recuado 30 dias: o tempo protegido não recua');
  T.now += 1 * H; ok(premAll(rc), 'uma hora real depois (relógio recuado) ainda faltava 1 h');
  T.now += 1 * H + 1; ok(!premAll(rc), 'duas horas reais depois o teste acaba mesmo com o relógio recuado (não congela)');
  rc.run('licSeenFlush()'); rc = makeClient({ store: rc.store, cfg: rc.cfg, dev: 'dev-clock000000001' }); rc.OFFLINE = true; T.now -= 40 * DAY; await rc.run('licLoad()'); ok(!premAll(rc), 'recuar a data e reabrir o app (offline) também não devolve o teste');
  rc.run('licNow()'); T.now += 5 * DAY; ok(rc.run('licStatus()') === 'trial_expired', 'o relógio protegido persistido sobrevive à reinicialização');
  /* tolerância offline do token também não estica recuando o relógio */
  T.now = T0 + 300 * DAY; const RO = { cfg: guestCfg(), dev: 'dev-clock000000002' }; let ro = makeClient(RO); await boot(ro); const vexp = ro.run('LK.payload.vexp');
  ro.OFFLINE = true; T.now = vexp - H; ro.run('licNow()'); ok(premAll(ro), '1 h antes de vencer a tolerância offline ainda vale');
  T.now = vexp - H - 20 * DAY; ro.run('licNow()'); T.now += 2 * H; ok(!premAll(ro) && freeAll(ro), 'recuar o relógio não estica a tolerância sem internet; o gratuito não para');
  /* relógio adiantado por engano é desfeito quando o servidor responde */
  T.now = T0 + 400 * DAY; const RF = { cfg: guestCfg(), dev: 'dev-clock000000003' }; const rf = makeClient(RF); await boot(rf);
  rf.run(`LK.seen = ${T.now + 90 * DAY}; LK.seenL = ${T.now};`); rf.run('licRefresh(true)'); await settle(); ok(rf.run('LK.seen') <= T.now + 6 * 60e3, 'relógio protegido adiantado demais é corrigido pela hora do servidor');

  /* 5d) primeiro acesso SEM internet e servidor indisponível: sem teste local, gratuito normal, nada de teste novo */
  T.now = T0 + 500 * DAY; const nb = before(); const OF = { cfg: guestCfg(), dev: 'dev-offl00000000001' }; let of = makeClient(OF); of.OFFLINE = true; await boot(of);
  ok(of.run('licStatus()') === 'trial_unverified' && !premAll(of) && freeAll(of) && before() === nb, 'SEM INTERNET no primeiro acesso: nenhum Premium local, gratuito normal, nada no servidor');
  ok(/internet/.test(of.run("licLockView('bolus')")) && /Nada foi apagado/.test(of.run("licLockView('bolus')")), 'a tela explica que o teste começa com internet, sem ameaça');
  T.now += 5 * DAY; ok(!premAll(of) && freeAll(of), 'ficar dias offline não gera Premium');
  of.OFFLINE = false; await of.run('licRefresh(true)'); await settle();
  ok(of.run('licStatus()') === 'trial_active' && premAll(of) && of.run('LK.payload.te') === T.now + 336 * H, 'ao voltar a internet o servidor inicia o teste (14 dias a partir de agora)');
  T.now = T0 + 600 * DAY; const SD = { cfg: guestCfg(), dev: 'dev-down00000000001' }; ST.down = true; const sd = makeClient(SD); await boot(sd); ST.down = false;
  ok(sd.run('licStatus()') === 'trial_unverified' && !premAll(sd) && freeAll(sd) && /continuam normais/.test(sd.run('LK.msg')), 'SERVIDOR INDISPONÍVEL: não bloqueia o gratuito e não concede teste');
  await sd.run('licRefresh(true)'); await settle(); ok(sd.run('licStatus()') === 'trial_active' && sd.run('LK.payload.guest') === true, 'servidor de volta: o teste começa');
  /* reinstalar com o mesmo id não reinicia; cofre novo = instalação nova (limite documentado) */
  T.now = T0 + 700 * DAY; const RI = { cfg: guestCfg(), dev: 'dev-reinst0000000001' }; const ri = makeClient(RI); await boot(ri); const rte0 = ri.run('LK.payload.te');
  T.now += 20 * DAY; const ri2 = makeClient({ store: new Map(), cfg: guestCfg(), dev: 'dev-reinst0000000099' }); await boot(ri2);
  ok(ri2.run('licStatus()') === 'trial_active' && ri2.run('LK.payload.te') > rte0, 'SEM Android ID (web/plugin ausente): apagar os dados ainda cria instalação nova; com Android ID isso é coberto (test35)');
  const ri3 = makeClient({ store: ri.store, cfg: ri.cfg, dev: 'dev-reinst0000000001' }); await boot(ri3); ok(ri3.run('licStatus()') === 'trial_expired' && ri3.run('LK.payload.te') === rte0, 'com o cofre preservado (atualização do app) o mesmo teste continua e já venceu');

  /* 5e) visitante → Google → sair → visitante */
  T.now = T0 + 800 * DAY; const MG = { cfg: guestCfg(), dev: 'dev-migr000000001a', sub: 'mig1' }; let mg = makeClient(MG); await boot(mg); const mte = mg.run('LK.payload.te');
  T.now += 10 * DAY; mg.run('TB_DRV_STATE.conn = true'); mg.store.set('g-refresh', 'x'); await mg.run('licRefresh(true)'); await settle();
  ok(mg.run('licStatus()') === 'trial_active' && mg.run('LK.payload.te') === mte && !mg.run('LK.payload.guest') && mg.run('LK.payload.sub') === 'mig1', 'FAZER LOGIN APÓS ALGUNS DIAS: preserva a data original e troca para o token da conta');
  ok(mg.sent.some(s => s[0] === '/v1/session' && s[1].install_id === 'dev-migr000000001a'), 'o login envia a instalação para o servidor vincular');
  ok(premAll(mg), 'entrar não interrompe o Premium do teste');
  /* logout: gate volta; escolhe visitante de novo */
  mg.run('TB_DRV_STATE.conn = false'); mg.store.delete('g-refresh'); mg.cfg.set('login-skip', true); const sentBefore = mg.sent.length; const nIns = before();
  await mg.run('licRefresh(true)'); await settle();
  ok(mg.sent.slice(sentBefore).every(s => s[0] === '/v1/refresh') && before() === nIns, 'LOGOUT e voltar como visitante: usa o aparelho já conhecido e NÃO cria teste novo');
  T.now = mte + H; await mg.run('licRefresh(true)'); await settle(); ok(mg.run('licStatus()') === 'trial_expired', 'alternar visitante/Google não reinicia: vence na data original');
  const mg2 = makeClient({ cfg: guestCfg(), dev: 'dev-migr000000002b', sub: 'mig1' }); mg2.run('TB_DRV_STATE.conn = true'); mg2.store.set('g-refresh', 'x'); await boot(mg2);
  ok(mg2.run('licStatus()') === 'trial_expired', 'mesma conta em outro aparelho: segue vencida (nada renova)');

  /* 5f) licença vitalícia: troca de aparelho */
  T.now = T0 + 900 * DAY; db.raw.prepare("INSERT INTO licenses(sub,status,price_cents,currency,order_id,payment_id,activated_at,updated_at) VALUES('lifer','active',2990,'BRL','o2','p2',?,?)").run(T.now, T.now);
  const LF = makeClient({ cfg: guestCfg(), dev: 'dev-life000000001a', sub: 'lifer' }); await boot(LF); ok(LF.run('licStatus()') === 'trial_active', 'visitante em aparelho novo começa como visitante');
  LF.run('TB_DRV_STATE.conn = true'); LF.store.set('g-refresh', 'x'); await LF.run('licRefresh(true)'); await settle();
  ok(LF.run('licStatus()') === 'lifetime_active' && LF.run("licAllowed('metricas')") && premAll(LF), 'TROCAR DE DISPOSITIVO: após autenticar, recupera a licença vitalícia (Premium permanente)');
  ok(db.raw.prepare("SELECT COUNT(*) c FROM licenses WHERE sub='lifer'").get().c === 1, 'migrar visitante para conta com licença não duplica a licença');
  T.now += 400 * DAY; LF.OFFLINE = true; ok(LF.run('licStatus()') === 'lifetime_active' && freeAll(LF), 'licença vitalícia continua e o gratuito nunca depende de internet');

  /* ---------- 6) native/migrate.js: visitante → Google sem perder nem sobrescrever dados ---------- */
  function makeMig(o) {
    o = o || {}; const meta = new Map(o.meta || []), ctx = { console, setTimeout, Promise, JSON, Date, Math };
    ctx.window = ctx; ctx.TB_PUBLIC = true; ctx.TB_SECURE = {}; ctx.TB_DRV = { state: { conn: true, profile: { email: 'a@x.com', sub: o.sub || 'sub-a' } } };
    ctx.S = { irReady: true, route: 'painel' }; ctx.insLoaded = true; ctx.toasts = []; ctx.toast = m => ctx.toasts.push(m); ctx.render = () => {}; ctx.went = []; ctx.go = r => ctx.went.push(r);
    ctx.Store = { persistent: true, metaOk: true, writes: [], all: async s => s === 'meta' ? [...meta].map(([id, value]) => ({ id, value })) : [], put: async (s, v) => { ctx.Store.writes.push([s, v.id]); if (s === 'meta') meta.set(v.id, v.value); }, delMany() { throw new Error('não pode apagar'); }, del() { throw new Error('não pode apagar'); }, putMany() { throw new Error('não pode gravar registros'); } };
    ctx.hasRealData = () => o.data !== false; ctx.listing = o.older || []; ctx.backups = 0; ctx.loaded = [];
    ctx.drvFolder = async () => 'pasta1'; ctx.drvFiles = p => (p && p.files) || []; ctx.drvCall = async () => ({ files: ctx.listing });
    ctx.drvBackup = async () => { if (ctx.failBackup) return false; ctx.backups++; return true; }; ctx.drvLoad = async id => { ctx.loaded.push(id); };
    ctx.listeners = {}; ctx.document = { addEventListener: (t, f) => { ctx.listeners[t] = f; } }; ctx.addEventListener = (t, f) => { ctx.listeners[t] = f; };
    vm.createContext(ctx); vm.runInContext(rd('native/migrate.js'), ctx); ctx.meta = meta;
    ctx.fire = async type => { ctx.listeners['tb-auth']({ detail: { type } }); await settle(); };
    ctx.click = async act => { await ctx.listeners.click({ target: { closest: () => ({ dataset: { act } }) } }); await settle(); };
    ctx.st = () => ctx.TB_GUEST_LINK.state() && ctx.TB_GUEST_LINK.state().state;
    return ctx;
  }
  let m = makeMig(); await m.fire('connected');
  ok(m.st() === 'offer' && /Salvar no meu Drive/.test(m.gmBanner()) && m.backups === 0, 'ao entrar com Google o app OFERECE salvar e não envia nada ao Drive sozinho');
  ok(/não foi reiniciado/.test(m.gmBanner()) && /continuam neste aparelho/.test(m.gmBanner()), 'a oferta informa que os dados ficam e que o teste não reinicia');
  await m.click('gm-save'); ok(m.backups === 1 && m.st() === 'done', 'confirmando: envia UMA cópia aditiva e conclui');
  ok(m.Store.writes.every(w => w[0] === 'meta' && w[1] === 'guest-link'), 'a migração só grava o marcador guest-link: nenhum registro do usuário é tocado');
  ok(m.gmBanner() === '', 'concluída: sem faixa');
  await m.fire('connected'); ok(m.st() === 'done' && m.backups === 1, 'reconectar a mesma conta não oferece de novo nem duplica a cópia');
  m = makeMig({ older: [{ id: 'f9', title: 'gluxo-backup-2026-01-01-0800.json' }, { id: 'f8', title: 'gluxo-backup-2025-12-01-0800.json' }] }); await m.fire('connected'); await m.click('gm-save');
  ok(m.st() === 'merge' && m.backups === 1 && /já tem 2 cópias/.test(m.gmBanner()) && /sem apagar nada/.test(m.gmBanner()), 'CONTA COM DADOS EXISTENTES: salva a cópia local sem apagar e oferece mesclar');
  await m.click('gm-merge'); ok(m.went.includes('backup') && m.loaded[0] === 'f9', 'mesclar abre a restauração existente (mescla sem sobrescrever, remove duplicados) com a cópia mais recente');
  await m.click('gm-done'); ok(m.st() === 'done' && m.gmBanner() === '', 'fechar encerra o aviso');
  m = makeMig(); m.failBackup = true; await m.fire('connected'); await m.click('gm-save');
  ok(m.st() === 'pending' && /continuam intactos/.test(m.gmBanner()) && m.backups === 0, 'FALHA NA MIGRAÇÃO: estado pendente, dados locais intactos, aviso claro');
  m.failBackup = false; await m.click('gm-save'); ok(m.st() === 'done' && m.backups === 1, 'tentar de novo conclui sem duplicar');
  const m2 = makeMig({ meta: [['guest-link', { acct: 'sub-a', state: 'linking' }]] }); await m2.fire('connected'); ok(m2.st() === 'pending', 'migração interrompida no meio (app fechado) volta como pendente, nunca como concluída');
  const m3 = makeMig({ data: false }); await m3.fire('connected'); ok(m3.st() === 'done' && m3.backups === 0 && m3.gmBanner() === '', 'sem dados reais: nada a migrar, sem faixa');
  const m4 = makeMig({ sub: 'sub-b', meta: [['guest-link', { acct: 'sub-a', state: 'done' }]] }); await m4.fire('connected'); ok(m4.st() === 'offer', 'outra conta Google neste aparelho: oferece de novo, sem apagar nada');
  const m5 = makeMig(); await m5.fire('connected'); await m5.click('gm-later'); ok(m5.st() === 'declined' && m5.backups === 0 && m5.gmBanner() === '', '"Agora não" respeita a escolha: nada enviado');
  const m6 = makeMig(); m6.TB_DRV.state.conn = false; await m6.fire('connected'); ok(m6.TB_GUEST_LINK.state() === null && m6.gmBanner() === '', 'sem conta conectada: nada é oferecido');
  const m7 = makeMig(); m7.Store.metaOk = false; await m7.fire('connected'); ok(m7.Store.writes.length === 0, 'banco de configurações ilegível: não grava nada por cima');

  /* ---------- 7) guardas estáticas ---------- */
  const lg = rd('native/login.js'), dv = rd('native/drive.js'), lj = rd('src/license.js'), mj = rd('native/migrate.js');
  ok(/id="gate-in"/.test(lg) && /<button class="btn full" id="gate-skip"/.test(lg) && !/class="gl" id="gate-skip"/.test(lg), 'tela de entrada: "Continuar sem conta" é botão de mesma largura, não link escondido');
  ok(/14 dias de experiência Premium/.test(lg) && /só neste aparelho/.test(lg) && /desinstalar o app/.test(lg), 'tela de entrada informa os 14 dias e a limitação de recuperação dos dados do visitante');
  ok(/Usando sem conta\?/.test(dv) && /nada é apagado/.test(dv), 'tela de backup informa a limitação ao visitante');
  ok(!/Store\.|indexedDB|glicotrack|S\.records|putMany/.test(lj), 'licenciamento continua sem tocar nos dados de saúde');
  ok(!/delMany|\.del\(|putMany|Store\.clear/.test(mj), 'migração nunca apaga nem regrava registros');
  ok(/allowBackup="false"/.test(rd('scripts/patch-android.js')) && /setTextZoom\(100\)/.test(rd('scripts/patch-android.js')) && /versionCode/.test(rd('scripts/patch-android.js')), 'patch-android intacto: sem backup automático, textZoom e versionCode');
  ok(/const K = 1\.29;/.test(rd('scripts/build-web.js')), 'escala de tela aprovada (K = 1,29) intacta');
  ok(/'native\/login\.js', 'native\/migrate\.js'/.test(rd('scripts/build-web.js')), 'migrate.js incluído no build, depois do login');
  ok(!/guest|install/i.test(rd('src/logic.js')) && !/guest\//.test(rd('src/app.js')), 'regras de negócio do app (registros) não conhecem visitante');
  ok(/"version": "0\.(3[3-9]|[4-9]\d)\.0"/.test(rd('package.json')), 'versão 0.33 ou posterior');

  console.log(fail ? `test34 FALHOU (${fail}/${n})` : `test34 ok (${n} verificações)`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('test34 erro:', e); process.exit(1); });
